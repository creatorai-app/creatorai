"""Cypher TTS v2 over HTTP: POST /synthesize and GET /health.

A plain FastAPI app, the same on every host: the Docker image in this folder runs it
with uvicorn (Cloud Run GPU or any Docker GPU host), and modal/dubbing_app_v2.py serves
it on Modal. The worker calls it when CYPHER_TTS_V2_URL is set
(packages/workers/src/processor/utils/cypher-tts.ts).

  POST /synthesize
    { text, reference_url, language, cfg_weight?, exaggeration?, temperature? }
    -> audio/wav at the model's sample rate
    400 when the text is empty or longer than a worker turn, or the language is not one
    the model speaks; 401 when a token is configured and the request does not carry it.

  GET /health -> { ok, model, loaded }

Auth: set CYPHER_TTS_V2_TOKEN on the server and the same value on the worker; requests
must then send `Authorization: Bearer <token>`. With no token set, the server is open,
so keep it on a private network.
"""

from __future__ import annotations

import hmac
import os
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import Depends, FastAPI, Header, HTTPException, Response
from pydantic import BaseModel, Field

from tts_core import MAX_TEXT_CHARS, RequestError, TtsEngine, validate_request


class SynthesizeRequest(BaseModel):
    text: str = Field(..., max_length=MAX_TEXT_CHARS * 4)
    reference_url: str = Field(..., pattern=r"^https?://")
    language: str
    cfg_weight: float = Field(0.5, ge=0.0, le=1.0)
    exaggeration: float = Field(0.5, ge=0.0, le=2.0)
    temperature: float = Field(0.8, gt=0.0, le=2.0)


def create_app(engine: TtsEngine, token: Optional[str] = None, load_on_start: bool = True) -> FastAPI:
    """The app around one engine. Tests pass a stand-in engine and load_on_start=False."""
    token = (token or "").strip() or None

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        if load_on_start:
            engine.load()
        yield

    app = FastAPI(title="Cypher TTS v2", lifespan=lifespan)

    def authorize(authorization: Optional[str] = Header(default=None)) -> None:
        if token is None:
            return
        expected = f"Bearer {token}"
        if not authorization or not hmac.compare_digest(authorization.encode(), expected.encode()):
            raise HTTPException(status_code=401, detail="missing or wrong bearer token")

    @app.get("/health")
    def health() -> dict:
        return {"ok": True, "model": "chatterbox-multilingual-v3", "loaded": engine.loaded}

    # A plain def: FastAPI runs it on a worker thread, so a long generation does not
    # block /health. The engine serialises GPU use itself.
    @app.post("/synthesize", dependencies=[Depends(authorize)])
    def synthesize(request: SynthesizeRequest) -> Response:
        try:
            text = validate_request(request.text, request.language)
        except RequestError as error:
            raise HTTPException(status_code=400, detail=str(error))
        try:
            reference = engine.reference_path(request.reference_url)
        except Exception as error:  # the sample could not be fetched or decoded
            raise HTTPException(status_code=400, detail=f"could not read the voice sample: {error}")
        wav = engine.synthesize(
            text,
            reference,
            request.language.lower(),
            cfg_weight=request.cfg_weight,
            exaggeration=request.exaggeration,
            temperature=request.temperature,
        )
        return Response(content=wav, media_type="audio/wav")

    return app


def app_from_env() -> FastAPI:
    return create_app(TtsEngine(), token=os.environ.get("CYPHER_TTS_V2_TOKEN"))


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app_from_env(), host="0.0.0.0", port=int(os.environ.get("PORT", "8080")))
