"""Scientific-integrity regressions; all numerical input here is synthetic test data."""
import hashlib
import json

import pytest
from fastapi.testclient import TestClient

from app.intelligence import RankingIn, rank_investigations, quantitative_analytics, research_report


@pytest.fixture
def registry(tmp_path, monkeypatch):
    monkeypatch.setenv("FLAME_DATA_DIR", str(tmp_path))
    catalog = {"sources": [{"source_id": "fixture:source", "name": "SYNTHETIC TEST SOURCE", "original_url": "https://example.invalid/test"}], "investigations": [
        {"investigation_id": "fixture:solid", "name": "SYNTHETIC solid", "summary": "Solid fuel flammability flame spread and extinction", "gravity_regime": "microgravity", "source_ids": ["fixture:source"], "conditions": {"oxygen_fraction": None, "pressure_kpa": None}},
        {"investigation_id": "fixture:smoke", "name": "SYNTHETIC smoke", "summary": "Smoke aerosol detection", "gravity_regime": "microgravity", "source_ids": ["fixture:source"]},
    ]}
    (tmp_path / "research_catalog.json").write_text(json.dumps(catalog), encoding="utf-8")
    return tmp_path


def test_ranking_is_reproducible_and_missing_is_not_imputed(registry):
    body = RankingIn(question="solid material flammability", mission="lunar_habitat", oxygen_fraction=.34, pressure_kpa=70)
    first = rank_investigations(body)
    assert first == rank_investigations(body)
    assert first["rankings"][0]["investigation_id"] == "fixture:solid"
    components = {c["dimension"]: c for c in first["rankings"][0]["components"]}
    assert components["gravity"]["value"] == 0
    assert components["conditions"]["value"] == 0
    assert "oxygen_fraction" in first["rankings"][0]["missing_fields"]
    assert any("partial_gravity" in gap for gap in first["gaps"])


def test_invalid_weights_and_nonfinite_values_are_rejected():
    for payload in ({"weights": dict.fromkeys(["topic", "gravity", "conditions", "quantitative", "provenance"], 0)}, {"oxygen_fraction": 21}, {"pressure_kpa": float("nan")}, {"weights": {"topic": -1}}):
        with pytest.raises(ValueError):
            RankingIn(question="flammability", **payload)


def test_model_and_observation_are_not_pooled(monkeypatch, registry):
    monkeypatch.setattr("app.intelligence.store.list_measurements", lambda: [])
    monkeypatch.setattr("app.intelligence.studies_with_measurements", lambda: [
        {"label": "SYNTHETIC observation", "method": "experiment", "measurements": [{"verification_status": "verified", "value": 2.2}]},
        {"label": "SYNTHETIC model", "method": "computational model", "measurements": [{"verification_status": "verified", "value": 2.8}]},
    ])
    result = quantitative_analytics()
    assert result["groups"] == []
    assert [r["evidence_class"] for r in result["published_values"]] == ["directly_observed_result", "model_prediction"]
    assert not any(r["training_eligible"] for r in result["published_values"])


def test_report_digest_and_citation_resolution(registry):
    report = research_report(RankingIn(question="solid flammability"))
    scientific = {k: report[k] for k in ("ranking", "analytics", "model_feasibility", "sources", "datasets", "corpus_version")}
    assert hashlib.sha256(json.dumps(scientific, sort_keys=True, ensure_ascii=False).encode()).hexdigest() == report["reproducibility_sha256"]
    sources = {s["source_id"] for s in report["sources"]}
    assert all(set(r["source_ids"]) <= sources for r in report["ranking"]["rankings"])


def test_api_workflow_and_security_controls(registry, monkeypatch):
    monkeypatch.setenv("API_POSTS_PER_MINUTE", "100")
    from app.main import app, _requests
    _requests.clear()
    with TestClient(app) as client:
        assert client.get("/api/ready").status_code == 200
        page = client.get("/api/investigations?q=solid&limit=1").json()
        assert page["total"] == 1
        assert client.get("/api/investigations/fixture:solid").json()["name"] == "SYNTHETIC solid"
        assert client.get("/api/investigations/missing").status_code == 404
        assert client.get("/api/investigations?limit=201").status_code == 400
        assert client.post("/api/rankings", json={"question": "flammability", "weights": {"topic": -1}}).status_code == 400
        response = client.post("/api/reports", json={"question": "solid flammability"})
        assert response.status_code == 200
        assert "attachment" in response.headers["content-disposition"]
        assert "X-Request-ID" in response.headers
        assert client.post("/api/ask", content="x" * 32769).status_code == 413
        assert client.get("/api/models").json()["evaluation"] is None
        assert client.get("/api/ingestion/jobs").status_code == 401
        monkeypatch.setenv("FLAME_ADMIN_TOKEN", "test-operator-token")
        assert client.get("/api/ingestion/jobs", headers={"Authorization": "Bearer test-operator-token"}).status_code == 200
        assert client.get("/api/datasets/missing/download").status_code == 404


def test_rate_limit(registry, monkeypatch):
    monkeypatch.setenv("API_POSTS_PER_MINUTE", "1")
    from app.main import app, _requests
    _requests.clear()
    with TestClient(app) as client:
        assert client.post("/api/rankings", json={"question": "flammability"}).status_code == 200
        assert client.post("/api/rankings", json={"question": "flammability"}).status_code == 429
    _requests.clear()
