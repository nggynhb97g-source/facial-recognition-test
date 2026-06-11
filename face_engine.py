import numpy as np
from PIL import Image
import io
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

ROOT = Path(__file__).parent
# All InsightFace model downloads must stay inside the project directory.
# Default is ~/.insightface which may be outside the container's writable area.
INSIGHTFACE_ROOT = ROOT / ".insightface"

_engine = None


def get_engine():
    global _engine
    if _engine is None:
        _engine = FaceEngine()
    return _engine


class FaceEngine:
    def __init__(self):
        import insightface
        from insightface.app import FaceAnalysis

        INSIGHTFACE_ROOT.mkdir(parents=True, exist_ok=True)
        logger.info("Loading InsightFace model (buffalo_l) — root: %s", INSIGHTFACE_ROOT)
        self.app = FaceAnalysis(
            name="buffalo_l",
            root=str(INSIGHTFACE_ROOT),
            providers=["CPUExecutionProvider"],
        )
        self.app.prepare(ctx_id=-1, det_size=(640, 640))
        logger.info("InsightFace model loaded.")

    def _read_image(self, data: bytes) -> np.ndarray:
        img = Image.open(io.BytesIO(data)).convert("RGB")
        # InsightFace expects BGR (OpenCV convention)
        return np.array(img)[:, :, ::-1]

    def detect_faces(self, data: bytes) -> list:
        img = self._read_image(data)
        return self.app.get(img)

    def get_embedding(self, data: bytes) -> np.ndarray | None:
        """Return the embedding for the largest detected face, or None."""
        faces = self.detect_faces(data)
        if not faces:
            return None
        # Pick the face with the largest bounding box area
        face = max(faces, key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]))
        return face.normed_embedding.astype(np.float32)

    def get_embedding_with_info(self, data: bytes) -> dict:
        faces = self.detect_faces(data)
        if not faces:
            return {"embedding": None, "face_count": 0}
        face = max(faces, key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]))
        return {
            "embedding": face.normed_embedding.astype(np.float32),
            "face_count": len(faces),
            "det_score": float(face.det_score),
        }

    @staticmethod
    def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
        return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-10))

    @staticmethod
    def classify_match(similarity: float) -> dict:
        if similarity >= 0.60:
            return {"is_match": True, "confidence": "High", "label": "MATCH"}
        elif similarity >= 0.40:
            return {"is_match": True, "confidence": "Medium", "label": "LIKELY MATCH"}
        elif similarity >= 0.25:
            return {"is_match": False, "confidence": "Low", "label": "UNLIKELY MATCH"}
        else:
            return {"is_match": False, "confidence": "High", "label": "NO MATCH"}
