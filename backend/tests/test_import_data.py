"""Synthetic scientific rows exist only in these isolated import tests."""
import hashlib
import json

import pytest

from app.import_data import ImportMetadata, MeasurementRow, ingest_file
from app import research_store as store


@pytest.fixture()
def archive(tmp_path, monkeypatch):
    monkeypatch.setenv("FLAME_DATA_DIR", str(tmp_path / "archive"))
    store.initialize()
    return tmp_path


def metadata(**changes):
    return {
        "investigation_id": "TEST_ONLY", "investigation_name": "Synthetic import test; not NASA data",
        "source_id": "test:fixture", "source_name": "Synthetic test fixture",
        "source_url": "https://psi.nasa.gov/test-fixture-not-real",
        "organization": "TEST FIXTURE", "dataset_version": "test-v1",
        "license": "Synthetic automated test fixture only", "authorized": True,
        **changes,
    }


def row(**changes):
    return {
        "run_id": "fixture-run-1", "measurement_name": "flame_spread_rate",
        "measurement_kind": "direct_observation", "value": 2.5, "unit": "mm/s",
        "source_location": "synthetic fixture row 1", "gravity_regime": "microgravity",
        "fuel": "synthetic test material", "oxygen_value": 21, "oxygen_basis": "volume_fraction",
        "oxygen_unit": "%", "pressure_value": 101.325, "pressure_unit": "kPa",
        "airflow_value": 2, "airflow_unit": "cm/s", "uncertainty": .1,
        "calibration": "synthetic fixture calibration", **changes,
    }


def import_json(path, records, meta=None):
    path.write_text(json.dumps(records), encoding="utf-8")
    return ingest_file(path, meta or metadata())


def test_idempotent_import_and_measurement_provenance(archive):
    path = archive / "fixture.json"
    first = import_json(path, [row()])
    assert first["status"] == "completed", first
    assert first["training_eligible_rows"] == 1
    assert first["sha256"] == hashlib.sha256(path.read_bytes()).hexdigest()
    second = ingest_file(path, metadata())
    assert second["status"] == "skipped"
    assert second["dataset_id"] == first["dataset_id"]
    records = store.list_measurements("TEST_ONLY")
    assert len(records) == 1
    assert records[0]["value"] == 2.5
    assert records[0]["unit"] == "mm/s"
    assert records[0]["normalized_value"] == pytest.approx(.0025)
    assert records[0]["normalized_unit"] == "m/s"
    assert records[0]["processing"]["normalized_uncertainty"] == pytest.approx(.0001)
    assert records[0]["uncertainty"] == .1
    assert records[0]["normalized_uncertainty"] == pytest.approx(.0001)
    assert records[0]["oxygen_basis"] == "volume_fraction"
    assert records[0]["processing"]["input_sha256"] == first["sha256"]
    detail = store.investigation_detail("TEST_ONLY")
    assert detail["measurement_count"] == 1
    assert len(detail["runs"]) == 1
    assert detail["sources"][0]["trust_classification"] == "operator_attested"
    assert len(store.list_datasets("TEST_ONLY")) == 1
    assert [j["status"] for j in store.list_jobs()] == ["skipped", "completed"] or sorted(j["status"] for j in store.list_jobs()) == ["completed", "skipped"]


@pytest.mark.parametrize("changes", [
    {"value": float("nan")}, {"value": float("inf")}, {"value": -1},
    {"oxygen_value": 101}, {"oxygen_basis": None}, {"oxygen_unit": "kPa"},
    {"pressure_value": 0}, {"gravity_regime": "earth-ish"},
    {"unit": "K"}, {"measurement_name": "unclassified_score"},
    {"oxygen_value": 200, "oxygen_basis": "partial_pressure", "oxygen_unit": "kPa"},
    {"extra_guess": 30}, {"uncertainty": -1},
    {"value": True}, {"pressure_value": 1e308},
    {"measurement_name": "total_pressure", "unit": "kPa", "value": 1e308},
])
def test_malformed_scientific_rows_quarantined_atomically(archive, changes):
    result = import_json(archive / "bad.json", [row(), row(run_id="fixture-run-2", **changes)])
    assert result["status"] == "quarantined"
    assert store.list_datasets() == []
    assert store.list_measurements() == []
    assert (store.data_dir() / "quarantine" / result["job_id"].replace(":", "_") / "error.json").exists()


def test_missing_conditions_and_models_are_not_training_observations(archive):
    first = import_json(archive / "missing.json", [row(uncertainty=None, calibration=None)])
    assert first["status"] == "completed"
    assert first["training_eligible_rows"] == 0
    second = import_json(archive / "model.json", [row(measurement_kind="reported_model")])
    assert second["status"] == "completed"
    assert second["training_eligible_rows"] == 0
    assert all(not record["training_eligible"] for record in store.list_measurements())


def test_fraction_bases_preserved_and_partial_pressure_checked(archive):
    first = import_json(archive / "mass.json", [row(oxygen_basis="mass_fraction", oxygen_unit="fraction", oxygen_value=.23)])
    assert first["status"] == "completed"
    actual = store.list_measurements()[0]
    assert actual["oxygen_basis"] == "mass_fraction"
    assert actual["oxygen_value"] == .23
    assert actual["oxygen_unit"] == "fraction"
    invalid = import_json(archive / "partial.json", [row(oxygen_value=110000, oxygen_basis="partial_pressure", oxygen_unit="Pa")])
    assert invalid["status"] == "quarantined"
    assert len(store.list_measurements()) == 1


def test_checksum_mismatch_and_unauthorized_source(archive):
    path = archive / "checksum.json"
    result = import_json(path, [row()], metadata(expected_sha256="0" * 64))
    assert result["status"] == "quarantined"
    assert "checksum" in str(result["errors"]).lower()
    result = ingest_file(path, metadata(authorized=False))
    assert result["status"] == "quarantined"
    result = ingest_file(path, metadata(source_url="https://example.invalid/fake-nasa"))
    assert result["status"] == "quarantined"


@pytest.mark.parametrize("records", [
    [row(), row()],
    [row(time_s=2), row(time_s=1)],
    [row(time_s=1), row(time_s=2, pressure_value=80)],
])
def test_duplicate_timestamps_and_contradictory_runs(archive, records):
    result = import_json(archive / "series.json", records)
    assert result["status"] == "quarantined"
    assert store.list_measurements() == []


def test_metadata_revision_creates_new_dataset_without_overwriting_raw(archive):
    path = archive / "version.json"
    first = import_json(path, [row()])
    raw = store.data_dir() / "raw" / "imports" / (first["sha256"] + ".json")
    original = raw.read_bytes()
    second = ingest_file(path, metadata(dataset_version="test-v2"))
    assert second["status"] == "completed"
    assert second["version"] == 2
    assert raw.read_bytes() == original
    assert len(store.list_datasets()) == 2
    with store.connection() as conn:
        assert conn.execute("SELECT count(*) FROM provenance_events").fetchone()[0] == 2
        assert conn.execute("PRAGMA foreign_key_check").fetchall() == []


def test_csv_tsv_and_wrong_shape(archive):
    import csv
    record = row()
    for extension, delimiter in ((".csv", ","), (".tsv", "\t")):
        path = archive / ("table" + extension)
        with path.open("w", newline="", encoding="utf-8") as stream:
            writer = csv.DictWriter(stream, fieldnames=list(record), delimiter=delimiter)
            writer.writeheader()
            writer.writerow(record)
        result = ingest_file(path, metadata(dataset_version=extension))
        assert result["status"] == "completed", result
    bad = archive / "shape.json"
    bad.write_text('{"measurements":[]}', encoding="utf-8")
    assert ingest_file(bad, metadata())["status"] == "quarantined"


def test_registry_search_is_literal_and_sql_parameterized(archive):
    import_json(archive / "fixture.json", [row()])
    assert store.list_investigations(q="Synthetic")["total"] == 1
    assert store.list_investigations(q="%") ["total"] == 0
    assert store.list_investigations(q="' OR 1=1 --")["total"] == 0
    assert store.investigation_detail("missing") is None
    assert store.list_investigations(limit=500)["limit"] == 200
    with store.connection() as conn:
        store.put_investigation(conn, {"investigation_id": "ACRONYM", "name": "ACRONYM", "full_name": "Expanded fixture research name", "summary": "Synthetic test only"})
    assert store.list_investigations(q="Expanded fixture research name")["total"] == 1


def test_legacy_corpus_migration_does_not_invent_runs_or_modify_manifest(archive):
    root = store.data_dir()
    root.mkdir(parents=True, exist_ok=True)
    original = json.dumps({"corpus_version": "fixture-version", "papers": [{"paper_id": "ntrs:fixture", "title": "Synthetic test publication", "year": 2020, "source_record_id": "fixture", "official_url": "https://example.invalid/fixture", "synthetic": True}]})
    (root / "manifest.json").write_text(original, encoding="utf-8")
    sources = store.list_sources()
    assert len(sources) == 1
    assert sources[0]["trust_classification"] == "test_fixture"
    assert (root / "manifest.json").read_text(encoding="utf-8") == original
    assert store.list_measurements() == []
    assert store.list_datasets() == []


def test_download_requires_redistribution_and_original_digest(archive):
    path = archive / "download.json"
    first = import_json(path, [row()])
    assert store.resolve_download(first["dataset_id"]) is None
    allowed = ingest_file(path, metadata(redistribution_allowed=True))
    result = store.resolve_download(allowed["dataset_id"])
    assert result["path"].read_bytes() == path.read_bytes()
    assert result["media_type"] == "application/json"
    assert result["filename"] == allowed["sha256"] + ".json"
    result["path"].write_text("tampered", encoding="utf-8")
    assert store.resolve_download(allowed["dataset_id"]) is None


def test_models_are_separate_from_observation_count_and_aliases(archive):
    import_json(archive / "observed.json", [row()])
    import_json(archive / "model.json", [row(measurement_kind="reported_model")])
    detail = store.investigation_detail("TEST_ONLY")
    assert detail["measurement_count"] == 1
    assert detail["total_measurement_count"] == 2
    assert detail["reported_model_count"] == 1
    records = detail["measurements"]
    assert all(r["measurement_family"] == "flame_spread_rate" for r in records)
    assert {r["evidence_class"] for r in records} == {"directly_observed_result", "model_prediction"}


def test_metadata_overlay_migrates_corrected_date_without_changing_manifest(archive):
    root = store.data_dir()
    manifest = {"papers": [{"paper_id": "ntrs:fixture", "title": "Synthetic historical date test", "year": 2024, "official_url": "https://example.invalid", "synthetic": True}]}
    original = json.dumps(manifest)
    (root / "manifest.json").write_text(original, encoding="utf-8")
    correction = {"paper_id": "ntrs:fixture", "field": "year", "corrected_value": 2014, "publication_date": "2014-01-01", "source_url": "https://example.invalid"}
    (root / "research_catalog.json").write_text(json.dumps({"metadata_corrections": [correction]}), encoding="utf-8")
    source = store.list_sources()[0]
    assert source["publication_date"] == "2014-01-01"
    assert source["processing_history"][-1] == correction
    assert (root / "manifest.json").read_text(encoding="utf-8") == original


def test_download_rejects_database_path_traversal(archive):
    first = import_json(archive / "fixture.json", [row()], metadata(redistribution_allowed=True))
    outside = archive / "outside.json"
    outside.write_text("private", encoding="utf-8")
    with store.connection() as conn:
        conn.execute("UPDATE datasets SET raw_path=?,file_sha256=? WHERE dataset_id=?", ("../outside.json", hashlib.sha256(outside.read_bytes()).hexdigest(), first["dataset_id"]))
    assert store.resolve_download(first["dataset_id"]) is None


def test_concurrent_identical_imports_converge_to_one_dataset(archive):
    from concurrent.futures import ThreadPoolExecutor
    path = archive / "concurrent.json"
    path.write_text(json.dumps([row()]), encoding="utf-8")
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda _: ingest_file(path, metadata()), range(2)))
    assert sorted(result["status"] for result in results) == ["completed", "skipped"]
    assert len(store.list_datasets()) == 1
    assert len(store.list_measurements()) == 1


def test_catalog_reseed_preserves_checksum_and_processing_history(archive):
    root = store.data_dir()
    catalog_source = {"source_id": "test:fixture", "name": "Curated synthetic metadata", "original_url": metadata()["source_url"], "doi": "10.test/fixture", "license": "Synthetic terms", "retrieval_status": "indexed_metadata", "processing_history": [{"method": "curated_metadata"}], "file_checksums": []}
    (root / "research_catalog.json").write_text(json.dumps({"sources": [catalog_source]}), encoding="utf-8")
    result = import_json(archive / "fixture.json", [row()])
    assert result["status"] == "completed"
    source = store.list_sources()[0]
    assert source["doi"] == "10.test/fixture"
    assert source["license"] == "Synthetic terms"
    assert source["retrieval_status"] == "indexed_metadata"
    assert source["file_checksums"][-1]["sha256"] == result["sha256"]
    assert len(source["processing_history"]) == 2
    catalog_source["doi"] = None
    catalog_source["name"] = "Revised synthetic metadata"
    (root / "research_catalog.json").write_text(json.dumps({"sources": [catalog_source]}), encoding="utf-8")
    source = store.list_sources()[0]
    assert source["doi"] == "10.test/fixture"
    assert source["name"] == "Revised synthetic metadata"
    assert source["file_checksums"][-1]["sha256"] == result["sha256"]
    assert len(source["processing_history"]) == 2
