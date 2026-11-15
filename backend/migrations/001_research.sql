CREATE TABLE IF NOT EXISTS sources (
    source_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    organization TEXT,
    original_url TEXT NOT NULL,
    retrieval_status TEXT NOT NULL,
    metadata_json TEXT NOT NULL,
    created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS investigations (
    investigation_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    summary TEXT NOT NULL,
    category TEXT,
    gravity_regime TEXT,
    metadata_json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS investigation_sources (
    investigation_id TEXT NOT NULL REFERENCES investigations(investigation_id),
    source_id TEXT NOT NULL REFERENCES sources(source_id),
    PRIMARY KEY (investigation_id, source_id)
);
CREATE TABLE IF NOT EXISTS datasets (
    dataset_id TEXT PRIMARY KEY,
    investigation_id TEXT NOT NULL REFERENCES investigations(investigation_id),
    source_id TEXT NOT NULL REFERENCES sources(source_id),
    version INTEGER NOT NULL,
    original_filename TEXT NOT NULL,
    file_sha256 TEXT NOT NULL,
    metadata_sha256 TEXT NOT NULL,
    raw_path TEXT NOT NULL,
    format TEXT NOT NULL,
    row_count INTEGER NOT NULL,
    imported_at TEXT NOT NULL,
    metadata_json TEXT NOT NULL,
    UNIQUE (file_sha256, metadata_sha256)
);
CREATE TABLE IF NOT EXISTS runs (
    run_id TEXT PRIMARY KEY,
    dataset_id TEXT NOT NULL REFERENCES datasets(dataset_id),
    original_run_id TEXT NOT NULL,
    gravity_regime TEXT NOT NULL,
    fuel TEXT,
    oxygen_value REAL,
    oxygen_basis TEXT,
    oxygen_unit TEXT,
    pressure_value REAL,
    pressure_unit TEXT,
    airflow_value REAL,
    airflow_unit TEXT,
    conditions_json TEXT NOT NULL,
    UNIQUE(dataset_id, original_run_id)
);
CREATE TABLE IF NOT EXISTS measurements (
    measurement_id TEXT PRIMARY KEY,
    dataset_id TEXT NOT NULL REFERENCES datasets(dataset_id),
    run_id TEXT NOT NULL REFERENCES runs(run_id),
    measurement_name TEXT NOT NULL,
    measurement_kind TEXT NOT NULL,
    value REAL NOT NULL,
    unit TEXT NOT NULL,
    normalized_value REAL NOT NULL,
    normalized_unit TEXT NOT NULL,
    uncertainty REAL,
    time_s REAL,
    source_location TEXT NOT NULL,
    source_row INTEGER NOT NULL,
    training_eligible INTEGER NOT NULL DEFAULT 0,
    validation_json TEXT NOT NULL,
    processing_json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS ingestion_jobs (
    job_id TEXT PRIMARY KEY,
    status TEXT NOT NULL,
    filename TEXT NOT NULL,
    file_sha256 TEXT,
    dataset_id TEXT REFERENCES datasets(dataset_id),
    progress INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    report_json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS provenance_events (
    event_id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    action TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    processing_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS datasets_investigation_idx ON datasets(investigation_id);
CREATE INDEX IF NOT EXISTS measurements_dataset_idx ON measurements(dataset_id);
CREATE INDEX IF NOT EXISTS measurements_run_idx ON measurements(run_id);
CREATE INDEX IF NOT EXISTS runs_dataset_idx ON runs(dataset_id);
CREATE INDEX IF NOT EXISTS investigations_category_idx ON investigations(category);
