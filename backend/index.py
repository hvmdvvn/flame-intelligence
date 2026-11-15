"""Vercel's automatically detected FastAPI entrypoint."""
from app.vercel_runtime import prepare_runtime

prepare_runtime()

from app.main import app  # noqa: E402,F401
