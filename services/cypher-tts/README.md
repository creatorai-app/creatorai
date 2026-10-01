# Cypher TTS v2

Chatterbox Multilingual V3 behind a small HTTP API, for Cypher dubbing. Host-agnostic:
the same code runs on Modal, Cloud Run GPU or any Docker host with an NVIDIA GPU. The
worker uses it when `CYPHER_TTS_V2_URL` is set, and the frozen Modal app
(`modal/dubbing_app.py`) otherwise.

| File | What it is |
|---|---|
| `tts_core.py` | The model: load once, `synthesize(text, reference_path, language, cfg_weight, exaggeration, temperature) -> wav bytes` |
| `server.py` | FastAPI app: `POST /synthesize`, `GET /health`, optional bearer token |
| `Dockerfile` | CUDA 12.4 image running `server.py` on port 8080, weights baked in |
| `test_server.py` | CPU-only tests of the request handling, model replaced |
| `../../modal/dubbing_app_v2.py` | The Modal wrapper (a new app, `creator-ai-dubbing-v2`) |

## Contract

```
POST /synthesize
Authorization: Bearer <CYPHER_TTS_V2_TOKEN>      (only when the server has a token)
{ "text": "...", "reference_url": "https://...", "language": "es",
  "cfg_weight": 0.5, "exaggeration": 0.5, "temperature": 0.8 }   (the last three optional)
-> 200 audio/wav, mono, at the model's rate (24 kHz)
-> 400 empty text, text over 300 characters (the worker's turn cap), a language the
       model does not speak, or a voice sample that cannot be read
-> 401 missing or wrong token
-> 422 malformed body (bad URL scheme, out-of-range parameters)

GET /health -> { "ok": true, "model": "chatterbox-multilingual-v3", "loaded": true }
```

Compared with the frozen Modal app it uses the V3 checkpoint, keeps voice samples at
24 kHz, takes `cfg_weight` / `exaggeration` / `temperature`, puts 150 ms of silence
between the chunks of a longer text, and refuses unsupported languages and oversized
text instead of speaking them.

`chatterbox-tts` is pinned to the V3 release commit
(`65b18437192794391a0308a8f705b1e33e633948`): no PyPI release has `t3_model="v3"` yet
(0.1.7 does not). Move to a PyPI version once one ships with it.

## Deploy on Modal

Needs a payment method on the Modal workspace.

```bash
modal secret create cypher-tts-v2 CYPHER_TTS_V2_TOKEN=$(openssl rand -hex 32)
modal deploy modal/dubbing_app_v2.py
curl https://<you>--creator-ai-dubbing-v2-tts-web.modal.run/health
```

## Build and run the Docker image

```bash
docker build -t cypher-tts services/cypher-tts
docker run --gpus all -p 8080:8080 -e CYPHER_TTS_V2_TOKEN=<token> cypher-tts
curl localhost:8080/health
curl -X POST localhost:8080/synthesize -H "Authorization: Bearer <token>" \
  -H 'Content-Type: application/json' \
  -d '{"text":"Hola, ¿qué tal?","reference_url":"https://storage.googleapis.com/<bucket>/<voice>.wav","language":"es"}' \
  -o out.wav
```

Push the image to your registry and deploy it on the GPU host you pick. The first
request after a cold start loads the model (about 30 s on an L4).

## Point the worker at it

```
CYPHER_TTS_V2_URL=<base URL, no path>   # the worker calls <base>/synthesize
CYPHER_TTS_V2_TOKEN=<the same token>
```

Set `CYPHER_TTS_V2_URL` on the API as well to show the voice mode on Cypher in the
new-dub form (the API only checks that it is set).

## Tests

```bash
cd services/cypher-tts
python -m venv .venv && . .venv/bin/activate
pip install -r requirements-test.txt
python -m pytest -q
python -m py_compile tts_core.py server.py test_server.py ../../modal/dubbing_app_v2.py
```
