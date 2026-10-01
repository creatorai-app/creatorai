# Cypher TTS v2 on any Docker host with an NVIDIA GPU (Cloud Run GPU, a GPU VM, ...).
#   docker build -t cypher-tts services/cypher-tts
#   docker run --gpus all -p 8080:8080 -e CYPHER_TTS_V2_TOKEN=... cypher-tts
# The weights are baked in at build time, so a cold start does not download ~3 GB.
FROM nvidia/cuda:12.4.1-cudnn-runtime-ubuntu22.04

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    HF_HOME=/opt/hf \
    PORT=8080

RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 python3-pip python3-dev git ffmpeg build-essential \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip3 install -r requirements.txt

COPY tts_core.py server.py ./
RUN python3 -c "import tts_core; print(tts_core.download_weights())"

EXPOSE 8080
CMD ["python3", "server.py"]
