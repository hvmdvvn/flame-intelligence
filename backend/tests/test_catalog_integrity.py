"""Checks shipped source metadata against retained local evidence, without network claims."""
import json
from pathlib import Path

from app.corpus import load_papers, page_text, studies_with_measurements


ROOT = Path(__file__).resolve().parents[1] / "data"


def catalog():
    return json.loads((ROOT / "research_catalog.json").read_text(encoding="utf-8"))


def test_catalog_identity_and_source_resolution():
    data = catalog()
    sources = {s["source_id"] for s in data["sources"]}
    assert len(sources) == len(data["sources"])
    assert len({i["investigation_id"] for i in data["investigations"]}) == len(data["investigations"])
    for record in data["investigations"] + data["incidents"] + data["earth_applications"]:
        assert set(record["source_ids"]) <= sources
    assert all(s.get("access_date") and s.get("retrieval_status") and s.get("original_url", "").startswith("https://") for s in data["sources"])


def test_requested_coverage_is_metadata_not_fake_runs():
    data = catalog()
    names = {i["investigation_id"] for i in data["investigations"]}
    assert {"BASS", "BASS-II", "SAFFIRE-I", "SAFFIRE-II", "SAFFIRE-III", "FLEX", "FLEX-2", "SAME", "SAME-R", "CFI", "ACME", "BRE", "E-FIELD", "CFI-G", "SPICE", "SLICE", "DAFT", "DAFT-2"} <= names
    for inv in data["investigations"]:
        assert inv["datasets"] == []
        assert inv["conditions"]["oxygen_fraction"] is None
        assert inv["conditions"]["pressure_kpa"] is None


def test_apollo_13_is_an_oxygen_system_explosion():
    incident = next(i for i in catalog()["incidents"] if i["id"] == "apollo-13")
    assert incident["classification"] == "oxygen_system_failure_and_explosion"


def test_preserved_publication_values_resolve_to_pdf_pages(monkeypatch):
    monkeypatch.setenv("FLAME_DATA_DIR", str(ROOT))
    studies = studies_with_measurements()
    assert len(studies) == 4
    for study in studies:
        page = page_text(study["paper_id"], study["provenance"]["page_number"])
        assert page is not None
        for value in study["measurements"]:
            assert str(value["value"]) in page["text"]
            assert value["synthetic"] is False


def test_publication_year_corrections_preserve_originals(monkeypatch):
    monkeypatch.setenv("FLAME_DATA_DIR", str(ROOT))
    originals = {p["paper_id"]: p for p in json.loads((ROOT / "manifest.json").read_text(encoding="utf-8"))["papers"]}
    corrected = {p["paper_id"]: p for p in load_papers()}
    for correction in catalog()["metadata_corrections"]:
        identity = correction["paper_id"]
        assert originals[identity]["year"] == correction["original_value"]
        assert corrected[identity]["year"] == correction["corrected_value"]
        assert correction in corrected[identity]["metadata_corrections"]
