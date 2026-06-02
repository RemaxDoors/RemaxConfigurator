from __future__ import annotations

from typing import Any

from services.data_mapping import get_value, is_true
from services.installation_config import installation_control_names as control


def validate_installation_config(selected_values: dict[str, Any]) -> dict[str, Any]:
    errors: list[dict[str, str]] = []

    if is_true(selected_values, control.CHKACCOM) and _to_float(get_value(selected_values, control.NUMACCOMNIGHT, 0)) < 1:
        errors.append({
            "field": control.NUMACCOMNIGHT,
            "message": "Must enter # of nights accommodation.",
        })

    if _to_float(get_value(selected_values, control.NUMESTPROJECTSONRUN, 0)) < 1:
        errors.append({
            "field": control.NUMESTPROJECTSONRUN,
            "message": "Estimated projects on install run must be at least 1.",
        })

    if _to_float(get_value(selected_values, control.NUMTOTALDOORSPROJ, 0)) < 1:
        errors.append({
            "field": control.NUMTOTALDOORSPROJ,
            "message": "Total doors in project must be at least 1.",
        })

    return {
        "is_valid": not errors,
        "errors": errors,
        "warnings": [],
    }


def _to_float(value: Any) -> float:
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0.0
