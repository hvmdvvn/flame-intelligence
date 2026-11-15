"""Deterministic comparability gate. A language model does not decide this."""

from __future__ import annotations
import math

from app.corpus import corpus_version, fingerprint, get_study

HARD_MESSAGES = {
    "measurement_mismatch": "The studies do not share one verified measurement definition.",
    "unit_mismatch": "Units differ and no documented conversion puts them on the same scale.",
    "gravity_mismatch": "Gravity regimes differ, or one regime was not reported.",
    "fuel_mismatch": "Fuel families differ, or one fuel was not classified from the paper.",
    "unverified_value": "A value selected for the chart is not marked verified.",
    "missing_value": "A required measurement was not reported. It is left empty.",
    "definition_unclassified": "The measurement family is still unclassified.",
    "ambiguous_values": "More than one verified value exists for this measurement family.",
    "evidence_class_mismatch": "A computational result and an experimental observation cannot be treated as directly comparable measurements.",
}


class CompareError(Exception):
    def __init__(self, code: str, message: str, status: int, **extra):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status = status
        self.extra = extra


def _verified(study: dict, family: str) -> list[dict]:
    found = []
    for measurement in study.get("measurements") or []:
        if measurement.get("measurement_family") != family:
            continue
        if measurement.get("verification_status") != "verified":
            continue
        if measurement.get("value") is None or measurement.get("synthetic"):
            continue
        found.append(measurement)
    return found


def _unit_key(measurement: dict) -> tuple[str, float] | None:
    if measurement.get("normalized_value") is not None and measurement.get("normalized_unit") and measurement.get("conversion_note"):
        value = float(measurement["normalized_value"])
        return (str(measurement["normalized_unit"]), value) if math.isfinite(value) else None
    if measurement.get("unit") and measurement.get("value") is not None:
        value = float(measurement["value"])
        return (str(measurement["unit"]), value) if math.isfinite(value) else None
    return None


def _missing(study: dict) -> list[str]:
    fields = []
    for name in ("fuel_family", "gravity_regime", "platform", "oxygen_mole_fraction", "pressure_kpa", "method"):
        value = study.get(name)
        if value is None or value == "not_reported" or value == "":
            fields.append(name)
    return fields


def compare(left_id: str, right_id: str, measurement_family: str | None = None) -> dict:
    if left_id == right_id:
        raise CompareError("invalid_request", "Choose two different studies.", 400)
    left = get_study(left_id)
    right = get_study(right_id)
    if left is None:
        raise CompareError("study_not_found", "No study uses this id.", 404, study_id=left_id)
    if right is None:
        raise CompareError("study_not_found", "No study uses this id.", 404, study_id=right_id)

    reasons = []
    caveats = []
    missing = sorted(set(_missing(left) + _missing(right)))
    def is_model(study):
        method = (study.get("method") or "").lower()
        return "computational" in method or "model" in method
    if is_model(left) != is_model(right):
        reasons.append("evidence_class_mismatch")
    if is_model(left) or is_model(right):
        caveats.append({"code": "reported_model", "message": "These are published computational results, not validated platform predictions or raw experimental observations."})
    if missing:
        caveats.append({"code": "incomplete_conditions", "message": "Missing conditions prevent establishing direct experimental equivalence: " + ", ".join(missing)})

    def families(study: dict) -> set[str]:
        return {
            m.get("measurement_family")
            for m in study.get("measurements") or []
            if m.get("verification_status") == "verified" and m.get("value") is not None and not m.get("synthetic")
        }

    shared = families(left) & families(right)
    shared.discard("not_reported")
    shared.discard(None)
    matched = measurement_family
    if matched:
        if matched not in shared:
            reasons.append("measurement_mismatch")
            matched = None
    elif len(shared) == 1:
        matched = next(iter(shared))
    elif len(shared) == 0:
        reasons.append("measurement_mismatch")
        matched = None
    else:
        reasons.append("measurement_mismatch")
        matched = None

    points = []
    if matched:
        left_values = _verified(left, matched)
        right_values = _verified(right, matched)
        if len(left_values) != 1 or len(right_values) != 1:
            reasons.append("ambiguous_values" if (left_values or right_values) else "missing_value")
        else:
            left_key = _unit_key(left_values[0])
            right_key = _unit_key(right_values[0])
            if left_key is None or right_key is None:
                reasons.append("missing_value")
            elif left_key[0] != right_key[0]:
                reasons.append("unit_mismatch")
            else:
                for study, measurement, key in (
                    (left, left_values[0], left_key),
                    (right, right_values[0], right_key),
                ):
                    provenance = measurement.get("provenance") or {}
                    points.append(
                        {
                            "study_id": study["study_id"],
                            "label": study.get("label") or study["study_id"],
                            "value": key[1],
                            "unit": key[0],
                            "uncertainty": measurement.get("uncertainty"),
                            "page_number": provenance.get("page_number"),
                            "provenance": provenance.get("location") or "",
                        }
                    )

    for study in (left, right):
        regime = study.get("gravity_regime") or "not_reported"
        fuel = study.get("fuel_family") or "not_reported"
        if regime == "not_reported" or fuel == "not_reported":
            pass
    if (left.get("gravity_regime") or "not_reported") != (right.get("gravity_regime") or "not_reported") or (
        left.get("gravity_regime") in (None, "not_reported") or right.get("gravity_regime") in (None, "not_reported")
    ):
        reasons.append("gravity_mismatch")
    if (left.get("fuel_family") or "not_reported") != (right.get("fuel_family") or "not_reported") or (
        left.get("fuel_family") in (None, "not_reported") or right.get("fuel_family") in (None, "not_reported")
    ):
        reasons.append("fuel_mismatch")

    if "gravity_mismatch" not in reasons and "fuel_mismatch" not in reasons and matched and not any(
        code in reasons for code in ("unit_mismatch", "missing_value", "ambiguous_values", "measurement_mismatch")
    ):
        lo = left.get("oxygen_mole_fraction")
        ro = right.get("oxygen_mole_fraction")
        if lo is not None and ro is not None and abs(float(lo) - float(ro)) > 0.005:
            caveats.append(
                {
                    "code": "oxygen_differs",
                    "message": "Oxygen concentration differs. The chart is allowed only with that caveat visible.",
                }
            )
        lp = left.get("pressure_kpa")
        rp = right.get("pressure_kpa")
        if lp is not None and rp is not None and abs(float(lp) - float(rp)) / max(abs(float(lp)), abs(float(rp)), 1) > 0.01:
            caveats.append(
                {
                    "code": "pressure_differs",
                    "message": "Pressure differs. The chart is allowed only with that caveat visible.",
                }
            )

    # Deduplicate while preserving order.
    deduped = []
    for code in reasons:
        if code not in deduped:
            deduped.append(code)
    reason_rows = [{"code": code, "message": HARD_MESSAGES.get(code, code)} for code in deduped]
    if reason_rows:
        comparability = "not_comparable"
        chart_allowed = False
        points = []
        matched_out = matched if "measurement_mismatch" not in deduped else None
    elif caveats:
        comparability = "comparable_with_caveat"
        chart_allowed = True
        matched_out = matched
    else:
        comparability = "comparable"
        chart_allowed = bool(points)
        matched_out = matched
        if not points:
            comparability = "not_comparable"
            chart_allowed = False
            reason_rows = [{"code": "missing_value", "message": HARD_MESSAGES["missing_value"]}]

    return {
        "corpus_version": corpus_version(),
        "comparability": comparability,
        "chart_allowed": chart_allowed,
        "matched_measurement_family": matched_out,
        "reasons": reason_rows,
        "caveats": caveats,
        "missing_fields": missing,
        "left": left,
        "right": right,
        "left_fingerprint": fingerprint(left),
        "right_fingerprint": fingerprint(right),
        "points": points if chart_allowed else [],
    }
