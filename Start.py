#!/usr/bin/env python3
"""
FaceID startup — auto-bootstraps a project-local venv then installs deps.
Pterodactyl startup command:  python Start.py
Env vars: SERVER_PORT (Pterodactyl), PORT (fallback), default 8000.
"""
import sys
import os
import subprocess
from pathlib import Path

ROOT = Path(__file__).parent

# ── Step 1: venv bootstrap ────────────────────────────────────────────────────
# Run everything inside a project-local venv so pip always has a writable
# target (avoids "site-packages not writeable" in restricted containers).
_VENV        = ROOT / ".venv"
_VENV_PYTHON = _VENV / ("Scripts/python.exe" if sys.platform == "win32" else "bin/python")
_VENV_PIP    = _VENV / ("Scripts/pip.exe"    if sys.platform == "win32" else "bin/pip")

_inside_venv = _VENV_PYTHON.exists() and Path(sys.executable).resolve() == _VENV_PYTHON.resolve()

if not _inside_venv:
    if not _VENV_PYTHON.exists():
        print("[FaceID] Creating virtual environment (.venv/) …", flush=True)
        try:
            subprocess.check_call([sys.executable, "-m", "venv", str(_VENV)])
            print("[FaceID] Virtual environment ready.", flush=True)
        except subprocess.CalledProcessError as exc:
            print(f"[FaceID] FATAL: could not create venv: {exc}", flush=True)
            sys.exit(1)
    # Replace this process with the venv Python running the same script
    os.execv(str(_VENV_PYTHON), [str(_VENV_PYTHON)] + sys.argv)
    sys.exit(0)  # unreachable — os.execv replaces the process

# ── Step 2: inside venv — logging first, then everything else ────────────────
sys.path.insert(0, str(ROOT))
from logging_setup import setup
log = setup()

import argparse

REQUIREMENTS = ROOT / "requirements.txt"


def pip_install() -> None:
    log.info("Installing dependencies into .venv/ …")
    result = subprocess.run(
        [str(_VENV_PIP), "install", "-r", str(REQUIREMENTS)],
        cwd=ROOT,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )
    output = result.stdout.strip()
    if result.returncode == 0:
        if output:
            log.debug("pip output:\n%s", output)
        log.info("Dependencies installed successfully.")
    else:
        log.critical("pip install failed (exit code %s):\n%s", result.returncode, output)
        raise subprocess.CalledProcessError(result.returncode, result.args)


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
        log_config=None,  # preserve our logging config
    )


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        log.info("Server stopped (KeyboardInterrupt)")
    except Exception:
        log.critical("Fatal error — server is shutting down", exc_info=True)
        sys.exit(1)
