"""Persistent research registry, separate from the preserved publication corpus.

The registry stores source-reported metadata. It never turns metadata into a
measurement and never modifies the legacy manifest, studies or raw PDFs.
"""
from __future__ import annotations

from contextlib import contextmanager
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import sqlite3
import threading

from app.config import data_dir

SOFTWARE_VERSION = "research-ingest/1.0.0"
_LOCK = threading.RLock()
_SEED_STATE: dict[str, tuple] = {}


def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def encode(value) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, allow_nan=False)


def database_path() -> Path:
    return data_dir() / "research.sqlite"


@contextmanager
def connection():
    database_path().parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(database_path(), timeout=30)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys=ON")
    conn.execute("PRAGMA busy_timeout=30000")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def _read(path: Path, default):
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else default


def put_source(conn, source: dict) -> None:
    """Upsert metadata without claiming retrieval of the original resource."""
    source = dict(source)
    source_id = source["source_id"]
    existing = conn.execute("SELECT metadata_json FROM sources WHERE source_id=?", (source_id,)).fetchone()
    if existing:
        previous = json.loads(existing[0])
        incoming = source
        source = {**previous, **{key: value for key, value in incoming.items() if value is not None}}
        # Catalog refreshes and new imports cannot erase artifact checksums or
        # processing history accumulated on an already registered source.
        for key in ("processing_history", "file_checksums"):
            merged = []
            seen = set()
            for value in list(previous.get(key) or []) + list(incoming.get(key) or []):
                identity = encode(value)
                if identity not in seen:
                    seen.add(identity)
                    merged.append(value)
            source[key] = merged
    source.setdefault("name", source_id)
    source.setdefault("organization", None)
    source.setdefault("original_url", source.get("url", ""))
    source.setdefault("retrieval_status", "not_retrieved")
    source.setdefault("content_type", None)
    source.setdefault("trust_classification", "unverified")
    source.setdefault("extraction_method", None)
    source.setdefault("processing_history", [])
    source.setdefault("access_date", None)
    source.setdefault("publication_date", None)
    source.setdefault("update_date", None)
    source.setdefault("dataset_version", None)
    source.setdefault("doi", None)
    source.setdefault("license", None)
    source.setdefault("file_checksums", [])
    conn.execute(
        """INSERT INTO sources VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(source_id) DO UPDATE SET name=excluded.name,
        organization=excluded.organization, original_url=excluded.original_url,
        retrieval_status=excluded.retrieval_status, metadata_json=excluded.metadata_json""",
        (source_id, source["name"], source["organization"], source["original_url"],
         source["retrieval_status"], encode(source), now()),
    )


def put_investigation(conn, item: dict) -> None:
    item = dict(item)
    identity = item["investigation_id"]
    name = item.get("name") or item.get("full_name") or identity
    summary = item.get("summary") or item.get("objective") or item.get("objectives") or ""
    if isinstance(summary, list):
        summary = " ".join(str(x) for x in summary)
    category = item.get("category")
    if isinstance(category, list):
        category = ", ".join(category)
    conn.execute(
        """INSERT INTO investigations VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(investigation_id) DO UPDATE SET name=excluded.name,
        summary=excluded.summary, category=excluded.category,
        gravity_regime=excluded.gravity_regime, metadata_json=excluded.metadata_json""",
        (identity, name, summary, category, item.get("gravity_regime"), encode(item)),
    )
    for source_id in item.get("source_ids", []):
        if conn.execute("SELECT 1 FROM sources WHERE source_id=?", (source_id,)).fetchone():
            conn.execute("INSERT OR IGNORE INTO investigation_sources VALUES (?, ?)", (identity, source_id))


def initialize() -> None:
    """Apply ordered SQL migrations and idempotently seed attributed metadata."""
    root = data_dir().resolve()
    inputs = [root / "manifest.json", root / "research_catalog.json"]
    migrations = sorted((Path(__file__).resolve().parents[1] / "migrations").glob("*.sql"))
    signature = tuple((str(p), p.stat().st_mtime_ns, p.stat().st_size) for p in inputs + migrations if p.exists())
    with _LOCK:
        if database_path().exists() and _SEED_STATE.get(str(root)) == signature:
            return
        _initialize(signature, root, migrations)


def _initialize(signature, root, migrations) -> None:
    with connection() as conn:
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TEXT NOT NULL)")
        for migration in migrations:
            if not conn.execute("SELECT 1 FROM schema_migrations WHERE version=?", (migration.name,)).fetchone():
                conn.executescript(migration.read_text(encoding="utf-8"))
                conn.execute("INSERT INTO schema_migrations VALUES (?, ?)", (migration.name, now()))
        catalog = _read(data_dir() / "research_catalog.json", {})
        for source in catalog.get("sources", []):
            put_source(conn, source)
        for item in catalog.get("investigations", []):
            put_investigation(conn, item)
        manifest = _read(data_dir() / "manifest.json", {})
        from app.corpus import load_papers
        for paper in load_papers():
            identity = paper.get("paper_id")
            if not identity:
                continue
            # The existing extract checksum attests to a local text artifact;
            # it is never represented as the original PDF checksum.
            extract = data_dir() / "extracts" / (identity.replace(":", "__") + ".json")
            checksums = []
            if extract.exists():
                checksums.append({"artifact": "extracted_text", "sha256": hashlib.sha256(extract.read_bytes()).hexdigest()})
            raw = data_dir() / "raw" / (identity.replace(":", "__") + ".pdf")
            if raw.exists():
                checksums.append({"artifact": "original_pdf", "sha256": hashlib.sha256(raw.read_bytes()).hexdigest()})
            put_source(conn, {
                "source_id": identity, "name": paper.get("title") or identity,
                "organization": "NASA Technical Reports Server",
                "original_url": paper.get("official_url") or "",
                "document_identifier": paper.get("source_record_id"),
                "publication_date": paper.get("publication_date") or (str(paper["year"]) if paper.get("year") else None),
                "access_date": manifest.get("built_at"),
                "dataset_version": manifest.get("corpus_version"),
                "retrieval_status": "text_available" if extract.exists() else "metadata_only",
                "content_type": "application/pdf",
                "trust_classification": "test_fixture" if paper.get("synthetic") else "primary_publication",
                "extraction_method": "PyMuPDF (existing corpus)",
                "processing_history": [{"method": "existing_manifest_migration", "version": SOFTWARE_VERSION}] + list(paper.get("metadata_corrections") or []),
                "file_checksums": checksums,
                "license": "Check original NTRS record and third-party rights before redistribution.",
                "synthetic": bool(paper.get("synthetic")),
            })
    _SEED_STATE[str(root)] = signature


def _source(row) -> dict:
    item = json.loads(row["metadata_json"])
    item["url"] = item["original_url"]
    return item


def list_sources() -> list[dict]:
    initialize()
    with connection() as conn:
        return [_source(row) for row in conn.execute("SELECT * FROM sources ORDER BY name")]


def _dataset(row) -> dict:
    item = dict(row)
    item["metadata"] = json.loads(item.pop("metadata_json"))
    # Do not expose local filesystem paths through public API objects.
    item.pop("raw_path", None)
    item["download_available"] = bool(item["metadata"].get("redistribution_allowed", False))
    return item


def list_datasets(investigation_id: str | None = None) -> list[dict]:
    initialize()
    with connection() as conn:
        sql = "SELECT * FROM datasets"
        params = []
        if investigation_id:
            sql += " WHERE investigation_id=?"
            params.append(investigation_id)
        return [_dataset(row) for row in conn.execute(sql + " ORDER BY imported_at DESC", params)]


def _investigation(conn, row) -> dict:
    item = json.loads(row["metadata_json"])
    item.update({key: row[key] for key in ("investigation_id", "name", "summary", "category", "gravity_regime")})
    item.setdefault("full_name", item["name"])
    item.setdefault("objective", item["summary"])
    item.setdefault("conditions", {})
    item.setdefault("limitations", [])
    item["source_ids"] = [r[0] for r in conn.execute("SELECT source_id FROM investigation_sources WHERE investigation_id=? ORDER BY source_id", (row["investigation_id"],))]
    item["source_count"] = len(item["source_ids"])
    item["datasets"] = [_dataset(r) for r in conn.execute("SELECT * FROM datasets WHERE investigation_id=? ORDER BY version", (row["investigation_id"],))]
    item["measurement_count"] = conn.execute("SELECT count(*) FROM measurements m JOIN datasets d USING(dataset_id) WHERE d.investigation_id=? AND m.measurement_kind='direct_observation'", (row["investigation_id"],)).fetchone()[0]
    item["total_measurement_count"] = conn.execute("SELECT count(*) FROM measurements m JOIN datasets d USING(dataset_id) WHERE d.investigation_id=?", (row["investigation_id"],)).fetchone()[0]
    item["reported_model_count"] = item["total_measurement_count"] - item["measurement_count"]
    item["metadata_only"] = not bool(item["datasets"])
    return item


def list_investigations(q=None, category=None, gravity=None, limit=50, offset=0) -> dict:
    initialize()
    limit = max(1, min(int(limit), 200))
    offset = max(0, int(offset))
    predicates, params = [], []
    if q:
        predicates.append("(lower(name) LIKE ? ESCAPE '\\' OR lower(summary) LIKE ? ESCAPE '\\' OR lower(investigation_id) LIKE ? ESCAPE '\\' OR lower(coalesce(json_extract(metadata_json, '$.full_name'), '')) LIKE ? ESCAPE '\\')")
        term = str(q).lower().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        params.extend([f"%{term}%"] * 4)
    if category:
        predicates.append("category=?")
        params.append(category)
    if gravity:
        predicates.append("gravity_regime=?")
        params.append(gravity)
    where = " WHERE " + " AND ".join(predicates) if predicates else ""
    with connection() as conn:
        total = conn.execute("SELECT count(*) FROM investigations" + where, params).fetchone()[0]
        rows = conn.execute("SELECT * FROM investigations" + where + " ORDER BY name LIMIT ? OFFSET ?", params + [limit, offset]).fetchall()
        return {"investigations": [_investigation(conn, row) for row in rows], "total": total, "limit": limit, "offset": offset}


def list_measurements(investigation_id=None, dataset_id=None) -> list[dict]:
    initialize()
    sql = """SELECT m.*, d.investigation_id, d.source_id, r.original_run_id,
        r.gravity_regime, r.fuel, r.oxygen_value, r.oxygen_basis, r.oxygen_unit,
        r.pressure_value, r.pressure_unit, r.airflow_value, r.airflow_unit
        FROM measurements m JOIN datasets d USING(dataset_id) JOIN runs r USING(run_id)"""
    clauses, params = [], []
    if investigation_id:
        clauses.append("d.investigation_id=?")
        params.append(investigation_id)
    if dataset_id:
        clauses.append("d.dataset_id=?")
        params.append(dataset_id)
    if clauses:
        sql += " WHERE " + " AND ".join(clauses)
    with connection() as conn:
        result = []
        for row in conn.execute(sql + " ORDER BY m.dataset_id, m.source_row", params):
            item = dict(row)
            item["validation"] = json.loads(item.pop("validation_json"))
            item["processing"] = json.loads(item.pop("processing_json"))
            item["normalized_uncertainty"] = item["processing"].get("normalized_uncertainty")
            item["training_eligible"] = bool(item["training_eligible"])
            item["measurement_family"] = item["measurement_name"]
            item["evidence_class"] = "directly_observed_result" if item["measurement_kind"] == "direct_observation" else "model_prediction"
            result.append(item)
        return result


def investigation_detail(investigation_id: str) -> dict | None:
    initialize()
    with connection() as conn:
        row = conn.execute("SELECT * FROM investigations WHERE investigation_id=?", (investigation_id,)).fetchone()
        if not row:
            return None
        item = _investigation(conn, row)
        item["sources"] = [_source(r) for r in conn.execute("SELECT s.* FROM sources s JOIN investigation_sources j USING(source_id) WHERE j.investigation_id=? ORDER BY s.name", (investigation_id,))]
        item["runs"] = []
        for run in conn.execute("SELECT r.* FROM runs r JOIN datasets d USING(dataset_id) WHERE d.investigation_id=? ORDER BY r.run_id", (investigation_id,)):
            run = dict(run)
            run["conditions"] = json.loads(run.pop("conditions_json"))
            item["runs"].append(run)
    item["measurements"] = list_measurements(investigation_id=investigation_id)
    return item


def list_jobs() -> list[dict]:
    initialize()
    with connection() as conn:
        result = []
        for row in conn.execute("SELECT * FROM ingestion_jobs ORDER BY created_at DESC LIMIT 100"):
            item = dict(row)
            item["report"] = json.loads(item.pop("report_json"))
            result.append(item)
        return result


def resolve_download(dataset_id: str) -> dict | None:
    """Resolve an explicitly redistributable original with path and digest checks.

    Returns None for unknown, restricted, missing or altered files. Returned path
    is for server-side FileResponse only; it is not included in API JSON objects.
    """
    initialize()
    with connection() as conn:
        row = conn.execute("SELECT * FROM datasets WHERE dataset_id=?", (dataset_id,)).fetchone()
        if not row or not json.loads(row["metadata_json"]).get("redistribution_allowed", False):
            return None
        base = data_dir().resolve()
        raw_root = base / "raw"
        candidate = base / row["raw_path"]
        resolved = candidate.resolve()
        if not resolved.is_relative_to(raw_root) or not resolved.is_file():
            return None
        if any(part.is_symlink() for part in [candidate, *candidate.parents] if part.is_relative_to(base)):
            return None
        if resolved.stat().st_size > 50 * 1024 * 1024:
            return None
        if hashlib.sha256(resolved.read_bytes()).hexdigest() != row["file_sha256"]:
            return None
        media_type = {"csv": "text/csv", "tsv": "text/tab-separated-values", "json": "application/json"}.get(row["format"])
        if media_type is None:
            return None
        return {"path": resolved, "filename": row["file_sha256"] + "." + row["format"], "media_type": media_type}
