import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient


def _write(path: Path, payload) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


@pytest.fixture()
def client(tmp_path, monkeypatch):
    root = tmp_path / "data"
    text = (
        "FIXTURE DOCUMENT. This is not a NASA record. The cotton-fiberglass fabric burned in microgravity. "
        "The fixture text reports a flame spread rate of 2.5 mm/s at 21 percent oxygen under a forced flow."
    )
    _write(
        root / "manifest.json",
        {
            "corpus_version": "fixture",
            "built_at": None,
            "limitations": ["Fixture corpus for tests."],
            "papers": [
                {
                    "paper_id": "ntrs:fixture",
                    "source": "ntrs",
                    "source_record_id": "fixture",
                    "title": "FIXTURE — not a NASA record",
                    "authors": [],
                    "year": 2020,
                    "abstract": "A synthetic fixture used only by automated tests.",
                    "official_url": "https://example.invalid/fixture",
                    "pdf_url": None,
                    "pdf_status": "downloaded",
                    "local_pdf_path": None,
                    "topics": ["fixture"],
                    "extraction_status": "extracted",
                    "extraction_notes": "synthetic fixture",
                    "synthetic": True,
                    "center": "Fixture",
                    "sti_type": "FIXTURE",
                }
            ],
        },
    )
    _write(
        root / "extracts" / "ntrs__fixture.json",
        {
            "paper_id": "ntrs:fixture",
            "extractor": "fixture",
            "pages": [{"page_id": "ntrs:fixture#p1", "page_number": 1, "text": text, "quality_flags": []}],
        },
    )
    _write(
        root / "studies.json",
        {
            "studies": [
                {
                    "study_id": "ntrs:fixture#s1",
                    "paper_id": "ntrs:fixture",
                    "label": "Fixture fabric",
                    "experiment_program": None,
                    "fuel_as_reported": "cotton-fiberglass",
                    "fuel_family": "fabric",
                    "gravity_regime": "microgravity",
                    "platform": "iss",
                    "oxygen_mole_fraction": 0.21,
                    "oxygen_as_reported": "21 percent",
                    "pressure_kpa": None,
                    "pressure_as_reported": None,
                    "ambient_gas": None,
                    "method": None,
                    "limitations": ["analyst: fixture"],
                    "provenance": {"page_number": 1, "location": "page"},
                }
            ],
            "measurements": [
                {
                    "measurement_id": "ntrs:fixture#s1#m1",
                    "study_id": "ntrs:fixture#s1",
                    "paper_id": "ntrs:fixture",
                    "measurement_as_reported": "flame spread rate",
                    "measurement_family": "flame_spread_rate",
                    "value": 2.5,
                    "unit": "mm/s",
                    "uncertainty": None,
                    "normalized_value": None,
                    "normalized_unit": None,
                    "conversion_note": None,
                    "verification_status": "verified",
                    "provenance": {"page_number": 1, "location": "page"},
                    "synthetic": True,
                }
            ],
            "comparison_rules_version": "1",
        },
    )
    monkeypatch.setenv("FLAME_DATA_DIR", str(root))
    from app.main import app

    with TestClient(app) as test_client:
        yield test_client


def test_health_and_fixture_are_labeled(client):
    health = client.get("/api/health")
    assert health.status_code == 200
    assert health.json()["status"] == "ok"
    papers = client.get("/api/papers").json()["papers"]
    assert papers[0]["synthetic"] is True
    assert "FIXTURE" in papers[0]["title"]


def test_ask_and_missing_records(client):
    grounded = client.post("/api/ask", json={"question": "What flame spread rate was reported for the cotton fabric?"})
    assert grounded.status_code == 200
    body = grounded.json()
    assert body["reported"]
    assert body["reported"][0]["quote"] in body["passages"][0]["text"]
    refused = client.post("/api/ask", json={"question": "What is the certified lunar fire risk?"})
    assert refused.status_code == 200
    assert refused.json()["answer_mode"] == "insufficient"
    missing = client.get("/api/papers/ntrs:missing")
    assert missing.status_code == 404
    assert missing.json()["error"]["code"] == "paper_not_found"


def test_real_manifest_urls_are_ntrs_and_not_synthetic():
    manifest = Path(__file__).resolve().parents[1] / "data" / "manifest.json"
    if not manifest.exists():
        pytest.skip("corpus has not been ingested")
    payload = json.loads(manifest.read_text(encoding="utf-8"))
    papers = payload.get("papers") or []
    if not papers:
        pytest.skip("corpus is empty")
    assert payload.get("corpus_version") not in (None, "0", "fixture")
    for paper in papers:
        assert paper["synthetic"] is False
        assert paper["official_url"].startswith("https://ntrs.nasa.gov/citations/")
        assert paper["title"].strip()
        assert paper["source"] == "ntrs"
        assert "FIXTURE" not in paper["title"].upper()
