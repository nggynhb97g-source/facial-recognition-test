import os
import uuid
import logging
from pathlib import Path

from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware

import database as db
from face_engine import get_engine

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB


def _spatial(info: dict) -> dict | None:
    if not info.get("landmarks"):
        return None
    return {"landmarks": info["landmarks"], "lm_count": info["lm_count"], "bbox": info["bbox"]}

async def read_limited(upload: UploadFile) -> bytes:
    data = await upload.read(MAX_UPLOAD_BYTES + 1)
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, detail="File too large (max 10 MB)")
    return data

BASE_DIR = Path(__file__).parent
KNOWN_FACES_DIR = BASE_DIR / "known_faces"
STATIC_DIR = BASE_DIR / "static"

KNOWN_FACES_DIR.mkdir(exist_ok=True)
STATIC_DIR.mkdir(exist_ok=True)

db.init_db()

app = FastAPI(title="FaceID — Facial Recognition", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/known_faces", StaticFiles(directory=KNOWN_FACES_DIR), name="known_faces")
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.get("/")
async def index():
    return FileResponse(STATIC_DIR / "index.html")


@app.post("/api/compare")
async def compare_faces(
    image1: UploadFile = File(..., description="First face image"),
    image2: UploadFile = File(..., description="Second face image"),
):
    engine = get_engine()

    data1 = await read_limited(image1)
    data2 = await read_limited(image2)

    try:
        info1 = engine.get_embedding_with_info(data1)
        info2 = engine.get_embedding_with_info(data2)
    except ValueError as exc:
        raise HTTPException(400, detail=str(exc))

    if info1["embedding"] is None:
        raise HTTPException(400, detail="No face detected in Image 1")
    if info2["embedding"] is None:
        raise HTTPException(400, detail="No face detected in Image 2")

    similarity = engine.cosine_similarity(info1["embedding"], info2["embedding"])
    result = engine.classify_match(similarity)

    return {
        "similarity": round(similarity, 4),
        "similarity_pct": round(similarity * 100, 1),
        **result,
        "face_count_1": info1["face_count"],
        "face_count_2": info2["face_count"],
        "det_score_1": round(info1.get("det_score", 0), 3),
        "det_score_2": round(info2.get("det_score", 0), 3),
        "face1_spatial": _spatial(info1),
        "face2_spatial": _spatial(info2),
    }


@app.post("/api/add")
async def add_face(
    name: str = Form(..., description="Person's name"),
    image: UploadFile = File(..., description="Face image"),
):
    engine = get_engine()

    data = await read_limited(image)
    try:
        info = engine.get_embedding_with_info(data)
    except ValueError as exc:
        raise HTTPException(400, detail=str(exc))

    if info["embedding"] is None:
        raise HTTPException(400, detail="No face detected in the image")

    # Save image to known_faces/
    ext = Path(image.filename).suffix.lower() if image.filename else ".jpg"
    if ext not in {".jpg", ".jpeg", ".png", ".webp"}:
        ext = ".jpg"
    filename = f"{uuid.uuid4()}{ext}"
    save_path = KNOWN_FACES_DIR / filename

    with open(save_path, "wb") as f:
        f.write(data)

    face_id = db.add_face(name.strip(), str(save_path), info["embedding"])

    return {
        "id": face_id,
        "name": name.strip(),
        "image_url": f"/known_faces/{filename}",
        "face_count": info["face_count"],
        "face_spatial": _spatial(info),
        "message": "Face added to database successfully",
    }


@app.get("/api/faces")
async def list_faces():
    faces = db.get_all_faces()
    result = []
    for f in faces:
        img_path = Path(f["image_path"])
        img_url = f"/known_faces/{img_path.name}" if img_path.exists() else None
        result.append({
            "id": f["id"],
            "name": f["name"],
            "image_url": img_url,
            "created_at": f["created_at"],
        })
    return result


@app.delete("/api/faces/{face_id}")
async def delete_face(face_id: int):
    image_path = db.delete_face(face_id)
    if image_path:
        p = Path(image_path)
        if p.exists():
            p.unlink()
    return {"message": "Deleted successfully"}


@app.post("/api/search")
async def search_face(
    image: UploadFile = File(..., description="Face image to search for"),
    threshold: float = 0.40,
):
    engine = get_engine()

    data = await read_limited(image)
    try:
        info = engine.get_embedding_with_info(data)
    except ValueError as exc:
        raise HTTPException(400, detail=str(exc))

    if info["embedding"] is None:
        raise HTTPException(400, detail="No face detected in the image")

    matches = db.search_faces(info["embedding"], threshold=threshold)

    result = []
    for m in matches:
        img_path = Path(m["image_path"])
        result.append({
            "id": m["id"],
            "name": m["name"],
            "image_url": f"/known_faces/{img_path.name}" if img_path.exists() else None,
            "similarity": round(m["similarity"], 4),
            "similarity_pct": round(m["similarity"] * 100, 1),
            "created_at": m["created_at"],
            **engine.classify_match(m["similarity"]),
        })

    return {"matches": result, "total": len(result), "face_spatial": _spatial(info)}


@app.get("/api/health")
async def health():
    return {"status": "ok", "model": "buffalo_l"}
