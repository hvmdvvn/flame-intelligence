"""FastAPI surface for the evidence bench."""

from __future__ import annotations

from contextlib import asynccontextmanager
import json
import logging
import os
import time
import uuid
import secrets
from collections import defaultdict, deque
from threading import Lock

from fastapi import FastAPI, Request, Query
from fastapi.encoders import jsonable_encoder
from fastapi.responses import Response, FileResponse
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.compare import CompareError, compare
from app.config import llm_provider
from app.corpus import (
    chunk_count,
    corpus_version,
    ensure_index,
    load_papers,
    page_text,
    paper_detail,
    public_paper,
    search_papers,
    stats,
    studies_with_measurements,
)
from app.rag import AskError, answer, evidence
from app.schemas import AskIn, AskOut, CompareIn, CompareOut
from app import research_store
from app.intelligence import RankingIn, rank_investigations, quantitative_analytics, model_feasibility, research_report
from app.config import data_dir


def _error(code: str, message: str, status: int, **extra) -> JSONResponse:
    return JSONResponse(status_code=status, content={"error": {"code": code, "message": message, **extra}})


@asynccontextmanager
async def lifespan(_app: FastAPI):
    ensure_index()
    research_store.initialize()
    yield


app = FastAPI(title="Flame Intelligence", version="2.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("CORS_ORIGINS", "http://127.0.0.1:3000,http://localhost:3000").split(","),
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.exception_handler(RequestValidationError)
async def invalid_request(_request: Request, exc: RequestValidationError):
    details = [{"location": list(e["loc"]), "message": e["msg"], "type": e["type"]} for e in exc.errors()]
    return _error("invalid_request", "Request failed validation.", 400, details=jsonable_encoder(details))


_requests: dict[str, deque] = defaultdict(deque)
_request_lock = Lock()
_log = logging.getLogger("flame.requests")


@app.middleware("http")
async def request_controls(request: Request, call_next):
    request_id = str(uuid.uuid4())
    started = time.monotonic()
    if request.method == "POST":
        # Read with a hard bound, including chunked requests that omit Content-Length.
        length = request.headers.get("content-length")
        if length and (not length.isdigit() or int(length) > 32768):
            return _error("request_too_large", "Request body limit is 32 KiB.", 413)
        body = bytearray()
        async for chunk in request.stream():
            body.extend(chunk)
            if len(body) > 32768:
                return _error("request_too_large", "Request body limit is 32 KiB.", 413)
        request._body = bytes(body)
        key = request.client.host if request.client else "unknown"
        with _request_lock:
            now = time.monotonic()
            # Expire idle client buckets to keep limiter memory bounded.
            for old in [k for k, v in _requests.items() if not v or now - v[-1] >= 60]:
                _requests.pop(old, None)
            bucket = _requests[key]
            while bucket and now - bucket[0] >= 60:
                bucket.popleft()
            if len(bucket) >= int(os.environ.get("API_POSTS_PER_MINUTE", "30")):
                return _error("rate_limited", "Too many analysis requests. Retry in one minute.", 429)
            if len(_requests) > 10000:
                return _error("busy", "Analysis capacity reached. Retry shortly.", 503)
            bucket.append(now)
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    _log.info(json.dumps({"request_id": request_id, "method": request.method, "path": request.url.path, "status": response.status_code, "duration_ms": round((time.monotonic() - started) * 1000, 2)}))
    return response


@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "corpus_version": corpus_version(),
        "papers": len(load_papers()),
        "chunks": chunk_count(),
        "retrieval": "fts5",
        "llm_provider": llm_provider(),
        "storage_mode": os.environ.get("FLAME_STORAGE_MODE", "persistent_local"),
    }


@app.get("/api/ready")
def ready():
    try:
        research_store.list_investigations(limit=1)
        ensure_index()
        return {"status": "ready", "research_store": "sqlite", "retrieval": "fts5", "storage_mode": os.environ.get("FLAME_STORAGE_MODE", "persistent_local")}
    except Exception:
        _log.exception("Readiness check failed")
        return _error("not_ready", "Research storage or retrieval index is unavailable.", 503)


@app.get("/api/investigations")
def investigations(q: str | None = Query(default=None, max_length=200), category: str | None = None, gravity: str | None = None, limit: int = Query(default=50, ge=1, le=200), offset: int = Query(default=0, ge=0)):
    return research_store.list_investigations(q=q, category=category, gravity=gravity, limit=limit, offset=offset)


@app.get("/api/investigations/{investigation_id}")
def investigation(investigation_id: str):
    row = research_store.investigation_detail(investigation_id)
    return row if row else _error("investigation_not_found", "No registered investigation uses this ID.", 404)


@app.get("/api/sources")
def sources():
    return {"sources": research_store.list_sources()}


@app.get("/api/datasets")
def datasets(investigation_id: str | None = None):
    return {"datasets": research_store.list_datasets(investigation_id=investigation_id)}


@app.get("/api/ingestion/jobs")
def ingestion_jobs(request: Request):
    token = os.environ.get("FLAME_ADMIN_TOKEN", "")
    if not token or not secrets.compare_digest(request.headers.get("authorization", ""), "Bearer " + token):
        return _error("unauthorized", "Ingestion job inspection requires an operator token.", 401)
    return {"jobs": research_store.list_jobs()}


@app.get("/api/datasets/{dataset_id}/download")
def dataset_download(dataset_id: str):
    result = research_store.resolve_download(dataset_id)
    if result is None:
        return _error("download_unavailable", "No redistributable, checksum-verified original file is available.", 404)
    return FileResponse(result["path"], filename=result["filename"], media_type=result["media_type"])


@app.post("/api/rankings")
def rankings(body: RankingIn):
    return rank_investigations(body)


@app.get("/api/analytics")
def analytics():
    return quantitative_analytics()


@app.get("/api/models")
def models():
    return model_feasibility()


@app.get("/api/context")
def context():
    path = data_dir() / "research_catalog.json"
    catalog = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
    return {k: catalog.get(k, []) for k in ("incidents", "earth_applications", "education")}


@app.post("/api/reports")
def report(body: RankingIn):
    content = json.dumps(research_report(body), ensure_ascii=False, indent=2, allow_nan=False)
    return Response(content, media_type="application/json", headers={"Content-Disposition": 'attachment; filename="flame-research-report.json"'})


@app.get("/api/stats")
def get_stats():
    return stats()


@app.get("/api/papers")
def list_papers(
    q: str | None = None,
    source: str | None = None,
    year: int | None = None,
    pdf_status: str | None = None,
    topic: str | None = None,
):
    papers = [
        public_paper(paper, truncate=True)
        for paper in search_papers(q=q, source=source, year=year, pdf_status=pdf_status, topic=topic)
    ]
    return {"corpus_version": corpus_version(), "papers": papers}


@app.get("/api/papers/{paper_id}")
def read_paper(paper_id: str):
    detail = paper_detail(paper_id)
    if detail is None:
        return _error("paper_not_found", "No manifest record uses this paper_id.", 404, paper_id=paper_id)
    return detail


@app.get("/api/papers/{paper_id}/pages/{page_number}")
def read_page(paper_id: str, page_number: int):
    page = page_text(paper_id, page_number)
    if page is None:
        return _error("paper_not_found", "That paper or page is not in the archive.", 404, paper_id=paper_id)
    return page


@app.get("/api/evidence/{chunk_id:path}")
def read_evidence(chunk_id: str):
    payload = evidence(chunk_id)
    if payload is None:
        return _error("chunk_not_found", "No indexed passage uses this chunk_id.", 404, chunk_id=chunk_id)
    return payload


@app.post("/api/ask")
def ask(body: AskIn):
    try:
        payload = answer(body.question, paper_id=body.paper_id, max_passages=body.max_passages)
    except AskError as exc:
        return _error(exc.code, exc.message, exc.status, **exc.extra)
    return AskOut(**payload).model_dump()


@app.get("/api/studies")
def list_studies():
    return {"corpus_version": corpus_version(), "studies": studies_with_measurements()}


@app.post("/api/compare")
def run_compare(body: CompareIn):
    try:
        payload = compare(body.left_study_id, body.right_study_id, body.measurement_family)
    except CompareError as exc:
        return _error(exc.code, exc.message, exc.status, **exc.extra)
    return CompareOut(**payload).model_dump()
