"""Authorized offline scientific imports. No remote URL fetch or public upload.

Run: python -m app.import_data ingest file.csv --metadata metadata.json
     python -m app.import_data jobs
CSV/TSV use the MeasurementRow field names; JSON is an array of such rows.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import math
import os
from pathlib import Path
import re
from typing import Literal
from urllib.parse import urlsplit
import uuid

from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator, model_validator

from app.config import data_dir
from app import research_store as store

MAX_BYTES = 50 * 1024 * 1024
MAX_ROWS = 100_000
MAX_METADATA_BYTES = 256 * 1024

# Conversion factors are exact SI scale changes. Oxygen composition bases are
# deliberately absent: a mass fraction is not converted into a mole fraction.
UNITS = {
    "m/s": ("m/s", 1.0), "cm/s": ("m/s", .01), "mm/s": ("m/s", .001),
    "m": ("m", 1.0), "cm": ("m", .01), "mm": ("m", .001),
    "Pa": ("Pa", 1.0), "kPa": ("Pa", 1000.0), "atm": ("Pa", 101325.0),
    "K": ("K", 1.0), "s": ("s", 1.0), "ms": ("s", .001),
    "W": ("W", 1.0), "kW": ("W", 1000.0),
    "kg/m3": ("kg/m3", 1.0), "mg/m3": ("kg/m3", .000001),
}
DEFINITIONS = {
    "flame_spread_rate": "m/s", "extinction_velocity": "m/s", "airflow_velocity": "m/s",
    "flame_length": "m", "droplet_diameter": "m", "smoke_particle_diameter": "m",
    "flame_temperature": "K", "ambient_temperature": "K", "total_pressure": "Pa",
    "ignition_delay": "s", "burning_duration": "s", "heat_release_rate": "W",
    "soot_mass_concentration": "kg/m3",
}


class ImportMetadata(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)
    investigation_id: str = Field(min_length=1, max_length=120, pattern=r"^[A-Za-z0-9:_.-]+$")
    investigation_name: str | None = Field(default=None, max_length=300)
    source_id: str = Field(min_length=1, max_length=120, pattern=r"^[A-Za-z0-9:_.-]+$")
    source_name: str = Field(min_length=1, max_length=300)
    source_url: str = Field(min_length=8, max_length=2000)
    organization: str = Field(min_length=1, max_length=200)
    dataset_version: str = Field(min_length=1, max_length=100)
    license: str = Field(min_length=1, max_length=2000)
    authorized: bool = Field(strict=True)
    redistribution_allowed: bool = Field(default=False, strict=True)
    source_type: Literal["psi", "publication", "other"] = "psi"
    expected_sha256: str | None = Field(default=None, pattern=r"^[a-fA-F0-9]{64}$")
    access_date: str | None = Field(default=None, max_length=60)
    doi: str | None = Field(default=None, max_length=200)
    notes: str | None = Field(default=None, max_length=4000)

    @model_validator(mode="after")
    def authorized_source(self):
        if not self.authorized:
            raise ValueError("An authorized operator must attest that this local file was legitimately obtained.")
        url = urlsplit(self.source_url)
        if url.scheme != "https" or not url.hostname or url.username or url.password:
            raise ValueError("Source URL must be an HTTPS attribution URL without credentials.")
        if self.source_type == "psi" and url.hostname != "psi.nasa.gov":
            raise ValueError("PSI imports must cite an official psi.nasa.gov source record.")
        return self


class MeasurementRow(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)
    run_id: str = Field(min_length=1, max_length=150)
    measurement_name: str = Field(min_length=1, max_length=100)
    measurement_kind: Literal["direct_observation", "reported_model"]
    value: float = Field(ge=0)
    unit: str = Field(min_length=1, max_length=30)
    source_location: str = Field(min_length=1, max_length=500)
    gravity_regime: Literal["microgravity", "normal_gravity", "lunar_gravity", "martian_gravity", "partial_gravity", "not_reported"]
    fuel: str | None = Field(default=None, max_length=200)
    oxygen_value: float | None = Field(default=None, ge=0)
    oxygen_basis: Literal["mole_fraction", "volume_fraction", "mass_fraction", "partial_pressure"] | None = None
    oxygen_unit: Literal["fraction", "%", "Pa", "kPa", "atm"] | None = None
    pressure_value: float | None = Field(default=None, gt=0)
    pressure_unit: Literal["Pa", "kPa", "atm"] | None = None
    airflow_value: float | None = Field(default=None, ge=0)
    airflow_unit: Literal["m/s", "cm/s", "mm/s"] | None = None
    uncertainty: float | None = Field(default=None, ge=0)
    time_s: float | None = Field(default=None, ge=0)
    calibration: str | None = Field(default=None, max_length=2000)

    @field_validator("value", "oxygen_value", "pressure_value", "airflow_value", "uncertainty", "time_s", mode="before")
    @classmethod
    def reject_boolean_measurements(cls, value):
        if isinstance(value, bool):
            raise ValueError("A boolean is not a scientific numerical measurement.")
        return value

    @field_validator("run_id", "source_location", "fuel", "calibration")
    @classmethod
    def nonblank(cls, value):
        if value is not None and not value.strip():
            raise ValueError("Text values cannot be blank.")
        return value

    @model_validator(mode="after")
    def scientific_conditions(self):
        if self.measurement_name not in DEFINITIONS:
            raise ValueError("Unclassified measurement definition; add a reviewed definition before import.")
        if self.unit not in UNITS or UNITS[self.unit][0] != DEFINITIONS[self.measurement_name]:
            raise ValueError("Measurement unit is incompatible with its definition.")
        if not math.isfinite(self.value * UNITS[self.unit][1]):
            raise ValueError("SI normalization would overflow the finite numeric range.")
        if self.uncertainty is not None and not math.isfinite(self.uncertainty * UNITS[self.unit][1]):
            raise ValueError("Uncertainty normalization would overflow the finite numeric range.")
        if self.measurement_name in {"flame_temperature", "ambient_temperature", "total_pressure"} and self.value <= 0:
            raise ValueError("Absolute temperature and total pressure must be positive.")
        for names in (("oxygen_value", "oxygen_basis", "oxygen_unit"), ("pressure_value", "pressure_unit"), ("airflow_value", "airflow_unit")):
            present = [getattr(self, name) is not None for name in names]
            if any(present) and not all(present):
                raise ValueError("Condition values require explicit bases and units: " + ", ".join(names))
        for value, unit in ((self.pressure_value, self.pressure_unit), (self.airflow_value, self.airflow_unit)):
            if value is not None and not math.isfinite(value * UNITS[unit][1]):
                raise ValueError("Condition normalization exceeds the finite numeric range.")
        if self.oxygen_value is not None:
            if self.oxygen_basis == "partial_pressure":
                if self.oxygen_unit not in {"Pa", "kPa", "atm"}:
                    raise ValueError("Oxygen partial pressure needs pressure units.")
                if not math.isfinite(self.oxygen_value * UNITS[self.oxygen_unit][1]):
                    raise ValueError("Oxygen partial pressure normalization exceeds the finite numeric range.")
                if self.pressure_value is not None:
                    partial = self.oxygen_value * UNITS[self.oxygen_unit][1]
                    total = self.pressure_value * UNITS[self.pressure_unit][1]
                    if partial > total:
                        raise ValueError("Oxygen partial pressure exceeds total pressure.")
            elif self.oxygen_unit not in {"fraction", "%"}:
                raise ValueError("An oxygen fraction requires fraction or percent units.")
            elif self.oxygen_value > (100 if self.oxygen_unit == "%" else 1):
                raise ValueError("Oxygen fraction is outside its physical range.")
        return self


def _immutable_write(path: Path, content: bytes) -> None:
    base = data_dir().resolve()
    resolved = path.resolve()
    if not resolved.is_relative_to(base):
        raise ValueError("Artifact path escapes the configured data directory.")
    if any(part.is_symlink() for part in [path, *path.parents] if part.is_relative_to(data_dir())):
        raise ValueError("Artifact paths must not contain symbolic links.")
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.parent / ("." + uuid.uuid4().hex + ".part")
    try:
        with temporary.open("xb") as stream:
            stream.write(content)
            stream.flush()
            os.fsync(stream.fileno())
        try:
            # An atomic create-if-absent prevents interrupted writes and never
            # replaces a previously committed content-addressed artifact.
            os.link(temporary, path)
        except FileExistsError:
            if path.read_bytes() != content:
                raise ValueError("Existing immutable artifact has different content.")
    finally:
        temporary.unlink(missing_ok=True)


def _error_details(exc: Exception) -> list[dict]:
    if isinstance(exc, ValidationError):
        return [{"location": list(e["loc"]), "message": e["msg"], "type": e["type"]} for e in exc.errors()]
    return [{"message": str(exc), "type": type(exc).__name__}]


def _parse(content: bytes, suffix: str) -> list[dict]:
    text = content.decode("utf-8-sig")
    if "\x00" in text:
        raise ValueError("NUL bytes are forbidden in tabular data.")
    if suffix == ".json":
        records = json.loads(text)
        if not isinstance(records, list):
            raise ValueError("JSON scientific data must contain an array of measurement objects.")
    else:
        reader = csv.DictReader(io.StringIO(text), delimiter="\t" if suffix == ".tsv" else ",")
        fields = reader.fieldnames or []
        if len(fields) != len(set(fields)):
            raise ValueError("Duplicate column names are ambiguous.")
        records = []
        for row in reader:
            if len(records) >= MAX_ROWS:
                raise ValueError("Import exceeds the row limit.")
            if None in row:
                raise ValueError("Row has more values than the declared columns.")
            records.append({key: (None if value is None or value.strip() == "" else value) for key, value in row.items()})
    if not records or len(records) > MAX_ROWS:
        raise ValueError("Data must contain between 1 and 100000 measurement rows.")
    return records


def _job(conn, job_id, status, *, checksum=None, dataset_id=None, progress=0, report=None):
    conn.execute("UPDATE ingestion_jobs SET status=?,file_sha256=?,dataset_id=?,progress=?,updated_at=?,report_json=? WHERE job_id=?", (status, checksum, dataset_id, progress, store.now(), store.encode(report or {}), job_id))


def ingest_file(path: str | Path, metadata: dict | str | Path) -> dict:
    """Import one authorized local file atomically; report malformed files in quarantine.

    Metadata authorization is operator attestation, not proof of NASA validation.
    Parsed numerical values are never approved as engineering safety predictions.
    """
    store.initialize()
    source_path = Path(path)
    job_id = "job:" + uuid.uuid4().hex
    started = store.now()
    with store.connection() as conn:
        conn.execute("INSERT INTO ingestion_jobs VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", (job_id, "queued", source_path.name, None, None, 0, started, started, "{}"))
    content, checksum = None, None
    try:
        with store.connection() as conn:
            _job(conn, job_id, "processing", progress=5)
        suffix = source_path.suffix.lower()
        if suffix not in {".csv", ".tsv", ".json"}:
            raise ValueError("Supported measurement adapters are CSV, TSV and JSON; archives, spreadsheets and executables are not accepted.")
        if not source_path.is_file() or source_path.is_symlink():
            raise ValueError("Input must be an ordinary local file.")
        if source_path.stat().st_size > MAX_BYTES:
            raise ValueError("File exceeds the 50 MiB import limit.")
        with source_path.open("rb") as stream:
            content = stream.read(MAX_BYTES + 1)
        if len(content) > MAX_BYTES:
            raise ValueError("File exceeds the 50 MiB import limit.")
        checksum = hashlib.sha256(content).hexdigest()
        if isinstance(metadata, (str, Path)):
            metadata_path = Path(metadata)
            if metadata_path.stat().st_size > MAX_METADATA_BYTES:
                raise ValueError("Metadata exceeds the 256 KiB limit.")
            metadata = json.loads(metadata_path.read_text(encoding="utf-8-sig"))
        meta = ImportMetadata.model_validate(metadata)
        if meta.expected_sha256 and meta.expected_sha256.lower() != checksum:
            raise ValueError("SHA-256 checksum does not match the operator-supplied expected checksum.")
        metadata_dump = meta.model_dump(exclude_none=True)
        meta_hash = hashlib.sha256(store.encode(metadata_dump).encode("utf-8")).hexdigest()
        with store.connection() as conn:
            existing = conn.execute("SELECT dataset_id FROM datasets WHERE file_sha256=? AND metadata_sha256=?", (checksum, meta_hash)).fetchone()
            if existing:
                report = {"dataset_id": existing[0], "sha256": checksum, "duplicate": True}
                _job(conn, job_id, "skipped", checksum=checksum, dataset_id=existing[0], progress=100, report=report)
                return {"job_id": job_id, "status": "skipped", **report}
        records = _parse(content, suffix)
        rows, errors = [], []
        for number, record in enumerate(records, start=1):
            try:
                rows.append(MeasurementRow.model_validate(record))
            except (ValidationError, ValueError) as exc:
                errors.append({"row": number, "errors": _error_details(exc)})
                if len(errors) >= 100:
                    break
        if errors:
            raise RowValidationError(errors)
        _validate_series(rows)
        raw_path = Path("raw") / "imports" / (checksum + suffix)
        _immutable_write(data_dir() / raw_path, content)
        _immutable_write(data_dir() / "raw" / "imports" / (checksum + "." + meta_hash + ".metadata.json"), (store.encode(metadata_dump) + "\n").encode("utf-8"))
        dataset_id = "dataset:" + hashlib.sha256((checksum + meta_hash).encode()).hexdigest()[:32]
        warnings = []
        with store.connection() as conn:
            # Serialize the final commit across CLI processes and recheck the
            # digest: two simultaneous imports must converge to one dataset.
            conn.execute("BEGIN IMMEDIATE")
            existing = conn.execute("SELECT dataset_id FROM datasets WHERE file_sha256=? AND metadata_sha256=?", (checksum, meta_hash)).fetchone()
            if existing:
                report = {"dataset_id": existing[0], "sha256": checksum, "duplicate": True}
                _job(conn, job_id, "skipped", checksum=checksum, dataset_id=existing[0], progress=100, report=report)
                return {"job_id": job_id, "status": "skipped", **report}
            if not conn.execute("SELECT 1 FROM investigations WHERE investigation_id=?", (meta.investigation_id,)).fetchone():
                if not meta.investigation_name:
                    raise ValueError("Unknown investigation: register its attributed metadata or supply investigation_name explicitly.")
                store.put_investigation(conn, {"investigation_id": meta.investigation_id, "name": meta.investigation_name, "source_ids": [meta.source_id], "limitations": ["Investigation name supplied by import operator; metadata requires source review."]})
            existing_source = conn.execute("SELECT * FROM sources WHERE source_id=?", (meta.source_id,)).fetchone()
            if existing_source and existing_source["original_url"] != meta.source_url:
                raise ValueError("Source identifier already uses a different attribution URL.")
            if not existing_source:
                store.put_source(conn, {"source_id": meta.source_id, "name": meta.source_name, "organization": meta.organization, "original_url": meta.source_url, "retrieval_status": "operator_imported", "trust_classification": "operator_attested", "extraction_method": "authorized_offline_tabular_import", "access_date": meta.access_date, "dataset_version": meta.dataset_version, "license": meta.license, "doi": meta.doi, "file_checksums": [{"artifact": "imported_raw", "sha256": checksum}], "processing_history": [{"version": store.SOFTWARE_VERSION, "method": "operator_import", "timestamp": started}]})
            else:
                # Preserve curated attribution, DOI, dates, terms and trust
                # classification while recording this particular artifact.
                store.put_source(conn, {"source_id": meta.source_id, "file_checksums": [{"artifact": "imported_raw", "sha256": checksum}], "processing_history": [{"version": store.SOFTWARE_VERSION, "method": "operator_import", "timestamp": started, "file_sha256": checksum, "dataset_version": meta.dataset_version}]})
            conn.execute("INSERT OR IGNORE INTO investigation_sources VALUES (?, ?)", (meta.investigation_id, meta.source_id))
            version = conn.execute("SELECT coalesce(max(version), 0)+1 FROM datasets WHERE investigation_id=? AND source_id=?", (meta.investigation_id, meta.source_id)).fetchone()[0]
            conn.execute("INSERT INTO datasets VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", (dataset_id, meta.investigation_id, meta.source_id, version, source_path.name, checksum, meta_hash, raw_path.as_posix(), suffix[1:], len(rows), started, store.encode(metadata_dump)))
            seen_runs = set()
            eligible_count = 0
            for number, row in enumerate(rows, start=1):
                run_id = dataset_id + ":run:" + hashlib.sha256(row.run_id.encode()).hexdigest()[:16]
                if run_id not in seen_runs:
                    conditions = {k: v for k, v in row.model_dump().items() if k in CONDITION_FIELDS}
                    conn.execute("INSERT INTO runs VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", (run_id, dataset_id, row.run_id, row.gravity_regime, row.fuel, row.oxygen_value, row.oxygen_basis, row.oxygen_unit, row.pressure_value, row.pressure_unit, row.airflow_value, row.airflow_unit, store.encode(conditions)))
                    seen_runs.add(run_id)
                row_warnings = _warnings(row)
                eligible = row.measurement_kind == "direct_observation" and not row_warnings
                eligible_count += int(eligible)
                normalized_unit, factor = UNITS[row.unit]
                processing = {"software_version": store.SOFTWARE_VERSION, "input_sha256": checksum, "input_row": number, "method": "explicit_SI_scale_conversion", "parameters": {"factor": factor, "original_unit": row.unit, "normalized_unit": normalized_unit}, "normalized_uncertainty": row.uncertainty * factor if row.uncertainty is not None else None}
                conn.execute("INSERT INTO measurements VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", (dataset_id + ":m:" + str(number), dataset_id, run_id, row.measurement_name, row.measurement_kind, row.value, row.unit, row.value * factor, normalized_unit, row.uncertainty, row.time_s, row.source_location, number, int(eligible), store.encode({"status": "validated", "warnings": row_warnings}), store.encode(processing)))
                if row_warnings:
                    warnings.append({"row": number, "warnings": row_warnings})
            report = {"dataset_id": dataset_id, "sha256": checksum, "rows": len(rows), "runs": len(seen_runs), "training_eligible_rows": eligible_count, "warnings": warnings[:100], "warning_rows": len(warnings), "version": version, "processing_version": store.SOFTWARE_VERSION, "duplicate": False}
            _job(conn, job_id, "completed", checksum=checksum, dataset_id=dataset_id, progress=100, report=report)
            conn.execute("INSERT INTO provenance_events(entity_type,entity_id,action,timestamp,processing_json) VALUES (?, ?, ?, ?, ?)", ("dataset", dataset_id, "validated_import", started, store.encode(report)))
        return {"job_id": job_id, "status": "completed", **report}
    except Exception as exc:
        report = {"errors": exc.errors if isinstance(exc, RowValidationError) else _error_details(exc), "processing_version": store.SOFTWARE_VERSION}
        quarantine = data_dir() / "quarantine" / job_id.replace(":", "_")
        quarantine.mkdir(parents=True, exist_ok=True)
        if content is not None:
            _immutable_write(quarantine / "original.bin", content)
        _immutable_write(quarantine / "error.json", (store.encode(report) + "\n").encode("utf-8"))
        with store.connection() as conn:
            _job(conn, job_id, "quarantined", checksum=checksum, progress=100, report=report)
            conn.execute("INSERT INTO provenance_events(entity_type,entity_id,action,timestamp,processing_json) VALUES (?, ?, ?, ?, ?)", ("ingestion_job", job_id, "quarantined", store.now(), store.encode(report)))
        return {"job_id": job_id, "status": "quarantined", "sha256": checksum, **report}


CONDITION_FIELDS = ("gravity_regime", "fuel", "oxygen_value", "oxygen_basis", "oxygen_unit", "pressure_value", "pressure_unit", "airflow_value", "airflow_unit", "calibration")


class RowValidationError(ValueError):
    def __init__(self, errors):
        super().__init__("Measurement rows failed scientific validation.")
        self.errors = errors


def _validate_series(rows: list[MeasurementRow]):
    conditions, seen, times = {}, set(), {}
    for number, row in enumerate(rows, start=1):
        signature = tuple(getattr(row, key) for key in CONDITION_FIELDS)
        if row.run_id in conditions and conditions[row.run_id] != signature:
            raise ValueError(f"Run {row.run_id} has contradictory conditions at row {number}; split runs when conditions change.")
        conditions[row.run_id] = signature
        identity = (row.run_id, row.measurement_name, row.time_s)
        if identity in seen:
            raise ValueError(f"Duplicate measurement or timestamp at row {number}.")
        seen.add(identity)
        if row.time_s is not None:
            series = (row.run_id, row.measurement_name)
            if series in times and row.time_s <= times[series]:
                raise ValueError(f"Nonmonotonic series timestamp at row {number}.")
            times[series] = row.time_s


def _warnings(row: MeasurementRow) -> list[str]:
    warnings = []
    for key in ("fuel", "oxygen_value", "pressure_value", "airflow_value", "uncertainty", "calibration"):
        if getattr(row, key) is None:
            warnings.append(key + "_not_reported")
    if row.gravity_regime == "not_reported":
        warnings.append("gravity_not_reported")
    if row.measurement_kind != "direct_observation":
        warnings.append("reported_model_excluded_from_observation_training")
    return warnings


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    ingest = commands.add_parser("ingest")
    ingest.add_argument("file")
    ingest.add_argument("--metadata", required=True)
    commands.add_parser("jobs")
    args = parser.parse_args()
    if args.command == "jobs":
        result = store.list_jobs()
    else:
        result = ingest_file(args.file, args.metadata)
    print(json.dumps(result, indent=2, ensure_ascii=False))
    return 1 if isinstance(result, dict) and result.get("status") == "quarantined" else 0


if __name__ == "__main__":
    raise SystemExit(main())
