"""Seed a new persistent volume without overwriting operator files."""
import os
from pathlib import Path
import shutil

import uvicorn

root = Path(os.environ.get("FLAME_DATA_DIR", "/data"))
root.mkdir(parents=True, exist_ok=True)
for source in Path("/seed").rglob("*"):
    if source.is_file() and source.suffix == ".json":
        destination = root / source.relative_to("/seed")
        destination.parent.mkdir(parents=True, exist_ok=True)
        if not destination.exists():
            shutil.copyfile(source, destination)
uvicorn.run("app.main:app", host="0.0.0.0", port=8000, proxy_headers=False, log_level="info")
