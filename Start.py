#!/usr/bin/env python3
"""
Auto-installs all dependencies and starts the FaceID server.
Startup command (Pterodactyl):  python Start.py

Pterodactyl env vars:
  SERVER_PORT  — port to bind (set automatically by the panel)
  PORT         — fallback port env var
"""
import sys
import os
from pathlib import Path

ROOT = Path(__file__).parent
sys.path.insert(0, str(ROOT))

# ── Logging must be the very first thing so even pip/import errors are captured
from logging_setup import setup
log = setup()

import subprocess
import argparse

REQUIREMENTS = ROOT / "requirements.txt"


def pip_install() -> None:
    log.info("Installing Python dependencies from requirements.txt …")
    try:
        subprocess.check_call(
            [sys.executable, "-m", "pip", "install", "-r", str(REQUIREMENTS), "--quiet"],
            cwd=ROOT,
        )
        log.info("Dependencies installed successfully.")
    except subprocess.CalledProcessError as exc:
        log.critical("pip install failed (exit code %s)", exc.returncode, exc_info=True)
        raise


def ensure_dirs() -> None:
    (ROOT / "known_faces").mkdir(exist_ok=True)
    (ROOT / "static").mkdir(exist_ok=True)


def main() -> None:
    default_port = int(os.environ.get("SERVER_PORT", os.environ.get("PORT", 8000)))

    parser = argparse.ArgumentParser(description="FaceID — Facial Recognition WebUI")
    parser.add_argument("--host",       default="0.0.0.0")
    parser.add_argument("--port",       type=int, default=default_port)
    parser.add_argument("--no-install", action="store_true", help="Skip pip install")
    parser.add_argument("--reload",     action="store_true", help="Hot-reload (dev only)")
    args = parser.parse_args()

    if not args.no_install:
        pip_install()

    ensure_dirs()

    log.info("Starting FaceID on http://%s:%s", args.host, args.port)
    log.info("InsightFace model downloads automatically on first request (~200 MB)")

    import uvicorn
    uvicorn.run(
        "app:app",
        host=args.host,
        port=args.port,
        reload=args.reload,
        log_level="info",
        log_config=None,  # don't let uvicorn overwrite our logging config
    )


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        log.info("Server stopped (KeyboardInterrupt)")
    except Exception:
        log.critical("Fatal error — server is shutting down", exc_info=True)
        sys.exit(1)
