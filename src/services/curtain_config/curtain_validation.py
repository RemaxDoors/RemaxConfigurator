from __future__ import annotations

from services.movidor_door_config import movidor_control_names as door_control
from services.curtain_config import curtain_control_names as control
from services.data_mapping import contains, get_value, is_true


def validate_curtain_config(selected_values: dict) -> dict[str, object]:
    errors: list[dict[str, str]] = []
    warnings: list[dict[str, str]] = []

    _validate_window_rows(selected_values, errors)

    door_model = str(get_value(selected_values, door_control.CMBDOORMODEL, "") or "").upper()
    if "MOVICHILL" in door_model and str(get_value(selected_values, door_control.CMBWINDTRACK, "")).upper() == "YES":
        warnings.append({
            "field": door_control.CMBWINDTRACK,
            "message": "Movichill with high wind track may require a custom curtain.",
        })

    if door_model == "CONCERTINA" and is_true(selected_values, control.CHKSLOPEREQUIRED):
        floor_slope = str(get_value(selected_values, control.CMBFLOORSLOPE, ""))
        if "Add to" not in floor_slope:
            errors.append({
                "field": control.CMBFLOORSLOPE,
                "message": "Concertina slope must use an 'Add to' floor slope option.",
            })

    if contains(selected_values, control.CMBCURTAINCOLOUR, "***Custom***"):
        warnings.append({
            "field": control.CMBCURTAINCOLOUR,
            "message": "Custom curtain colour must be confirmed before order.",
        })

    return {
        "is_valid": len(errors) == 0,
        "errors": errors,
        "warnings": warnings,
    }


def _validate_window_rows(selected_values: dict, errors: list[dict[str, str]]) -> None:
    row_count_value = str(get_value(selected_values, control.CMBNUMWINDROWS, "") or "").strip()
    if row_count_value in {"", "No Window", "CUSTOM"}:
        return

    try:
        row_count = int(row_count_value)
    except ValueError:
        return

    for index in range(row_count):
        location_name = control.WINDOW_ROW_LOCATION_NAMES[index]
        type_name = control.WINDOW_ROW_TYPE_NAMES[index]
        location = str(get_value(selected_values, location_name, "") or "").strip()
        window_type = str(get_value(selected_values, type_name, "") or "").strip()

        if location == "" or location == "NewConfiguration":
            errors.append({
                "field": location_name,
                "message": f"Window row {index + 1} location is required.",
            })

        if window_type == "" or window_type == "NewConfiguration":
            errors.append({
                "field": type_name,
                "message": f"Window row {index + 1} type is required.",
            })
