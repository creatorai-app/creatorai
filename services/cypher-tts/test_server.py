"""CPU-only tests for the request handling in server.py, with the model replaced.

  cd services/cypher-tts && pip install -r requirements-test.txt && python -m pytest -q
"""

import io
import wave

import numpy as np
import pytest
from fastapi.testclient import TestClient

import tts_core
from server import create_app


class FakeEngine:
    """Stands in for TtsEngine: records calls, returns a short WAV, loads nothing."""

    loaded = True

    def __init__(self):
        self.calls = []
        self.fetched = []

    def load(self):
        raise AssertionError("tests must not load the model")

    def reference_path(self, url):
        self.fetched.append(url)
        if "broken" in url:
            raise OSError("404")
        return "/tmp/ref.wav"

    def synthesize(self, text, reference, language, **params):
        self.calls.append({"text": text, "reference": reference, "language": language, **params})
        return tts_core.to_wav_bytes(np.zeros(2400, dtype=np.float32), 24000)


def client(token=None):
    engine = FakeEngine()
    return TestClient(create_app(engine, token=token, load_on_start=False)), engine


BODY = {"text": "Hola, qué tal.", "reference_url": "https://storage.googleapis.com/b/S1.wav", "language": "es"}


def test_synthesizes_with_defaults():
    c, engine = client()
    response = c.post("/synthesize", json=BODY)
    assert response.status_code == 200
    assert response.headers["content-type"] == "audio/wav"
    with wave.open(io.BytesIO(response.content)) as w:
        assert w.getframerate() == 24000 and w.getnchannels() == 1
    assert engine.calls == [{
        "text": "Hola, qué tal.", "reference": "/tmp/ref.wav", "language": "es",
        "cfg_weight": 0.5, "exaggeration": 0.5, "temperature": 0.8,
    }]


def test_passes_the_voice_controls():
    c, engine = client()
    c.post("/synthesize", json={**BODY, "cfg_weight": 0, "exaggeration": 0.7, "temperature": 0.6})
    assert engine.calls[0]["cfg_weight"] == 0
    assert engine.calls[0]["exaggeration"] == 0.7


def test_rejects_an_unsupported_language_with_400():
    c, engine = client()
    response = c.post("/synthesize", json={**BODY, "language": "bn"})
    assert response.status_code == 400
    assert "not supported" in response.json()["detail"]
    assert engine.calls == []


def test_accepts_a_language_in_any_case():
    c, engine = client()
    assert c.post("/synthesize", json={**BODY, "language": "ES"}).status_code == 200
    assert engine.calls[0]["language"] == "es"


def test_rejects_text_over_the_turn_cap_with_400():
    c, engine = client()
    assert c.post("/synthesize", json={**BODY, "text": "a" * tts_core.MAX_TEXT_CHARS}).status_code == 200
    response = c.post("/synthesize", json={**BODY, "text": "a" * (tts_core.MAX_TEXT_CHARS + 1)})
    assert response.status_code == 400
    assert "at most 300" in response.json()["detail"]
    assert len(engine.calls) == 1


def test_rejects_empty_text():
    c, _ = client()
    assert c.post("/synthesize", json={**BODY, "text": "   "}).status_code == 400


def test_rejects_a_voice_sample_that_cannot_be_read():
    c, engine = client()
    response = c.post("/synthesize", json={**BODY, "reference_url": "https://x/broken.wav"})
    assert response.status_code == 400
    assert engine.calls == []


def test_rejects_malformed_requests():
    c, _ = client()
    assert c.post("/synthesize", json={**BODY, "reference_url": "file:///etc/passwd"}).status_code == 422
    assert c.post("/synthesize", json={**BODY, "cfg_weight": 3}).status_code == 422
    assert c.post("/synthesize", json={"text": "hi"}).status_code == 422


def test_token_is_required_when_configured():
    c, engine = client(token="secret")
    assert c.post("/synthesize", json=BODY).status_code == 401
    assert c.post("/synthesize", json=BODY, headers={"Authorization": "Bearer wrong"}).status_code == 401
    assert c.post("/synthesize", json=BODY, headers={"Authorization": "Bearer secret"}).status_code == 200
    assert len(engine.calls) == 1


def test_open_without_a_token():
    c, _ = client(token="  ")
    assert c.post("/synthesize", json=BODY).status_code == 200


def test_health_needs_no_token():
    c, _ = client(token="secret")
    assert c.get("/health").json() == {"ok": True, "model": "chatterbox-multilingual-v3", "loaded": True}


@pytest.mark.parametrize(
    "text, expected",
    [
        ("One. Two.", ["One. Two."]),
        ("A" * 140 + ". " + "B" * 140 + ".", ["A" * 140 + ".", "B" * 140 + "."]),
        ("你好。" * 3, ["你好。你好。你好。"]),
    ],
)
def test_split_text_keeps_whole_sentences(text, expected):
    assert tts_core.split_text(text) == expected


def test_engine_joins_chunks_with_a_pause():
    engine = tts_core.TtsEngine()

    class Tensor:
        # Just what synthesize() calls on the model's output.
        def __init__(self, values):
            self.values = values

        def squeeze(self, _):
            return self

        def detach(self):
            return self

        def cpu(self):
            return self

        def numpy(self):
            return self.values

    class Model:
        sr = 1000

        def generate(self, chunk, **kwargs):
            return Tensor(np.full(100, 0.5, dtype=np.float32))

    engine.model = Model()
    wav = engine.synthesize("A" * 140 + ". " + "B" * 140 + ".", "/tmp/ref.wav", "en")
    with wave.open(io.BytesIO(wav)) as w:
        frames = np.frombuffer(w.readframes(w.getnframes()), dtype="<i2")
    # 100 samples, 150 ms (150 samples at 1 kHz) of silence, 100 samples.
    assert len(frames) == 350
    assert (frames[100:250] == 0).all() and (frames[:100] > 0).all()


def test_the_supported_list_matches_the_worker():
    # packages/validations CHATTERBOX_LANGUAGES holds the same 23.
    assert len(tts_core.SUPPORTED_LANGUAGES) == 23
