#!/usr/bin/env bash
# One-shot launcher: installs deps and starts the FaceID WebUI
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo ""
echo "╔══════════════════════════════════════╗"
echo "║          FaceID — Launcher           ║"
echo "╚══════════════════════════════════════╝"
echo ""

# Check Python
if ! command -v python3 &>/dev/null; then
  echo "[ERROR] Python 3 is required but not found."
  exit 1
fi

PYTHON=$(command -v python3)
echo "[FaceID] Using Python: $PYTHON ($($PYTHON --version))"

# Install deps
echo "[FaceID] Installing dependencies…"
$PYTHON -m pip install -r requirements.txt --quiet

# Create directories
mkdir -p known_faces static

echo "[FaceID] Starting server at http://localhost:8000"
echo "[FaceID] Press Ctrl+C to stop"
echo ""

$PYTHON start.py --no-install "$@"
