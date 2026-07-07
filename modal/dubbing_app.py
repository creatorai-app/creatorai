# Creator AI — dubbing clone service (Modal, serverless GPU).
#
# Implements the contract the worker calls (packages/workers/.../dubbing.processor.ts):
#   POST <MODAL_API_URL>
#     { text, reference_url, is_video, language, output_put_url, output_content_type }
#   -> streams the dubbed file straight to GCS via output_put_url, returns { "ok": true }
#
# It fetches reference_url (a public GCS URL), extracts audio if is_video, clones the
# speaker's voice from it and synthesizes `text` in `language` using Chatterbox
# Multilingual (MIT license, 23 languages). The result is uploaded directly to GCS with
# the pre-signed PUT URL the API minted, so the dubbed media (a video can be hundreds of
# MB) never round-trips through the Node worker. Scales to zero between requests.
#
# Back-compat: if output_put_url is omitted, it falls back to returning the raw bytes
# (handy for `modal run` / curl testing).
#
# Deploy:  modal deploy modal/dubbing_app.py
# The deploy prints a dedicated URL for this endpoint, e.g.
#   https://<you>--creator-ai-dubbing-dub.modal.run
# Set MODAL_API_URL to EXACTLY that printed URL — Modal web endpoints each get their
# own hostname, there is no "/dub" path on top of it. The worker POSTs to MODAL_API_URL
# directly, with nothing appended.

import subprocess
import tempfile

import modal

image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("ffmpeg")
    .pip_install("chatterbox-tts", "torch", "torchaudio", "requests", "fastapi[standard]")
)

app = modal.App("creator-ai-dubbing", image=image)

# Chatterbox caps generation length; split long translations into sentence-ish chunks
# and concatenate. ponytail: naive split on sentence enders — good enough for speech;
# swap for a real segmenter if long inputs clip mid-word.
def _chunk(text: str, max_chars: int = 300):
    import re
    parts, buf = [], ""
    for sentence in re.split(r"(?<=[.!?。！？])\s+", text.strip()):
        if len(buf) + len(sentence) + 1 <= max_chars:
            buf = f"{buf} {sentence}".strip()
        else:
            if buf:
                parts.append(buf)
            buf = sentence
    if buf:
        parts.append(buf)
    return parts or [text]


@app.cls(gpu="L4", scaledown_window=120, timeout=900)
class Dubber:
    @modal.enter()
    def load(self):
        import torch
        from chatterbox.mtl_tts import ChatterboxMultilingualTTS

        self.torch = torch
        self.model = ChatterboxMultilingualTTS.from_pretrained(
            device="cuda" if torch.cuda.is_available() else "cpu"
        )

    def _download(self, url: str) -> str:
        import requests

        resp = requests.get(url, timeout=120)
        resp.raise_for_status()
        src = tempfile.NamedTemporaryFile(suffix=".bin", delete=False)
        src.write(resp.content)
        src.flush()
        return src.name

    def _extract_reference(self, src_path: str) -> str:
        # Normalize to 16k mono wav whether the source is audio or video — the clone
        # model wants a clean reference sample.
        wav_path = tempfile.NamedTemporaryFile(suffix=".wav", delete=False).name
        subprocess.run(
            ["ffmpeg", "-y", "-i", src_path, "-vn", "-ac", "1", "-ar", "16000", wav_path],
            check=True,
            capture_output=True,
        )
        return wav_path

    def _mux(self, video_path: str, audio_path: str) -> str:
        # Replace the video's audio track with the dubbed audio. ponytail: -shortest
        # trims to whichever stream is shorter — translated speech rarely matches the
        # original length, so there is drift. Good enough for preview; true lip-sync
        # (segment alignment / a sync model) is the upgrade path.
        out_path = tempfile.NamedTemporaryFile(suffix=".mp4", delete=False).name
        subprocess.run(
            ["ffmpeg", "-y", "-i", video_path, "-i", audio_path,
             "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy", "-c:a", "aac",
             "-shortest", "-movflags", "+faststart", out_path],
            check=True,
            capture_output=True,
        )
        return out_path

    def _upload(self, path: str, put_url: str, content_type: str):
        # Stream the file to the pre-signed GCS PUT URL. `data=<file object>` makes
        # requests stream from disk in chunks — the file is never fully read into memory,
        # so a big MP4 stays off the heap on both ends. Content-Type MUST match what the
        # URL was signed with (the API binds it), or GCS rejects the PUT.
        import requests

        with open(path, "rb") as f:
            resp = requests.put(
                put_url,
                data=f,
                headers={"Content-Type": content_type},
                timeout=600,
            )
        resp.raise_for_status()

    @modal.fastapi_endpoint(method="POST", docs=True)
    def dub(self, payload: dict):
        from fastapi import Response
        import torchaudio

        text = (payload.get("text") or "").strip()
        reference_url = payload.get("reference_url")
        language = payload.get("language") or "en"
        is_video = bool(payload.get("is_video"))
        output_put_url = payload.get("output_put_url")
        output_content_type = payload.get("output_content_type") or (
            "video/mp4" if is_video else "audio/wav"
        )
        if not text or not reference_url:
            return Response(content="text and reference_url are required", status_code=400)

        # Download the source once; reuse it for both the voice reference and (video) mux.
        src_path = self._download(reference_url)
        ref = self._extract_reference(src_path)

        segments = []
        for chunk in _chunk(text):
            wav = self.model.generate(chunk, language_id=language, audio_prompt_path=ref)
            segments.append(wav)
        audio = self.torch.cat(segments, dim=-1) if len(segments) > 1 else segments[0]

        dubbed_wav = tempfile.NamedTemporaryFile(suffix=".wav", delete=False).name
        torchaudio.save(dubbed_wav, audio.cpu(), self.model.sr)

        # Video in → mux the dubbed audio over the original video (MP4); audio in → the WAV.
        out_path = self._mux(src_path, dubbed_wav) if is_video else dubbed_wav
        media_type = "video/mp4" if is_video else "audio/wav"

        # Preferred path: upload straight to GCS, keeping the bytes off the worker.
        if output_put_url:
            self._upload(out_path, output_put_url, output_content_type)
            return {"ok": True}

        # Fallback (no output_put_url): return the bytes — for local `modal run` / curl.
        with open(out_path, "rb") as f:
            return Response(content=f.read(), media_type=media_type)
