"""Versioned deterministic research analysis; scores measure suitability, never safety."""
from __future__ import annotations

import hashlib
import json
import math
import re
import statistics
from collections import defaultdict
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator, field_validator

from app import research_store as store
from app.corpus import corpus_version, load_studies_file, studies_with_measurements

METHOD_VERSION = "relevance-1.0.0"
DISCLAIMER = "Independent research tool; not NASA-endorsed and not a certified fire-safety system."


class Weights(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)
    topic: float = Field(default=4, ge=0, le=100)
    gravity: float = Field(default=2, ge=0, le=100)
    conditions: float = Field(default=2, ge=0, le=100)
    quantitative: float = Field(default=1, ge=0, le=100)
    provenance: float = Field(default=1, ge=0, le=100)

    @model_validator(mode="after")
    def nonzero(self):
        if not sum(self.model_dump().values()):
            raise ValueError("At least one weight must be positive")
        return self


class RankingIn(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)
    question: str = Field(min_length=3, max_length=2000)
    mission: Literal["lunar_habitat", "iss", "mars_habitat", "rover", "spacecraft"] = "lunar_habitat"
    weights: Weights = Field(default_factory=Weights)
    oxygen_fraction: float | None = Field(default=None, ge=0, le=1)
    pressure_kpa: float | None = Field(default=None, gt=0, le=10000)
    gravity: Literal["microgravity", "partial_gravity", "normal_gravity"] | None = None

    @field_validator("question")
    @classmethod
    def meaningful_question(cls, value):
        if len(value.strip()) < 3:
            raise ValueError("A research question must contain at least three nonblank characters")
        return value.strip()


STOP = set("which what how does the and for are with from strongest available evidence relevant proposed environment nasa investigations research provide material materials habitat lunar martian mars iss spacecraft rover".split())
ALIASES = {"flammability": {"flammability", "solid", "burning", "spread"}, "detection": {"smoke", "aerosol", "detection"}, "suppression": {"suppression", "extinction", "extinguishment"}, "oxygen": {"oxygen", "atmosphere", "enriched"}}


def terms(text: str) -> set[str]:
    return {t for t in re.findall(r"[a-z0-9]+", text.lower()) if len(t) > 2 and t not in STOP}


def rank_investigations(body: RankingIn) -> dict:
    records = store.list_investigations(limit=200, offset=0)["investigations"]
    source_ids = {s["source_id"] for s in store.list_sources()}
    query = terms(body.question)
    desired_gravity = body.gravity or ("partial_gravity" if body.mission in {"lunar_habitat", "mars_habitat"} else "microgravity" if body.mission in {"iss", "spacecraft"} else None)
    weights = body.weights.model_dump()
    total_weight = sum(weights.values())
    rows = []
    for inv in records:
        text = " ".join(str(inv.get(k) or "") for k in ("name", "full_name", "objective", "summary", "category"))
        words = terms(text)
        matches = {t for t in query if t in words or (t in ALIASES and ALIASES[t] & words)}
        topic = len(matches) / max(1, len(query))
        # Unknown or different gravity contributes no supported similarity; it is not a risk estimate.
        gravity = float(bool(desired_gravity and inv.get("gravity_regime") == desired_gravity))
        conditions = inv.get("conditions") or {}
        similarities = []
        for key, target, scale in (("oxygen_fraction", body.oxygen_fraction, 0.1), ("pressure_kpa", body.pressure_kpa, 50)):
            actual = conditions.get(key)
            if target is not None:
                similarities.append(max(0, 1 - abs(actual - target) / scale) if isinstance(actual, (int, float)) else 0)
        atmosphere = statistics.mean(similarities) if similarities else 0
        count = inv.get("measurement_count", 0)
        valid_sources = [s for s in inv.get("source_ids", []) if s in source_ids]
        values = {"topic": topic, "gravity": gravity, "conditions": atmosphere, "quantitative": float(count > 0), "provenance": float(bool(valid_sources))}
        reasons = {
            "topic": f"Matched question terms: {', '.join(sorted(matches)) or 'none'}. Lexical metadata relevance only.",
            "gravity": f"Requested {desired_gravity or 'unspecified'}; documented {inv.get('gravity_regime') or 'unavailable'}. No extrapolation credit.",
            "conditions": "Similarity uses only documented oxygen fraction and total pressure; missing or unspecified inputs receive no credit.",
            "quantitative": f"{count} validated imported measurements; publications and reported model values do not substitute for raw runs.",
            "provenance": f"{len(valid_sources)} resolvable registered sources; source presence does not validate a scientific inference.",
        }
        missing = [k for k in ("oxygen_fraction", "pressure_kpa", "airflow_m_s") if conditions.get(k) is None]
        limitations = list(inv.get("limitations") or [])
        if desired_gravity and not gravity:
            limitations.append("The documented gravity regime does not match this mission scenario; applicability requires validation.")
        if missing:
            limitations.append("Missing conditions prevent establishing quantitative atmospheric comparability.")
        rows.append({"investigation_id": inv["investigation_id"], "name": inv.get("name"), "score": round(100 * sum(weights[k] * values[k] for k in weights) / total_weight, 4), "components": [{"dimension": k, "weight": weights[k], "value": round(values[k], 6), "reason": reasons[k]} for k in weights], "missing_fields": missing, "limitations": limitations, "source_ids": valid_sources})
    rows.sort(key=lambda x: (-x["score"], x["investigation_id"]))
    gaps = []
    if desired_gravity and not any(r.get("gravity_regime") == desired_gravity for r in records):
        gaps.append(f"No catalog investigation establishes {desired_gravity} evidence. Microgravity is not partial gravity.")
    if not any(r.get("measurement_count", 0) for r in records):
        gaps.append("No validated raw experimental runs have been imported. Quantitative condition matching and model training remain unavailable.")
    return {"method_version": METHOD_VERSION, "configuration": body.model_dump(), "rankings": rows, "gaps": gaps, "assumptions": ["Score is weighted evidence suitability (0–100), not probability of fire or a safety assessment.", "Mission selects only a default gravity target; it does not assert validated mission applicability.", "Missing values receive zero supported-similarity credit; no condition is imputed.", "Condition similarity uses linear tolerances 0.1 oxygen fraction and 50 kPa, chosen for exploration and not physical equivalence.", DISCLAIMER]}


def quantitative_analytics() -> dict:
    grouped = defaultdict(list)
    exclusions = []
    for row in store.list_measurements():
        value = row.get("normalized_value", row.get("value"))
        if value is None:
            value = row.get("value")
        if not isinstance(value, (float, int)) or not math.isfinite(value) or row.get("synthetic"):
            exclusions.append({"id": row.get("measurement_id"), "reason": "Invalid or synthetic measurement"})
            continue
        unit = row.get("normalized_unit") or row.get("unit")
        family = row.get("measurement_family") or row.get("quantity")
        # Dataset/run separation prevents conflating measurements collected under different conditions.
        family = family or row.get("measurement_name")
        kind = row.get("measurement_kind", "direct_observation")
        key = (family, unit, row.get("dataset_id"), row.get("run_id"), kind)
        grouped[key].append({**row, "value": value})
    groups = []
    for (family, unit, dataset, run, kind), values in sorted(grouped.items(), key=lambda item: str(item[0])):
        numbers = [r["value"] for r in values]
        groups.append({"measurement_family": family, "unit": unit, "dataset_id": dataset, "run_id": run, "evidence_class": "model_prediction" if kind == "reported_model" else "directly_observed_result", "count": len(numbers), "min": min(numbers), "max": max(numbers), "mean": statistics.mean(numbers), "values": values})
    published = []
    for study in studies_with_measurements():
        model = "model" in (study.get("method") or "").lower() or "computational" in (study.get("method") or "").lower()
        for value in study.get("measurements", []):
            if value.get("verification_status") != "verified" or value.get("synthetic"):
                continue
            published.append({**value, "label": study.get("label"), "method": study.get("method"), "evidence_class": "model_prediction" if model else "directly_observed_result", "training_eligible": False, "limitation": "Manually transcribed publication value; not an imported raw experimental run."})
    return {"method_version": "descriptive-1.0.0", "groups": groups, "published_values": published, "exclusions": exclusions, "limitations": ["Groups are separated by dataset and run; no cross-condition inference or significance test is performed.", "Means are descriptive arithmetic summaries, not independent replicate estimates.", "Uncertainty and calibration must be established from original experiment documentation."]}


def model_feasibility() -> dict:
    rows = store.list_measurements()
    runs = {r.get("run_id") for r in rows if r.get("run_id")}
    return {"status": "unavailable", "reason": "No trained, independently evaluated model artifact exists. Imported measurements alone do not validate a predictor.", "validated_measurements": len(rows), "experimental_runs": len(runs), "evaluation": None, "required": ["Define target, units, inputs and calibrated uncertainty.", "Review comparable authentic runs and condition coverage.", "Split by run/investigation before feature processing to prevent leakage.", "Evaluate baseline against held-out investigations; document errors and applicability boundaries."], "disclaimer": DISCLAIMER}


def research_report(body: RankingIn) -> dict:
    ranking = rank_investigations(body)
    scientific = {"ranking": ranking, "analytics": quantitative_analytics(), "model_feasibility": model_feasibility(), "sources": store.list_sources(), "datasets": store.list_datasets(), "corpus_version": corpus_version()}
    fingerprint = hashlib.sha256(json.dumps(scientific, sort_keys=True, ensure_ascii=False).encode()).hexdigest()
    return {"format_version": "1", "reproducibility_sha256": fingerprint, **scientific, "disclaimer": DISCLAIMER}
