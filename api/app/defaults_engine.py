"""Resolve a configurator's defaults for a given selection.

A default may be:
  - static      DefaultValue, optionally scoped to a DoorModel
  - conditional gated by uCfgDefaultConditions (AND in a group, OR across groups)
  - computed    ValueFormula, e.g. (NUMDOORWIDTH / 1000) * (NUMDOORHEIGHT / 1000)

Highest Priority wins when several defaults target the same control; ties go to
the more specific (model-scoped) one.
"""
from __future__ import annotations

import ast
import math
import operator as op

from sqlalchemy import text

from . import config_repo
from .formula import evaluate as _evaluate_formula
from .validation_engine import _conditions_match

# --- safe formula evaluation ------------------------------------------------
_BIN = {
    ast.Add: op.add, ast.Sub: op.sub, ast.Mult: op.mul,
    ast.Div: op.truediv, ast.Mod: op.mod, ast.Pow: op.pow,
}
_FUNCS = {
    "ceil": math.ceil, "floor": math.floor, "round": round,
    "min": min, "max": max, "abs": abs,
}


def _to_float(v) -> float:
    try:
        return float(v or 0)
    except (TypeError, ValueError):
        return 0.0


def eval_formula(formula: str, values: dict) -> float:
    """Delegates to app.formula so defaults and rule quantities share one
    evaluator (arithmetic, comparisons, IF(), ceil/floor/round/min/max)."""
    return _evaluate_formula(formula, values)


# --- loading ----------------------------------------------------------------
def load_defaults(configurator_id: str) -> list[dict]:
    """Defaults for a configurator, with their conditions."""
    engine = config_repo.get_config_engine()
    with engine.connect() as conn:
        has_cond = config_repo.column_exists(conn, "uCfgDefaultConditions", "ConditionID")
        has_extra = config_repo.column_exists(conn, "uCfgDefaults", "Priority")
        has_manual = config_repo.column_exists(conn, "uCfgDefaults", "IsManual")
        extra = (", d.Priority, d.ValueFormula, d.ParentPartID"
                 if has_extra else ", NULL, NULL, NULL")
        extra += ", d.IsManual" if has_manual else ", CAST(0 AS BIT)"
        rows = conn.execute(text(
            "SELECT d.DefaultID, d.DoorModel, d.ControlName, d.DefaultValue" + extra + " "
            "FROM dbo.uCfgDefaults d JOIN dbo.uCfgConfigurators c ON d.CfgID = c.CfgID "
            "WHERE c.PartID = :pid ORDER BY d.DefaultID"
        ), {"pid": configurator_id}).fetchall()
        conds = []
        if has_cond:
            conds = conn.execute(text(
                "SELECT dc.DefaultID, dc.GroupNo, dc.ControlName, dc.Operator, dc.CompareValue "
                "FROM dbo.uCfgDefaultConditions dc JOIN dbo.uCfgDefaults d ON dc.DefaultID = d.DefaultID "
                "JOIN dbo.uCfgConfigurators c ON d.CfgID = c.CfgID WHERE c.PartID = :pid"
            ), {"pid": configurator_id}).fetchall()

    by_default: dict = {}
    for did, group_no, control, operator_, compare in conds:
        by_default.setdefault(did, []).append({
            "groupNo": group_no or 1, "controlName": control,
            "operator": operator_, "compareValue": compare,
        })

    return [
        {
            "id": did,
            "doorModel": model,
            "controlName": control,
            "value": value,
            "priority": priority or 0,
            "formula": formula,
            "parentPartId": parent,
            "isManual": bool(manual),
            "conditions": by_default.get(did, []),
        }
        for did, model, control, value, priority, formula, parent, manual in rows
    ]


# --- resolution -------------------------------------------------------------
def resolve_defaults(
    configurator_id: str,
    values: dict,
    parent_part_id: str | None = None,
) -> dict:
    """Return {controlName: value} for the current selection."""
    door_model = str(values.get("CMBDOORMODEL", "") or "").strip().upper()
    resolved: dict[str, dict] = {}
    errors: list[dict] = []
    manual: list[dict] = []

    for d in load_defaults(configurator_id):
        # scope: parent configurator (installation runs under a door configurator)
        if parent_part_id and d["parentPartId"] and d["parentPartId"] != parent_part_id:
            continue
        # scope: door model (NULL = applies to every model)
        model = (d["doorModel"] or "").strip().upper()
        if model and door_model and model != door_model:
            continue
        if model and not door_model:
            continue
        # gate: conditions
        if d["conditions"] and not _conditions_match(d["conditions"], values):
            continue

        if d.get("isManual"):
            # calculated on demand (e.g. the freight button) — never auto-applied
            manual.append({
                "controlName": d["controlName"],
                "formula": d["formula"],
            })
            continue

        value = d["value"]
        if d["formula"]:
            try:
                value = eval_formula(d["formula"], values)
            except Exception as exc:
                errors.append({"controlName": d["controlName"],
                               "formula": d["formula"], "error": str(exc)})
                continue

        # highest priority wins; a model-specific default beats a global one
        specificity = (d["priority"], 1 if model else 0)
        current = resolved.get(d["controlName"])
        if current is None or specificity >= current["specificity"]:
            resolved[d["controlName"]] = {"value": value, "specificity": specificity}

    return {
        "defaults": {k: v["value"] for k, v in resolved.items()},
        "manual": manual,
        "errors": errors,
    }
