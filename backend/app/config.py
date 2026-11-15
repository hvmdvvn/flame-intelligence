"""Runtime paths and model settings. Secrets come from the environment."""

from __future__ import annotations

import os
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DATA_DIR = BACKEND_ROOT / "data"

NTRS_API = "https://ntrs.nasa.gov"
USER_AGENT = "FlameIntelligence/2.0 (independent combustion research application)"

REQUIRED_LIMITATIONS = [
    "Independent research application. Not a NASA-endorsed or certified fire-safety system.",
    "The investigation registry includes source-backed PSI metadata; raw PSI files require authorized import.",
    "Microgravity findings in the corpus are not lunar or Martian predictions.",
]


def data_dir() -> Path:
    return Path(os.environ.get("FLAME_DATA_DIR", DEFAULT_DATA_DIR))


def llm_provider() -> str:
    provider = os.environ.get("LLM_PROVIDER", "").strip().lower()
    if provider in {"ollama", "openai_compatible"}:
        return provider
    return "none"
