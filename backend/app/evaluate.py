"""Executed source/citation regression, with honest per-case outcomes."""
import json
import os
from pathlib import Path
import sys

from app.config import data_dir
from app.corpus import get_chunk, now_iso, corpus_version
from app.rag import answer


def evaluate() -> dict:
    # Baseline evaluates deterministic extraction independent of optional paid services.
    os.environ["LLM_PROVIDER"] = ""
    suite = json.loads((Path(__file__).resolve().parents[1] / "data" / "evaluation-v1.json").read_text(encoding="utf-8"))
    results = []
    for case in suite["cases"]:
        response = answer(case["question"], paper_id=case.get("paper_id"))
        claims = response["reported"]
        attributable = all((chunk := get_chunk(c["chunk_id"])) is not None and c["quote"] in chunk["text"] and c["paper_id"] == chunk["paper_id"] and c["page_number"] == chunk["page_number"] and c["official_url"] == chunk["official_url"] for c in claims)
        expected_source = not case.get("expected_source") or any(c["paper_id"] == case["expected_source"] for c in claims)
        numeric = not case.get("expected_quote_substring") or any(case["expected_quote_substring"] in c["quote"] for c in claims)
        mode = response["answer_mode"] == case["expected_mode"]
        results.append({"id": case["id"], "passed": bool(mode and attributable and expected_source and numeric), "mode": response["answer_mode"], "checks": {"expected_mode": mode, "quote_and_citation_resolution": attributable, "expected_source": expected_source, "numerical_fidelity": numeric}, "retrieved_claims": [{"paper_id": c["paper_id"], "page_number": c["page_number"], "chunk_id": c["chunk_id"]} for c in claims], "reference": case["reference"]})
    report = {"suite_version": suite["version"], "executed_at": now_iso(), "corpus_version": corpus_version(), "retrieval": "fts5", "generative_provider": "none", "passed": sum(r["passed"] for r in results), "total": len(results), "results": results, "limitations": [suite["scope"], "No semantic entailment, expert review, contradiction-resolution score or LLM performance is established."]}
    destination = Path(__file__).resolve().parents[2] / "qa" / "evaluation-results.json"
    destination.parent.mkdir(exist_ok=True)
    destination.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    return report


if __name__ == "__main__":
    report = evaluate()
    print(json.dumps(report, indent=2))
    sys.exit(0 if report["passed"] == report["total"] else 1)
