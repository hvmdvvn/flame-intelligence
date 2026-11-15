from app.compare import compare


def study(study_id, fuel, gravity, oxygen, value, unit="mm/s", family="flame_spread_rate"):
    return {
        "study_id": study_id,
        "paper_id": "ntrs:fixture",
        "label": study_id,
        "fuel_family": fuel,
        "gravity_regime": gravity,
        "platform": "iss",
        "oxygen_mole_fraction": oxygen,
        "pressure_kpa": None,
        "method": "fixture method",
        "measurements": [
            {
                "measurement_id": study_id + "#m1",
                "measurement_family": family,
                "value": value,
                "unit": unit,
                "uncertainty": None,
                "normalized_value": None,
                "normalized_unit": None,
                "conversion_note": None,
                "verification_status": "verified" if value is not None else "not_reported",
                "synthetic": False,
                "provenance": {"page_number": 1, "location": "page"},
            }
        ]
        if family
        else [],
    }


def test_null_measurement_is_not_plotted_as_zero(monkeypatch):
    left = study("ntrs:fixture#s1", "fabric", "microgravity", 0.21, None)
    right = study("ntrs:fixture#s2", "fabric", "microgravity", 0.21, 2.0)
    monkeypatch.setattr("app.compare.get_study", lambda sid: left if sid.endswith("s1") else right)
    monkeypatch.setattr("app.compare.corpus_version", lambda: "test")
    monkeypatch.setattr("app.compare.fingerprint", lambda item: {"study_id": item["study_id"]})
    result = compare(left["study_id"], right["study_id"])
    assert result["chart_allowed"] is False
    assert result["points"] == []
    assert all(point.get("value") != 0 for point in result["points"])


def test_fuel_or_gravity_mismatch_locks_the_chart(monkeypatch):
    left = study("ntrs:fixture#s1", "fabric", "microgravity", 0.21, 2.5)
    right = study("ntrs:fixture#s2", "pmma", "normal_gravity", 0.21, 1.2)
    monkeypatch.setattr("app.compare.get_study", lambda sid: left if sid.endswith("s1") else right)
    monkeypatch.setattr("app.compare.corpus_version", lambda: "test")
    monkeypatch.setattr("app.compare.fingerprint", lambda item: {"study_id": item["study_id"]})
    result = compare(left["study_id"], right["study_id"])
    assert result["comparability"] == "not_comparable"
    assert result["chart_allowed"] is False
    assert result["points"] == []


def test_oxygen_difference_is_a_caveat_not_a_merge(monkeypatch):
    left = study("ntrs:fixture#s1", "fabric", "microgravity", 0.21, 2.5)
    right = study("ntrs:fixture#s2", "fabric", "microgravity", 0.34, 3.1)
    monkeypatch.setattr("app.compare.get_study", lambda sid: left if sid.endswith("s1") else right)
    monkeypatch.setattr("app.compare.corpus_version", lambda: "test")
    monkeypatch.setattr("app.compare.fingerprint", lambda item: {"study_id": item["study_id"]})
    result = compare(left["study_id"], right["study_id"])
    assert result["comparability"] == "comparable_with_caveat"
    assert result["chart_allowed"] is True
    assert {point["value"] for point in result["points"]} == {2.5, 3.1}
    assert any(item["code"] == "oxygen_differs" for item in result["caveats"])


def test_same_study_is_rejected(monkeypatch):
    import pytest

    from app.compare import CompareError

    monkeypatch.setattr("app.compare.get_study", lambda sid: None)
    with pytest.raises(CompareError) as caught:
        compare("ntrs:fixture#s1", "ntrs:fixture#s1")
    assert caught.value.status == 400
