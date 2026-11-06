from pathlib import Path
from tempfile import NamedTemporaryFile

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from backend.external_apis import CARTESIA_POOL, GEMINI_POOL
from backend.predict import PredictionInputError, load_metrics, predict_risk

app = FastAPI(title="Mental Health Risk Check")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5173", "http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)
AUDIO_SUFFIXES = {".wav", ".mp3", ".ogg", ".flac", ".m4a"}
IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp", ".gif"}


@app.get("/health")
def health():
    return {
        "status": "ok",
        "gemini_keys": len(GEMINI_POOL),
        "cartesia_keys": len(CARTESIA_POOL),
    }


@app.get("/metrics")
def metrics():
    return load_metrics()


def kept_suffix(filename, allowed, fallback):
    suffix = Path(filename or "").suffix.lower()
    if suffix in allowed:
        return suffix
    return fallback


@app.post("/predict")
async def predict(
    text: str = Form(""),
    hour: float | None = Form(None),
    karma: float | None = Form(None),
    upvote_ratio: float | None = Form(None),
    comment_count: float | None = Form(None),
    sleep: str | None = Form(None),
    energy: str | None = Form(None),
    company: str | None = Form(None),
    routine: str | None = Form(None),
    audio: UploadFile | None = File(None),
    image: UploadFile | None = File(None),
):
    audio_path = None
    image_path = None
    if audio is not None and audio.filename:
        temporary = NamedTemporaryFile(delete=False, suffix=kept_suffix(audio.filename, AUDIO_SUFFIXES, ".wav"))
        temporary.write(await audio.read())
        temporary.close()
        audio_path = temporary.name
    if image is not None and image.filename:
        temporary = NamedTemporaryFile(delete=False, suffix=kept_suffix(image.filename, IMAGE_SUFFIXES, ".png"))
        temporary.write(await image.read())
        temporary.close()
        image_path = temporary.name
    try:
        return predict_risk(
            text,
            hour,
            karma,
            upvote_ratio,
            comment_count,
            audio_path,
            image_path,
            sleep=sleep,
            energy=energy,
            company=company,
            routine=routine,
        )
    except PredictionInputError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    finally:
        for path in (audio_path, image_path):
            if path is not None:
                Path(path).unlink(missing_ok=True)
