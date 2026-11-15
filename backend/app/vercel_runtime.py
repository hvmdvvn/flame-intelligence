"""Prepare a writable, disposable copy of the shipped research corpus.

Vercel's deployed application filesystem is read-only. SQLite indexes and the
registry are derived from the checked-in JSON corpus in per-process /tmp space.
This is not persistent storage and must never be used for durable data imports.
Local uvicorn entrypoints do not call this module and keep their existing data.
"""
from __future__ import annotations

import hashlib
import os
from pathlib import Path
import shutil
import tempfile
import threading

_LOCK = threading.Lock()
_PREPARED: Path | None = None
SEED_FILES = ("manifest.json", "studies.json", "chunks.json", "research_catalog.json")


def prepare_runtime(seed_root: Path | None = None, scratch_root: Path | None = None) -> Path:
    """Copy only attributed JSON inputs, then point the existing services at them.

    A digest and PID isolate source releases and concurrent Python processes.
    Nothing writes into the read-only deployment or copies original PDFs/secrets.
    Explicit arguments support isolated tests; the production entrypoint uses /tmp.
    """
    global _PREPARED
    with _LOCK:
        if _PREPARED is not None and seed_root is None and scratch_root is None:
            os.environ["FLAME_DATA_DIR"] = str(_PREPARED)
            return _PREPARED
        seed = seed_root or Path(__file__).resolve().parents[1] / "data"
        sources = [seed / name for name in SEED_FILES]
        sources.extend(sorted((seed / "extracts").glob("*.json")))
        required = [p for p in sources if p.name in SEED_FILES]
        if any(not p.is_file() for p in required):
            raise RuntimeError("The Vercel bundle is missing required scientific seed JSON files")
        digest = hashlib.sha256()
        for source in sources:
            if not source.is_file() or source.is_symlink():
                raise RuntimeError("Scientific seed artifacts must be ordinary JSON files")
            digest.update(source.relative_to(seed).as_posix().encode())
            digest.update(source.read_bytes())
        scratch = scratch_root or Path(tempfile.gettempdir())
        target = scratch / "flame-intelligence" / digest.hexdigest()[:20] / str(os.getpid())
        marker = target / ".seed-ready"
        if not marker.exists():
            target.mkdir(parents=True, exist_ok=True)
            for source in sources:
                destination = target / source.relative_to(seed)
                destination.parent.mkdir(parents=True, exist_ok=True)
                # Replace only generated scratch copies, never source files.
                temporary = destination.with_suffix(".json.part")
                shutil.copyfile(source, temporary)
                temporary.replace(destination)
            marker.write_text(digest.hexdigest(), encoding="ascii")
        os.environ["FLAME_DATA_DIR"] = str(target)
        os.environ["FLAME_STORAGE_MODE"] = "ephemeral_seed"
        if seed_root is None and scratch_root is None:
            _PREPARED = target
        return target
