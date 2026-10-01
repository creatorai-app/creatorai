"""Cypher TTS v2: Chatterbox Multilingual V3, host-agnostic.

The model code lives here and nowhere else. server.py serves it over HTTP (the Docker
image runs that on any GPU host, Cloud Run GPU included) and modal/dubbing_app_v2.py
wraps the same server for Modal. Switching hosts never touches this file.

Differences from the frozen Modal app (modal/dubbing_app.py):
  - Multilingual V3 (t3_model="v3"), not the older V2 checkpoint.
  - The voice sample is kept at 24 kHz (S3GEN_SR), the rate Chatterbox's decoder takes
    its prompt at, instead of being cut to 16 kHz first.
  - cfg_weight, exaggeration and temperature are the caller's (see chatterboxParamsFor in
    packages/validations): cfg_weight 0 drops the sample's accent for "Sound native".
  - Text split into chunks is joined with a short pause, not glued end to end.
  - The language is checked against what the model speaks (a wrong language_id does not
    fail in the model; it speaks nonsense), and text longer than a worker turn is refused.
"""

from __future__ import annotations

import hashlib
import io
import os
import re
import subprocess
import tempfile
import threading
import wave
from collections import OrderedDict
from typing import Optional

# The 23 languages Chatterbox Multilingual speaks (SUPPORTED_LANGUAGES in
# chatterbox/mtl_tts.py). Kept here so requests can be checked without the model loaded;
# load() confirms the model agrees.
SUPPORTED_LANGUAGES = frozenset(
    "ar da de el en es fi fr he hi it ja ko ms nl no pl pt ru sv sw tr zh".split()
)

# The worker's turn cap (TURN_MAX_CHARS in packages/workers/.../dub-segments.ts). A
# longer text is a bug on the caller's side; refusing it keeps a runaway GPU run from
# happening at all. Keep the two in step.
MAX_TEXT_CHARS = 300

# Chatterbox stays reliable on sentence-sized input; longer text is split at sentence
# ends into chunks of at most this many characters.
CHUNK_CHARS = 200

# Silence between chunks, so two sentences are not run together.
CHUNK_PAUSE_SECONDS = 0.15

# Voice samples are resampled to this rate (Chatterbox's S3GEN_SR).
REFERENCE_SAMPLE_RATE = 24000

HF_REPO = "ResembleAI/chatterbox"
T3_MODEL = "v3"
# What ChatterboxMultilingualTTS.from_pretrained downloads for t3_model="v3".
WEIGHT_FILES = [
    "ve.pt",
    "t3_mtl23ls_v3.safetensors",
    "s3gen.pt",
    "grapheme_mtl_merged_expanded_v1.json",
    "conds.pt",
    "Cangjie5_TC.json",
]

_SENTENCE_END = re.compile(r"(?<=[.!?।؟۔])\s+|(?<=[。！？])")
_CJK_END = re.compile(r"[。！？]$")


class RequestError(ValueError):
    """The request itself is wrong: the server answers 400."""


def validate_request(text: str, language: str) -> str:
    """The text to speak, stripped, or a RequestError saying what is wrong."""
    cleaned = (text or "").strip()
    if not cleaned:
        raise RequestError("text is required")
    if len(cleaned) > MAX_TEXT_CHARS:
        raise RequestError(f"text is {len(cleaned)} characters; at most {MAX_TEXT_CHARS} are accepted")
    if (language or "").lower() not in SUPPORTED_LANGUAGES:
        raise RequestError(f"language '{language}' is not supported; expected one of {', '.join(sorted(SUPPORTED_LANGUAGES))}")
    return cleaned


def split_text(text: str, max_chars: int = CHUNK_CHARS) -> list[str]:
    """Whole sentences packed into chunks of at most `max_chars` (a longer sentence stays whole)."""
    chunks: list[str] = []
    current = ""
    for sentence in (s.strip() for s in _SENTENCE_END.split(text.strip())):
        if not sentence:
            continue
        # CJK sentences run on without a space; everything else takes one.
        separator = "" if _CJK_END.search(current) else " "
        joined = f"{current}{separator}{sentence}".strip()
        if current and len(joined) > max_chars:
            chunks.append(current)
            current = sentence
        else:
            current = joined
    if current:
        chunks.append(current)
    return chunks or [text.strip()]


def to_wav_bytes(samples, sample_rate: int) -> bytes:
    """Mono float samples in [-1, 1] as 16-bit PCM WAV bytes."""
    import numpy as np

    pcm = (np.clip(np.asarray(samples, dtype=np.float32).reshape(-1), -1.0, 1.0) * 32767.0).astype("<i2")
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as out:
        out.setnchannels(1)
        out.setsampwidth(2)
        out.setframerate(sample_rate)
        out.writeframes(pcm.tobytes())
    return buffer.getvalue()


def download_weights() -> str:
    """Fetch the V3 weights into the Hugging Face cache (image build time), return the folder."""
    from huggingface_hub import snapshot_download

    return snapshot_download(repo_id=HF_REPO, repo_type="model", revision="main", allow_patterns=WEIGHT_FILES, token=os.getenv("HF_TOKEN"))


class TtsEngine:
    """One loaded model, used by one request at a time (the GPU is not shared)."""

    def __init__(self, device: Optional[str] = None, reference_cache_size: int = 32):
        self.device = device
        self.model = None
        self._lock = threading.Lock()
        # Voice samples by URL: a dub sends the same few samples for every turn.
        self._references: "OrderedDict[str, str]" = OrderedDict()
        self._reference_cache_size = reference_cache_size
        self._workdir = tempfile.mkdtemp(prefix="cypher-tts-")

    @property
    def loaded(self) -> bool:
        return self.model is not None

    def load(self) -> None:
        if self.model is not None:
            return
        import torch
        from chatterbox.mtl_tts import SUPPORTED_LANGUAGES as MODEL_LANGUAGES
        from chatterbox.mtl_tts import ChatterboxMultilingualTTS

        missing = SUPPORTED_LANGUAGES - set(MODEL_LANGUAGES)
        if missing:
            raise RuntimeError(f"the installed Chatterbox does not speak {sorted(missing)}")
        device = self.device or ("cuda" if torch.cuda.is_available() else "cpu")
        self.model = ChatterboxMultilingualTTS.from_pretrained(device=device, t3_model=T3_MODEL)
        self.device = device

    def reference_path(self, reference_url: str) -> str:
        """The voice sample as a local 24 kHz mono WAV, downloaded once per URL."""
        if reference_url in self._references:
            self._references.move_to_end(reference_url)
            return self._references[reference_url]
        import requests

        response = requests.get(reference_url, timeout=120)
        response.raise_for_status()
        name = hashlib.sha256(reference_url.encode()).hexdigest()[:24]
        source = os.path.join(self._workdir, f"{name}.src")
        target = os.path.join(self._workdir, f"{name}.wav")
        with open(source, "wb") as f:
            f.write(response.content)
        subprocess.run(
            ["ffmpeg", "-y", "-i", source, "-vn", "-ac", "1", "-ar", str(REFERENCE_SAMPLE_RATE), target],
            check=True,
            capture_output=True,
        )
        os.remove(source)
        self._references[reference_url] = target
        while len(self._references) > self._reference_cache_size:
            _, old = self._references.popitem(last=False)
            try:
                os.remove(old)
            except OSError:
                pass
        return target

    def synthesize(
        self,
        text: str,
        reference_path: str,
        language: str,
        cfg_weight: float = 0.5,
        exaggeration: float = 0.5,
        temperature: float = 0.8,
    ) -> bytes:
        """`text` spoken in the voice of the sample at `reference_path`, as WAV bytes at the model's rate."""
        import numpy as np

        text = validate_request(text, language)
        with self._lock:
            self.load()
            pieces = []
            for i, chunk in enumerate(split_text(text)):
                wav = self.model.generate(
                    chunk,
                    language_id=language.lower(),
                    audio_prompt_path=reference_path,
                    exaggeration=exaggeration,
                    cfg_weight=cfg_weight,
                    temperature=temperature,
                )
                if i:
                    pieces.append(np.zeros(int(self.model.sr * CHUNK_PAUSE_SECONDS), dtype=np.float32))
                pieces.append(wav.squeeze(0).detach().cpu().numpy().astype(np.float32))
            return to_wav_bytes(np.concatenate(pieces), self.model.sr)
