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

# Force HOME to the project directory so every library that writes to ~/
# (InsightFace models, pip cache, ONNX cache, etc.) stays inside the
# container's writable data volume.
os.environ["HOME"] = str(ROOT)

# ── Step 1: venv bootstrap ────────────────────────────────────────────────────
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
    # os.execv inherits the updated os.environ (including HOME) automatically
    os.execv(str(_VENV_PYTHON), [str(_VENV_PYTHON)] + sys.argv)
    sys.exit(0)  # unreachable — os.execv replaces the process

# ── Step 2: inside venv — explicitly wire site-packages then set up logging ──
# os.execv preserves the parent's env vars; Pterodactyl may set PYTHONPATH or
# similar vars that prevent the venv's site module from auto-registering its
# site-packages.  Add them explicitly so every import below is guaranteed.
_sp = _VENV / "lib" / f"python{sys.version_info.major}.{sys.version_info.minor}" / "site-packages"
if _sp.exists() and str(_sp) not in sys.path:
    sys.path.insert(0, str(_sp))

sys.path.insert(0, str(ROOT))
from logging_setup import setup
log = setup()

import argparse
import shutil

REQUIREMENTS = ROOT / "requirements.txt"

# Heavy packages installed individually so temp files are cleaned between each.
# pip normally batches all downloads before installing any, which means peak
# disk use = sum of ALL wheel downloads simultaneously.  Installing one at a
# time caps peak to: (already installed) + (one wheel download + extraction).
_SEQUENTIAL_PACKAGES = [
    "numpy>=1.26.0",
    "Pillow>=10.0.0",
    "scipy",
    "scikit-image",
    "onnx",
    "onnxruntime>=1.24.0",
    "opencv-python",
    "insightface>=0.7.3",
]


def _log_df() -> None:
    """Log disk usage for all filesystems so we can see which one is full."""
    r = subprocess.run(["df", "-h"], capture_output=True, text=True)
    log.info("Disk usage:\n%s", r.stdout.strip())


def _pip_run(args: list[str]) -> None:
    """Run pip via shell so TMPDIR is honoured before Python imports tempfile."""
    pip_tmp = ROOT / ".pip-tmp"
    shutil.rmtree(pip_tmp, ignore_errors=True)
    pip_tmp.mkdir()

    # Use a shell wrapper — setting TMPDIR at shell level guarantees it is in
    # effect before pip/Python load the tempfile module (which may cache /tmp).
    pip_cmd = " ".join(
        f'"{a}"' for a in ([str(_VENV_PIP)] + args)
    )
    shell_cmd = (
        f'export TMPDIR="{pip_tmp}" TEMP="{pip_tmp}" TMP="{pip_tmp}"; '
        f'{pip_cmd}'
    )

    result = subprocess.run(
        ["sh", "-c", shell_cmd],
        cwd=ROOT,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        env=os.environ,
    )
    shutil.rmtree(pip_tmp, ignore_errors=True)

    output = result.stdout.strip()
    if result.returncode != 0:
        log.critical("pip failed (exit %s):\n%s", result.returncode, output)
        _log_df()  # show which filesystem ran out of space
        raise subprocess.CalledProcessError(result.returncode, args)
    if output:
        log.debug("pip:\n%s", output)


def pip_install() -> None:
    log.info("Disk state at startup:")
    _log_df()

    _pip_run(["cache", "purge"])

    for pkg in _SEQUENTIAL_PACKAGES:
        log.info("Installing %s …", pkg)
        _pip_run(["install", "--no-cache-dir", pkg])

    log.info("Checking remaining requirements …")
    _pip_run(["install", "--no-cache-dir", "-r", str(REQUIREMENTS)])

    log.info("All dependencies installed.")


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
