"""Manifest, page text, chunks, and the SQLite FTS index."""

from __future__ import annotations

import json
import re
import sqlite3
from threading import RLock
from datetime import datetime, timezone
from pathlib import Path

from app.config import REQUIRED_LIMITATIONS, data_dir

COVERAGE_TERMS = (
    "flame spread",
    "extinction",
    "droplet",
    "solid fuel",
    "oxygen",
    "saffire",
    "microgravity",
    "ignition",
    "confinement",
)
_index_lock = RLock()


def _read_json(path: Path, fallback):
    if not path.exists():
        return fallback
    return json.loads(path.read_text(encoding="utf-8"))


def _write_json(path: Path, payload) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def disk_stem(paper_id: str) -> str:
    if not re.fullmatch(r"[a-zA-Z0-9_-]+:[a-zA-Z0-9_-]+", paper_id):
        raise ValueError("Invalid paper identifier")
    return paper_id.replace(":", "__")


def manifest_path() -> Path:
    return data_dir() / "manifest.json"


def chunks_path() -> Path:
    return data_dir() / "chunks.json"


def studies_path() -> Path:
    return data_dir() / "studies.json"


def index_path() -> Path:
    return data_dir() / "index" / "chunks.sqlite"


def load_manifest() -> dict:
    payload = _read_json(
        manifest_path(),
        {"corpus_version": "0", "built_at": None, "limitations": [], "papers": []},
    )
    payload.setdefault("papers", [])
    payload.setdefault("corpus_version", "0")
    payload.setdefault("limitations", [])
    payload.setdefault("built_at", None)
    return payload


def load_papers() -> list[dict]:
    papers = [dict(p) for p in load_manifest().get("papers") or []]
    catalog = _read_json(data_dir() / "research_catalog.json", {})
    for paper in papers:
        for correction in catalog.get("metadata_corrections", []):
            if correction.get("paper_id") == paper.get("paper_id") and correction.get("field") == "year":
                paper["year"] = correction["corrected_value"]
                paper["publication_date"] = correction.get("publication_date")
                paper.setdefault("metadata_corrections", []).append(correction)
    return papers


def get_paper(paper_id: str) -> dict | None:
    for paper in load_papers():
        if paper.get("paper_id") == paper_id:
            return paper
    return None


def load_extract(paper_id: str) -> dict | None:
    if not re.fullmatch(r"[a-zA-Z0-9_-]+:[a-zA-Z0-9_-]+", paper_id):
        return None
    path = data_dir() / "extracts" / f"{disk_stem(paper_id)}.json"
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def load_studies_file() -> dict:
    payload = _read_json(studies_path(), {"studies": [], "measurements": [], "comparison_rules_version": "1"})
    payload.setdefault("studies", [])
    payload.setdefault("measurements", [])
    return payload


def corpus_version() -> str:
    return str(load_manifest().get("corpus_version") or "0")


def limitations() -> list[str]:
    seen: list[str] = []
    for line in REQUIRED_LIMITATIONS + list(load_manifest().get("limitations") or []):
        if line.startswith("PSI repository page returned"):
            line = "Original publication-archive ingestion note: " + line
        if line and line not in seen:
            seen.append(line)
    return seen


def search_papers(
    q: str | None = None,
    source: str | None = None,
    year: int | None = None,
    pdf_status: str | None = None,
    topic: str | None = None,
) -> list[dict]:
    needle = (q or "").strip().lower()
    topic_needle = (topic or "").strip().lower()
    found = []
    for paper in load_papers():
        if source and paper.get("source") != source:
            continue
        if year is not None and paper.get("year") != year:
            continue
        if pdf_status and paper.get("pdf_status") != pdf_status:
            continue
        topics = [str(t).lower() for t in paper.get("topics") or []]
        if topic_needle and topic_needle not in topics and not any(topic_needle in t for t in topics):
            continue
        if needle:
            blob = " ".join(
                [
                    str(paper.get("title") or ""),
                    " ".join(paper.get("authors") or []),
                    str(paper.get("abstract") or ""),
                    " ".join(paper.get("topics") or []),
                ]
            ).lower()
            if needle not in blob:
                continue
        found.append(paper)
    found.sort(key=lambda p: (p.get("year") is None, -(p.get("year") or 0), p.get("title") or ""))
    return found


def public_paper(paper: dict, *, truncate: bool = False) -> dict:
    abstract = paper.get("abstract")
    if truncate and isinstance(abstract, str) and len(abstract) > 480:
        abstract = abstract[:477].rstrip() + "..."
    return {
        "paper_id": paper.get("paper_id"),
        "source": paper.get("source"),
        "source_record_id": paper.get("source_record_id"),
        "title": paper.get("title"),
        "authors": paper.get("authors") or [],
        "year": paper.get("year"),
        "abstract": abstract,
        "official_url": paper.get("official_url"),
        "pdf_url": paper.get("pdf_url"),
        "pdf_status": paper.get("pdf_status"),
        "topics": paper.get("topics") or [],
        "extraction_status": paper.get("extraction_status"),
        "extraction_notes": paper.get("extraction_notes") or "",
        "synthetic": bool(paper.get("synthetic")),
        "center": paper.get("center"),
        "sti_type": paper.get("sti_type"),
        "metadata_corrections": paper.get("metadata_corrections") or [],
    }


def paper_detail(paper_id: str) -> dict | None:
    paper = get_paper(paper_id)
    if paper is None:
        return None
    extract = load_extract(paper_id) or {}
    pages = extract.get("pages") or []
    studies = load_studies_file().get("studies") or []
    detail = public_paper(paper, truncate=False)
    detail["page_count"] = len(pages)
    detail["study_ids"] = [s["study_id"] for s in studies if s.get("paper_id") == paper_id]
    detail["local_pdf"] = bool(paper.get("local_pdf_path"))
    return detail


def page_text(paper_id: str, page_number: int) -> dict | None:
    paper = get_paper(paper_id)
    extract = load_extract(paper_id)
    if paper is None or extract is None:
        return None
    for page in extract.get("pages") or []:
        if int(page.get("page_number") or 0) == page_number:
            return {
                "paper_id": paper_id,
                "title": paper.get("title"),
                "official_url": paper.get("official_url"),
                "page_number": page_number,
                "text": page.get("text") or "",
                "quality_flags": page.get("quality_flags") or [],
                "corpus_version": corpus_version(),
            }
    return None


def _indexable(page: dict) -> bool:
    text = (page.get("text") or "").strip()
    flags = set(page.get("quality_flags") or [])
    if len(text) < 80:
        return False
    if "possible_missing_spaces" in flags:
        return False
    if "possible_scan" in flags and len(text) < 200:
        return False
    return True


def chunk_text(text: str, size: int = 1000, overlap: int = 160) -> list[tuple[int, int, str]]:
    text = text.strip()
    if not text:
        return []
    if len(text) <= size:
        return [(0, len(text), text)]
    spans: list[tuple[int, int, str]] = []
    start = 0
    guard = 0
    while start < len(text) and guard < 400:
        guard += 1
        end = min(len(text), start + size)
        if end < len(text):
            cut = text.rfind(" ", start + size // 2, end)
            if cut > start:
                end = cut
        piece = text[start:end].strip()
        if piece:
            spans.append((start, start + len(piece), piece))
        if end >= len(text):
            break
        nxt = end - overlap
        start = nxt if nxt > start else end
    return spans


def rebuild_chunks() -> int:
    chunks = []
    for paper in load_papers():
        extract = load_extract(paper["paper_id"])
        if not extract:
            continue
        for page in extract.get("pages") or []:
            if not _indexable(page):
                continue
            page_number = int(page["page_number"])
            for index, (char_start, char_end, text) in enumerate(chunk_text(page.get("text") or ""), start=1):
                chunks.append(
                    {
                        "chunk_id": f"{paper['paper_id']}#p{page_number}#c{index}",
                        "paper_id": paper["paper_id"],
                        "title": paper.get("title") or "",
                        "official_url": paper.get("official_url") or "",
                        "page_number": page_number,
                        "text": text,
                        "char_start": char_start,
                        "char_end": char_end,
                        "token_estimate": max(1, len(text.split())),
                    }
                )
    _write_json(chunks_path(), {"corpus_version": corpus_version(), "chunks": chunks})
    _rebuild_sqlite(chunks)
    return len(chunks)


def _rebuild_sqlite(chunks: list[dict]) -> None:
    path = index_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        path.unlink()
    conn = sqlite3.connect(path)
    try:
        conn.execute(
            """
            CREATE TABLE chunks (
                chunk_id TEXT PRIMARY KEY,
                paper_id TEXT,
                title TEXT,
                official_url TEXT,
                page_number INTEGER,
                text TEXT
            )
            """
        )
        conn.execute(
            """
            CREATE VIRTUAL TABLE chunks_fts USING fts5(
                chunk_id UNINDEXED,
                title,
                text,
                tokenize = 'porter unicode61'
            )
            """
        )
        conn.executemany(
            "INSERT INTO chunks VALUES (?, ?, ?, ?, ?, ?)",
            [
                (c["chunk_id"], c["paper_id"], c["title"], c["official_url"], c["page_number"], c["text"])
                for c in chunks
            ],
        )
        conn.executemany(
            "INSERT INTO chunks_fts (chunk_id, title, text) VALUES (?, ?, ?)",
            [(c["chunk_id"], c["title"], c["text"]) for c in chunks],
        )
        conn.commit()
    finally:
        conn.close()


def ensure_index() -> None:
    with _index_lock:
        _ensure_index_locked()


def _ensure_index_locked() -> None:
    path = index_path()
    source = chunks_path()
    if source.exists() and path.exists() and path.stat().st_mtime >= source.stat().st_mtime:
        return
    if not source.exists():
        rebuild_chunks()
        return
    payload = _read_json(source, {"chunks": []})
    _rebuild_sqlite(payload.get("chunks") or [])


def chunk_count() -> int:
    payload = _read_json(chunks_path(), {"chunks": []})
    return len(payload.get("chunks") or [])


def get_chunk(chunk_id: str) -> dict | None:
    ensure_index()
    if not index_path().exists():
        return None
    conn = sqlite3.connect(index_path())
    conn.row_factory = sqlite3.Row
    try:
        row = conn.execute("SELECT * FROM chunks WHERE chunk_id = ?", (chunk_id,)).fetchone()
    finally:
        conn.close()
    if row is None:
        return None
    return dict(row)


def search_chunks(query: str, *, paper_id: str | None = None, limit: int = 8) -> list[dict]:
    ensure_index()
    if not index_path().exists():
        return []
    match = query.strip()
    if not match:
        return []
    sql = """
        SELECT c.chunk_id, c.paper_id, c.title, c.official_url, c.page_number, c.text,
               bm25(chunks_fts) AS score
        FROM chunks_fts
        JOIN chunks c ON c.chunk_id = chunks_fts.chunk_id
        WHERE chunks_fts MATCH ?
    """
    params: list = [match]
    if paper_id:
        sql += " AND c.paper_id = ?"
        params.append(paper_id)
    sql += " ORDER BY score LIMIT ?"
    params.append(limit)
    conn = sqlite3.connect(index_path())
    conn.row_factory = sqlite3.Row
    try:
        try:
            rows = conn.execute(sql, params).fetchall()
        except sqlite3.OperationalError:
            return []
    finally:
        conn.close()
    return [dict(row) for row in rows]


def studies_with_measurements() -> list[dict]:
    payload = load_studies_file()
    grouped: dict[str, list] = {}
    for measurement in payload.get("measurements") or []:
        grouped.setdefault(measurement.get("study_id"), []).append(measurement)
    studies = []
    for study in payload.get("studies") or []:
        item = dict(study)
        item["measurements"] = grouped.get(study.get("study_id"), [])
        studies.append(item)
    return studies


def get_study(study_id: str) -> dict | None:
    for study in studies_with_measurements():
        if study.get("study_id") == study_id:
            return study
    return None


def fingerprint(study: dict) -> dict:
    measurements = study.get("measurements") or []
    families = []
    for measurement in measurements:
        family = measurement.get("measurement_family") or "not_reported"
        if family not in families:
            families.append(family)
    return {
        "study_id": study.get("study_id"),
        "gravity_regime": study.get("gravity_regime") or "not_reported",
        "platform": study.get("platform") or "not_reported",
        "fuel_family": study.get("fuel_family") or "not_reported",
        "measurement_families": families,
        "oxygen_reported": study.get("oxygen_mole_fraction") is not None,
        "pressure_reported": study.get("pressure_kpa") is not None,
    }


def stats() -> dict:
    papers = load_papers()
    studies = studies_with_measurements()
    verified = 0
    for study in studies:
        for measurement in study.get("measurements") or []:
            if measurement.get("verification_status") == "verified" and measurement.get("value") is not None:
                verified += 1
    by_source = {"ntrs": 0, "psi": 0}
    by_pdf = {"downloaded": 0, "metadata_only": 0, "unavailable": 0}
    by_center: dict[str, int] = {}
    by_year: dict[int, int] = {}
    coverage = []
    for paper in papers:
        source = paper.get("source")
        if source in by_source:
            by_source[source] += 1
        status = paper.get("pdf_status")
        if status in by_pdf:
            by_pdf[status] += 1
        center = paper.get("center") or "Not reported"
        by_center[center] = by_center.get(center, 0) + 1
        if isinstance(paper.get("year"), int):
            by_year[paper["year"]] = by_year.get(paper["year"], 0) + 1
    for term in COVERAGE_TERMS:
        count = 0
        for paper in papers:
            blob = " ".join(
                [str(paper.get("title") or ""), str(paper.get("abstract") or ""), " ".join(paper.get("topics") or [])]
            ).lower()
            if term in blob:
                count += 1
        coverage.append({"term": term, "papers": count})
    return {
        "corpus_version": corpus_version(),
        "built_at": load_manifest().get("built_at"),
        "papers": len(papers),
        "papers_with_text": sum(1 for p in papers if p.get("extraction_status") == "extracted"),
        "chunks": chunk_count(),
        "studies": len(studies),
        "verified_measurements": verified,
        "synthetic_papers": sum(1 for p in papers if p.get("synthetic")),
        "by_source": by_source,
        "by_pdf_status": by_pdf,
        "by_center": by_center,
        "by_year": [{"year": year, "papers": by_year[year]} for year in sorted(by_year)],
        "coverage": coverage,
        "limitations": limitations(),
    }


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def term_pattern(term: str) -> re.Pattern[str]:
    return re.compile(rf"\b{re.escape(term)}\b", re.IGNORECASE)
