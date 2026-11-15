"""Verify the deployed filesystem model using isolated, synthetic seed inputs."""
import json
from concurrent.futures import ThreadPoolExecutor

from fastapi.testclient import TestClient

from app.vercel_runtime import prepare_runtime


def seed(tmp_path):
    root = tmp_path / "read-only-source"
    root.mkdir()
    payloads = {
        "manifest.json": {"papers": [], "corpus_version": "SYNTHETIC TEST ONLY"},
        "chunks.json": {"chunks": [], "corpus_version": "SYNTHETIC TEST ONLY"},
        "studies.json": {"studies": [], "measurements": []},
        "research_catalog.json": {
            "sources": [{"source_id": "test:source", "name": "SYNTHETIC SOURCE", "original_url": "https://example.invalid/fixture"}],
            "investigations": [{"investigation_id": "TEST", "name": "SYNTHETIC TEST", "summary": "Solid material flammability", "source_ids": ["test:source"], "gravity_regime": "microgravity"}],
        },
    }
    for name, payload in payloads.items():
        (root / name).write_text(json.dumps(payload), encoding="utf-8")
    (root / "raw").mkdir()
    (root / "raw" / "private.pdf").write_bytes(b"not a scientific source; must not be copied")
    return root


def test_ephemeral_bootstrap_is_idempotent_excludes_raw_and_preserves_seed(tmp_path, monkeypatch):
    monkeypatch.delenv("FLAME_STORAGE_MODE", raising=False)
    monkeypatch.delenv("FLAME_DATA_DIR", raising=False)
    root = seed(tmp_path)
    before = {p.name: p.read_bytes() for p in root.glob("*.json")}
    scratch = tmp_path / "scratch"
    with ThreadPoolExecutor(max_workers=3) as pool:
        results = list(pool.map(lambda _: prepare_runtime(root, scratch), range(3)))
    assert len(set(results)) == 1
    target = results[0]
    assert target.is_relative_to(scratch)
    assert not (target / "raw").exists()
    assert {p.name: p.read_bytes() for p in root.glob("*.json")} == before
    assert not (root / "research.sqlite").exists()


def test_ephemeral_backend_readiness_search_and_rankings(tmp_path, monkeypatch):
    monkeypatch.delenv("FLAME_STORAGE_MODE", raising=False)
    monkeypatch.delenv("FLAME_DATA_DIR", raising=False)
    target = prepare_runtime(seed(tmp_path), tmp_path / "scratch")
    from app.main import app, _requests
    _requests.clear()
    with TestClient(app) as client:
        assert client.get("/api/ready").status_code == 200
        assert client.get("/api/investigations?q=solid").json()["total"] == 1
        result = client.post("/api/rankings", json={"question": "solid flammability"})
        assert result.status_code == 200
        assert result.json()["rankings"][0]["investigation_id"] == "TEST"
        assert (target / "research.sqlite").exists()
        assert (target / "index" / "chunks.sqlite").exists()
