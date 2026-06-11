"""
Logging setup for FaceID.

On each startup:
  1. The existing logs/latest.log is renamed to logs/YYYY-MM-DD_HH-MM-AM|PM.log
     using the timestamp written in its own header (EST, 12-hour).
  2. A fresh logs/latest.log is opened and all Python loggers, unhandled
     exceptions, and stderr output are routed into it.
"""

import logging
import sys
from pathlib import Path
from datetime import datetime, timezone, timedelta

try:
    from zoneinfo import ZoneInfo
    _TZ = ZoneInfo("America/New_York")
except ImportError:
    # Python < 3.9 — fixed EST offset (no DST awareness)
    _TZ = timezone(timedelta(hours=-5))

LOGS_DIR = Path(__file__).parent / "logs"
LATEST_LOG = LOGS_DIR / "latest.log"

_LOG_FMT   = "[%(asctime)s EST] [%(levelname)-8s] %(name)s: %(message)s"
_DATE_FMT  = "%Y-%m-%d %I:%M:%S %p"
_HDR_FMT   = "%Y-%m-%d %I:%M:%S %p EST"
_FILE_FMT  = "%Y-%m-%d_%I-%M-%p"       # e.g. 2024-06-11_02-30-PM


class _ESTFormatter(logging.Formatter):
    """Emit all log timestamps in Eastern Time regardless of server TZ."""
    def formatTime(self, record, datefmt=None):
        dt = datetime.fromtimestamp(record.created, tz=_TZ)
        return dt.strftime(datefmt or _DATE_FMT)


def _read_session_start() -> datetime:
    """Parse the start time from the header line of latest.log, fall back to mtime."""
    try:
        with open(LATEST_LOG, "r", encoding="utf-8", errors="replace") as f:
            line = f.readline().strip()
        if line.startswith("=== Session started "):
            raw = line.removeprefix("=== Session started ").removesuffix(" ===")
            return datetime.strptime(raw, _HDR_FMT).replace(tzinfo=_TZ)
    except (OSError, ValueError):
        pass
    return datetime.fromtimestamp(LATEST_LOG.stat().st_mtime, tz=_TZ)


def _archive_latest() -> None:
    """Rename latest.log to a timestamped archive if it contains anything."""
    if not LATEST_LOG.exists() or LATEST_LOG.stat().st_size == 0:
        return
    dt   = _read_session_start()
    stem = dt.strftime(_FILE_FMT)
    dest = LOGS_DIR / f"{stem}.log"
    n    = 1
    while dest.exists():
        dest = LOGS_DIR / f"{stem}_{n}.log"
        n   += 1
    LATEST_LOG.rename(dest)


def setup() -> logging.Logger:
    """
    Archive the previous session log, open a fresh latest.log, configure
    the root logger, install an exception hook, and tee stderr to the file.
    Returns a logger named 'faceid' for use in Start.py.
    """
    LOGS_DIR.mkdir(parents=True, exist_ok=True)
    _archive_latest()

    formatter = _ESTFormatter(_LOG_FMT, datefmt=_DATE_FMT)

    # ── File handler ────────────────────────────────────────────────────────
    fh = logging.FileHandler(LATEST_LOG, encoding="utf-8")
    fh.setLevel(logging.DEBUG)
    fh.setFormatter(formatter)

    # ── Console handler ──────────────────────────────────────────────────────
    ch = logging.StreamHandler(sys.__stdout__)
    ch.setLevel(logging.INFO)
    ch.setFormatter(formatter)

    root = logging.getLogger()
    root.setLevel(logging.DEBUG)
    root.handlers.clear()
    root.addHandler(fh)
    root.addHandler(ch)

    # ── Write session header so the archive function can read the start time ─
    now_str = datetime.now(tz=_TZ).strftime(_HDR_FMT)
    with open(LATEST_LOG, "a", encoding="utf-8") as f:
        f.write(f"=== Session started {now_str} ===\n")

    # ── Unhandled-exception hook (crashes) ───────────────────────────────────
    _crash = logging.getLogger("crash")

    def _excepthook(exc_type, exc_value, exc_tb):
        if issubclass(exc_type, KeyboardInterrupt):
            sys.__excepthook__(exc_type, exc_value, exc_tb)
            return
        _crash.critical(
            "Unhandled exception — process is crashing",
            exc_info=(exc_type, exc_value, exc_tb),
        )
        for h in root.handlers:
            h.flush()

    sys.excepthook = _excepthook

    # ── Tee stderr into the log file (captures C-level / uvicorn output) ─────
    _file_stream = open(LATEST_LOG, "a", encoding="utf-8", buffering=1)

    class _Tee:
        def __init__(self, orig, extra):
            self._orig  = orig
            self._extra = extra

        def write(self, s: str):
            self._orig.write(s)
            if s.strip():
                self._extra.write(s)
                self._extra.flush()

        def flush(self):
            self._orig.flush()
            self._extra.flush()

        def fileno(self):
            return self._orig.fileno()

        def isatty(self):
            return False

    sys.stderr = _Tee(sys.__stderr__, _file_stream)

    log = logging.getLogger("faceid")
    log.info("Logging initialised — output: %s", LATEST_LOG)
    return log
