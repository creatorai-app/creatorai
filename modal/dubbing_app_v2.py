# Creator AI: Cypher TTS v2 on Modal (serverless GPU).
#
# A thin wrapper. The model code and the HTTP app live in services/cypher-tts
# (tts_core.py, server.py); this file only packages them for Modal, the same way the
# Dockerfile there packages them for Cloud Run GPU or any Docker GPU host. Moving hosts
# never means rewriting the model code.
#
# NOT the frozen app. modal/dubbing_app.py ("creator-ai-dubbing") is what is deployed
# today and must stay byte for byte as it is. This is a separate app,
# "creator-ai-dubbing-v2", with its own URL. Deploying it needs a payment method on the
# Modal workspace (GPU functions require one).
#
# Deploy:
#   modal secret create cypher-tts-v2 CYPHER_TTS_V2_TOKEN=<a long random string>
#   modal deploy modal/dubbing_app_v2.py
# The deploy prints the app's URL, e.g. https://<you>--creator-ai-dubbing-v2-tts-web.modal.run
# Set on the worker:
#   CYPHER_TTS_V2_URL=<that URL>          (the worker appends /synthesize)
#   CYPHER_TTS_V2_TOKEN=<the same token>
# Check it: curl <that URL>/health

import os
import pathlib

import modal

SERVICE_DIR = pathlib.Path(__file__).resolve().parent.parent / "services" / "cypher-tts"

image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("ffmpeg", "git")
    .pip_install_from_requirements(str(SERVICE_DIR / "requirements.txt"))
    .env({"HF_HOME": "/root/hf"})
    .add_local_file(str(SERVICE_DIR / "tts_core.py"), "/root/tts_core.py", copy=True)
    .add_local_file(str(SERVICE_DIR / "server.py"), "/root/server.py", copy=True)
    # Weights baked into the image, so a cold start does not download them.
    .run_commands("cd /root && python -c 'import tts_core; print(tts_core.download_weights())'")
)

app = modal.App("creator-ai-dubbing-v2", image=image)


@app.cls(gpu="L4", scaledown_window=120, timeout=900, secrets=[modal.Secret.from_name("cypher-tts-v2")])
class Tts:
    @modal.enter()
    def load(self):
        from tts_core import TtsEngine

        self.engine = TtsEngine()
        self.engine.load()

    @modal.asgi_app()
    def web(self):
        from server import create_app

        return create_app(self.engine, token=os.environ.get("CYPHER_TTS_V2_TOKEN"), load_on_start=False)
