#!/usr/bin/env python3
"""
Auto-installs all dependencies and starts the FaceID server.
Usage:  python start.py [--port 8000] [--host 0.0.0.0]

Pterodactyl: set SERVER_PORT (or PORT) in the egg environment variables.
The startup command should be:  python start.py
"""
import subprocess
import sys
import os
import argparse
from pathlib import Path

ROOT = Path(__file__).parent
REQUIREMENTS = ROOT / "requirements.txt"


def pip_install():
    print("[FaceID] Installing Python dependencies…")
    subprocess.check_call(
        [sys.executable, "-m", "pip", "install", "-r", str(REQUIREMENTS), "--quiet"],
        cwd=ROOT,
    )
    print("[FaceID] Dependencies installed.")


def ensure_dirs():
    (ROOT / "known_faces").mkdir(exist_ok=True)
    (ROOT / "static").mkdir(exist_ok=True)


def main():
    # Pterodactyl injects SERVER_PORT; fall back to PORT, then 8000
    default_port = int(os.environ.get("SERVER_PORT", os.environ.get("PORT", 8000)))

    parser = argparse.ArgumentParser(description="FaceID — Facial Recognition WebUI")
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=default_port)
    parser.add_argument("--no-install", action="store_true", help="Skip pip install")
    parser.add_argument("--reload", action="store_true", help="Enable hot reload (dev mode)")
    args = parser.parse_args()

    if not args.no_install:
        pip_install()

    ensure_dirs()

    print(f"\n[FaceID] Starting server on http://{args.host}:{args.port}")
    print("[FaceID] InsightFace model will download automatically on first request (~200 MB)\n")

    import uvicorn
    uvicorn.run(
        "app:app",
        host=args.host,
        port=args.port,
        reload=args.reload,
        log_level="info",
    )


if __name__ == "__main__":
    main()
