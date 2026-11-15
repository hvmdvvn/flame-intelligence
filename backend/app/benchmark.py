"""Bounded warm-query benchmark; no synthetic experimental dataset is introduced."""
import json
import platform
import statistics
import time
from pathlib import Path

from app import research_store as store
from app.corpus import chunk_count, load_papers, now_iso
from app.intelligence import RankingIn, rank_investigations


def run():
    store.initialize()
    body = RankingIn(question="oxygen enriched solid material flammability", mission="lunar_habitat", oxygen_fraction=.34, pressure_kpa=70)
    tasks = {"investigation_search": lambda: store.list_investigations(q="flame"), "mission_ranking": lambda: rank_investigations(body)}
    timing = {}
    for name, fn in tasks.items():
        fn()
        values = []
        for _ in range(100):
            start = time.perf_counter()
            fn()
            values.append((time.perf_counter() - start) * 1000)
        timing[name] = {"iterations": len(values), "median_ms": round(statistics.median(values), 3), "p95_ms": round(sorted(values)[94], 3)}
    report = {"executed_at": now_iso(), "platform": platform.platform(), "processor": platform.processor(), "python": platform.python_version(), "investigations": store.list_investigations(limit=1)["total"], "sources": len(store.list_sources()), "papers": len(load_papers()), "chunks": chunk_count(), "datasets": len(store.list_datasets()), "imported_measurements": len(store.list_measurements()), "method": "Single process, sequential warm in-process calls; disk/cache effects included, no HTTP/network/browser/concurrency. 100 samples, nearest rank p95.", "timings": timing, "targets": "Local warm metadata search/ranking p95 < 200ms on this small corpus; not a production service guarantee."}
    path = Path(__file__).resolve().parents[2] / "qa" / "benchmark-results.json"
    path.parent.mkdir(exist_ok=True)
    path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    run()
