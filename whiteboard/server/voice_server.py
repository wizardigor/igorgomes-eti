"""Servidor experimental privado; modelo instalado separadamente pelo operador."""
import asyncio
import os
import tempfile
import threading
from pathlib import Path

import soundfile as sf
from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

app = FastAPI(title="IG Whiteboard — voz de referência")
origins = os.environ.get("WHITEBOARD_ORIGINS", "http://localhost:8000,http://127.0.0.1:8000").split(",")
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_methods=["POST"], allow_headers=["Content-Type"])
lock = threading.Lock()
model = None

def render(text, data):
    global model
    with lock, tempfile.TemporaryDirectory() as tmp:
        src, out = Path(tmp, "reference.wav"), Path(tmp, "result.wav")
        src.write_bytes(data)
        try:
            info = sf.info(src)
            if info.format != "WAV" or not 6 <= info.duration <= 30:
                raise ValueError()
        except Exception:
            raise HTTPException(422, "Use WAV de 6 a 30 segundos.") from None
        path = os.environ.get("WHITEBOARD_XTTS_MODEL")
        if not path or not Path(path, "config.json").is_file():
            raise HTTPException(503, "Configure um modelo XTTS instalado e licenciado.")
        if model is None:
            from TTS.api import TTS
            model = TTS(model_path=path, config_path=str(Path(path, "config.json"))).to(os.environ.get("WHITEBOARD_DEVICE", "cpu"))
        model.tts_to_file(text=text, speaker_wav=str(src), language="pt", file_path=str(out))
        return out.read_bytes()

@app.post("/synthesize")
async def synthesize(request: Request, text: str = Form(...), reference: UploadFile = File(...)):
    if request.headers.get("origin") not in origins:
        raise HTTPException(403, "Origem não autorizada.")
    if not text.strip() or len(text) > 3000:
        raise HTTPException(422, "Informe até 3000 caracteres.")
    data = await reference.read(10 * 1024 * 1024 + 1)
    if len(data) > 10 * 1024 * 1024:
        raise HTTPException(413, "Referência acima de 10 MB.")
    if lock.locked():
        raise HTTPException(429, "Já existe uma geração em andamento.")
    wav = await asyncio.to_thread(render, text, data)
    return Response(wav, media_type="audio/wav", headers={"Cache-Control": "no-store"})
