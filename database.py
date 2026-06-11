import sqlite3
import numpy as np
import json
import os
from datetime import datetime
from pathlib import Path

DB_PATH = Path(__file__).parent / "faces.db"


def init_db():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("""
        CREATE TABLE IF NOT EXISTS faces (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            image_path TEXT NOT NULL,
            embedding TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
    """)
    conn.commit()
    conn.close()


def add_face(name: str, image_path: str, embedding: np.ndarray) -> int:
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute(
        "INSERT INTO faces (name, image_path, embedding, created_at) VALUES (?, ?, ?, ?)",
        (name, str(image_path), json.dumps(embedding.tolist()), datetime.now().isoformat()),
    )
    face_id = c.lastrowid
    conn.commit()
    conn.close()
    return face_id


def get_all_faces() -> list[dict]:
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT id, name, image_path, embedding, created_at FROM faces ORDER BY created_at DESC")
    rows = c.fetchall()
    conn.close()
    return [
        {
            "id": r[0],
            "name": r[1],
            "image_path": r[2],
            "embedding": np.array(json.loads(r[3]), dtype=np.float32),
            "created_at": r[4],
        }
        for r in rows
    ]


def get_face(face_id: int) -> dict | None:
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT id, name, image_path, embedding, created_at FROM faces WHERE id = ?", (face_id,))
    row = c.fetchone()
    conn.close()
    if not row:
        return None
    return {
        "id": row[0],
        "name": row[1],
        "image_path": row[2],
        "embedding": np.array(json.loads(row[3]), dtype=np.float32),
        "created_at": row[4],
    }


def delete_face(face_id: int) -> str | None:
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT image_path FROM faces WHERE id = ?", (face_id,))
    row = c.fetchone()
    if not row:
        conn.close()
        return None
    c.execute("DELETE FROM faces WHERE id = ?", (face_id,))
    conn.commit()
    conn.close()
    return row[0]


def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-10))


def search_faces(embedding: np.ndarray, threshold: float = 0.40) -> list[dict]:
    faces = get_all_faces()
    matches = []
    for face in faces:
        sim = cosine_similarity(embedding, face["embedding"])
        if sim >= threshold:
            matches.append({
                "id": face["id"],
                "name": face["name"],
                "image_path": face["image_path"],
                "similarity": sim,
                "created_at": face["created_at"],
            })
    matches.sort(key=lambda x: x["similarity"], reverse=True)
    return matches
