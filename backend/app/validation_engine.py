"""Data-driven validation engine.

Evaluates uCfgValidationRules (conditions + calculators) against a set of
selected values and returns {errors, warnings, is_valid} — the same shape the
old validate_movidor_config() returned.

`evaluate_rules(rules, values)` is pure (no DB) so it can be unit-tested.
`evaluate(configurator_id, values)` loads the rules from the config DB first.
"""
from __future__ import annotations

from collections import defaultdict

from . import formula


# ── value helpers (case-insensitive, mirroring services/data_mapping.py) ──────
def _get(values: dict, control: str):
    if control in values:
        return values[control]
    low = control.lower()
    for key, val in values.items():
        if str(key).lower() == low:
            return val
    return None


def _is_true(value) -> bool:
    return value is True or str(value).strip().lower() in {"1", "true", "yes"}


def _to_float(value) -> float:
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0.0


# ── condition evaluation ──────────────────────────────────────────────────────
def eval_condition(cond: dict, values: dict) -> bool:
    val = _get(values, cond["controlName"])
    op = cond["operator"]
    # Validation rules carry "compareValue"; pricing rules loaded by
    # config_repo.load_rules() carry "value". Accept either.
    cmp = cond.get("compareValue")
    if cmp is None:
        cmp = cond.get("value")
    sval = "" if val is None else str(val)
    scmp = "" if cmp is None else str(cmp)

    if op == "is_checked":
        return _is_true(val)
    if op == "not_checked":
        return not _is_true(val)
    if op == "equals":
        return sval.strip().lower() == scmp.strip().lower()
    if op == "not_equals":
        return sval.strip().lower() != scmp.strip().lower()
    if op == "contains":
        return scmp.lower() in sval.lower()
    if op == "not_contains":
        return scmp.lower() not in sval.lower()
    if op == "starts_with":
        return sval.lower().startswith(scmp.lower())
    if op == "greater_than":
        return _to_float(val) > _to_float(cmp)
    if op == "less_than":
        return _to_float(val) < _to_float(cmp)
    if op in ("in", "not_in"):
        items = [x.strip().lower() for x in scmp.split(",")]
        present = sval.strip().lower() in items
        return present if op == "in" else not present
    return False


def _conditions_match(conditions: list[dict], values: dict) -> bool:
    """Same GroupNo = AND; different GroupNo = OR."""
    groups: dict = defaultdict(list)
    for cond in conditions:
        groups[cond.get("groupNo", 1)].append(cond)
    return any(
        all(eval_condition(cond, values) for cond in group)
        for group in groups.values()
    )


def rule_matches(rule: dict, values: dict) -> bool:
    """Does this rule fire for the current configuration?

    Two tests, both of which must pass:
      * the condition groups (AND inside a group, OR across groups), and
      * the optional ConditionFormula, for tests the groups can't express —
        typically counting across a numbered set of controls, e.g.
            countStartsWith(group("CMBACT"), "Induction Loop - ") > 0

    No conditions and no formula means the rule always fires.
    """
    conditions = rule.get("conditions") or []
    if conditions and not _conditions_match(conditions, values):
        return False

    expr = (rule.get("conditionFormula") or "").strip()
    if not expr:
        return True
    try:
        return formula.evaluate(expr, values) != 0
    except formula.FormulaError:
        # A broken formula must not silently add parts to a quote.
        return False


# ── calculators (the computed rules that can't be pure data) ──────────────────
def _area_m2(v: dict) -> float:
    return (_to_float(_get(v, "NUMDOORHEIGHT")) / 1000.0) * (
        _to_float(_get(v, "NUMDOORWIDTH")) / 1000.0
    )


def floor_slope_check(v: dict) -> bool:
    amount = _get(v, "NUMFLOORSLOPE")
    direction = _get(v, "CMBFLOORSLOPE")
    amount_set = amount not in (None, 0, "0", "", "0.0")
    direction_missing = str(direction or "").strip() in ("", "No Slope")
    return amount_set and direction_missing


def ex_ramset_fixing_check(v: dict) -> bool:
    model = str(_get(v, "CMBDOORMODEL") or "").upper()
    return (
        model in ("EX35", "EX45")
        and str(_get(v, "CMBWALLCONST") or "") == "Insulated Panel"
        and str(_get(v, "CMBLEGFIXING") or "")
        not in ("", "M10 SS Allthread & Sleeve & Ramset Wall Anchor")
        and str(_get(v, "CMBJOBTYPE") or "")
        in ("Install", "Supply Only - With Fixings")
    )


def ups_single_phase_check(v: dict) -> bool:
    ups = str(_get(v, "CMBUPS") or "")
    power = str(_get(v, "CMBPOWERSUPPLY") or "")
    return ups not in ("", "No UPS") and not power.startswith("1P")


def induction_loop_check(v: dict) -> bool:
    induction = any(
        "induction" in str(_get(v, f"CMBACT{i}") or "").lower() for i in range(1, 5)
    )
    return induction and "ip54" in str(_get(v, "CMBCONTROLLERENCLOSURE") or "").lower()


def concertina_area80_check(v: dict) -> bool:
    return str(_get(v, "CMBDOORMODEL") or "").upper() == "CONCERTINA" and _area_m2(v) > 80


def concertina_area60_check(v: dict) -> bool:
    return str(_get(v, "CMBDOORMODEL") or "").upper() == "CONCERTINA" and _area_m2(v) > 60


CALCULATORS = {
    "floor_slope_check": floor_slope_check,
    "ex_ramset_fixing_check": ex_ramset_fixing_check,
    "ups_single_phase_check": ups_single_phase_check,
    "induction_loop_check": induction_loop_check,
    "concertina_area80_check": concertina_area80_check,
    "concertina_area60_check": concertina_area60_check,
}


# ── rule evaluation ───────────────────────────────────────────────────────────
def _rule_triggers(rule: dict, values: dict) -> bool:
    conditions = rule.get("conditions") or []
    calc_ref = rule.get("calculatorRef")

    if not conditions and not calc_ref:
        return False
    if conditions and not _conditions_match(conditions, values):
        return False
    if calc_ref:
        fn = CALCULATORS.get(calc_ref)
        if fn is None or not fn(values):
            return False
    return True


def evaluate_rules(rules: list[dict], values: dict) -> dict:
    errors, warnings = [], []
    for rule in rules:
        if _rule_triggers(rule, values):
            item = {"field": rule.get("targetField"), "message": rule["message"], "rule": rule.get("ruleCode")}
            (errors if rule.get("severity") == "error" else warnings).append(item)
    return {"errors": errors, "warnings": warnings, "is_valid": len(errors) == 0}


def evaluate(configurator_id: str, values: dict) -> dict:
    from . import config_repo  # lazy import so the pure logic has no DB deps

    rules = config_repo.load_validation_rules(configurator_id)
    return evaluate_rules(rules, values)


# ── self-test (no DB) ─────────────────────────────────────────────────────────
if __name__ == "__main__":
    sample_rules = [
        {
            "ruleCode": "HYPERLIFT_CARWASH", "severity": "error", "targetField": "CMBELECSPEC",
            "message": "Hyperlift doors must use 'Carwash' electrical spec.",
            "conditions": [
                {"groupNo": 1, "controlName": "CHKHYPERLIFT", "operator": "is_checked", "compareValue": None},
                {"groupNo": 1, "controlName": "CMBELECSPEC", "operator": "not_equals", "compareValue": "Carwash"},
            ],
        },
        {
            "ruleCode": "PED_COLUMN", "severity": "error", "targetField": "CMBPED1",
            "message": "Unable to put Push Button in Door Column. Change to J-Box.",
            "conditions": [
                {"groupNo": 1, "controlName": "CMBDOORMODEL", "operator": "in", "compareValue": "EX35,EX45,MOVIFOLD,CONCERTINA"},
                {"groupNo": 1, "controlName": "CMBPED1", "operator": "contains", "compareValue": "Column"},
            ],
        },
        {
            "ruleCode": "CONCERTINA_AREA80", "severity": "warning", "targetField": "NUMDOORHEIGHT",
            "message": "Max size for Concertina is 80m2.",
            "calculatorRef": "concertina_area80_check", "conditions": [],
        },
        {
            "ruleCode": "CONCERTINA_AREA60", "severity": "warning", "targetField": "NUMDOORHEIGHT",
            "message": "Concertina restricted over 60m2.",
            "calculatorRef": "concertina_area60_check", "conditions": [],
        },
    ]

    def check(label, values, exp_errors, exp_warnings):
        r = evaluate_rules(sample_rules, values)
        ok = len(r["errors"]) == exp_errors and len(r["warnings"]) == exp_warnings
        print(f"[{'PASS' if ok else 'FAIL'}] {label}: errors={len(r['errors'])} warnings={len(r['warnings'])} valid={r['is_valid']}")

    check("hyperlift ON, spec Standard -> 1 error", {"CHKHYPERLIFT": 1, "CMBELECSPEC": "Standard"}, 1, 0)
    check("hyperlift ON, spec Carwash -> 0", {"CHKHYPERLIFT": 1, "CMBELECSPEC": "Carwash"}, 0, 0)
    check("EX35 + PED1 Column -> 1 error", {"CMBDOORMODEL": "EX35", "CMBPED1": "Push Button in Column"}, 1, 0)
    check("HS50 + PED1 Column -> 0", {"CMBDOORMODEL": "HS50", "CMBPED1": "Push Button in Column"}, 0, 0)
    check("Concertina 9x9=81m2 -> 2 warnings", {"CMBDOORMODEL": "CONCERTINA", "NUMDOORHEIGHT": 9000, "NUMDOORWIDTH": 9000}, 0, 2)
    check("Concertina 7x9=63m2 -> 1 warning", {"CMBDOORMODEL": "CONCERTINA", "NUMDOORHEIGHT": 7000, "NUMDOORWIDTH": 9000}, 0, 1)
