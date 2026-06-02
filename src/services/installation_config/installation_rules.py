from __future__ import annotations

from typing import Any

from services.installation_config import installation_control_names as control


SWING_SELECTION_CONTROLS = (
    control.CHKINSSWIS,
    control.CHKINSSWIP,
    control.CHKINS50SWIS,
    control.CHKINS50SWIP,
    control.CHKINSSLD,
)


SWING_INSTALL_PARTS = (
    ("INS-45SLD-P", {"INS-45SLD-P"}),
    ("INS-50SWI-S", {"INS-50SWI-S"}),
    ("INS-45SLD-S", {"INS-45SLD-S"}),
    ("INS-45SWI-S", {"INS-45SWI-S"}),
    ("INS-45SWI-P", {"INS-45SWI-P"}),
    ("INS-50SWI-P", {"INS-50SWI-P"}),
    ("INS-30SWI-S", {"INS-30SWI-S", "INS-35SWI-S"}),
    ("INS-24SWI-P", {"INS-24SWI-P"}),
    ("INS-24SWI-S", {"INS-24SWI-S"}),
    ("INS-30SWI-P", {"INS-30SWI-P", "INS-35SWI-P"}),
)


# Quantity rules per part: (cUnit, nAHFactor, swi_pair_doubles)
#   cUnit options:
#     ""             -> Per Door default: qty = 1
#     "Per Door"     -> qty = 1; if swi_pair_doubles and SWI- pair: qty = 1 / numTotalDoorsProj * 2
#     "Per Project"  -> qty = 1 / numTotalDoorsProj
#     "Per Leaf"     -> qty = 2 if pair, else 1
#     "Per Hour"     -> qty = (numDrivingTime / numTotalDoorsProj) / numEstProjectsOnRun
#     "Per Night"    -> qty = (numAccomNight * numPersonInstall) / numTotalDoorsProj
#   nAHFactor: multiplier applied when CHKINSAH is checked
#   swi_pair_doubles: whether SWI- paired config triggers extra doubling logic within the unit formula
_PART_QTY_RULES: dict[str, tuple[str, int, bool]] = {
    "LAB-TRVL-2P":      ("Per Hour",  1, True),
    "INS-HSD-MECH4X4":  ("",          2, False),
    "LAB-SITEVIS":      ("Per Door",  1, True),
    "LAB-SITEASS":      ("Per Door",  1, True),
    "LAB-RRD-REMOVAL":  ("",          2, False),
}


def build_installation_lines(selected_values: dict[str, Any]) -> list[dict[str, Any]]:
    lines: list[dict[str, Any]] = []

    if str(get_value(selected_values, control.CMBJOBTYPE, "") or "").strip() == "Install":
        _add_part(lines, selected_values, "LAB-TRVL-2P")

    _add_if(lines, selected_values, "INS-STRIP", control.CHKINSSTRIPSM)
    _add_if(lines, selected_values, "INS-STRIPXT", control.CHKINSSTRIPSM, lambda values: _strip_area(values) > 6)
    _add_if(lines, selected_values, "INS-STRIP-REP", control.CHKINSSTRIPSM, lambda values: _strip_area(values) > 6)
    _add_if(lines, selected_values, "INS-HSD-FOLDING", control.CHKINSHSDFOLDING)
    _add_if(lines, selected_values, "INS-COM-MECH4X4", control.CHKINSENT4X4)
    _add_if(lines, selected_values, "INS-HSD-MECH4X4", control.CHKINSRRD4X4)
    _add_if(lines, selected_values, "INS-HSD-MECH6X6", control.CHKINSRRD6X6)
    _add_if(lines, selected_values, "INS-GANTRY", control.CHKINSGANTRY)
    _add_if(lines, selected_values, "INS-SHUTTER5X5", control.CHKINSSHUTTER5X5)
    _add_if(lines, selected_values, "INS-SDJC", control.CHKINSCAP)
    _add_if(lines, selected_values, "INS-REPPNLS", control.CHKINSREPPNLS)
    _add_if(lines, selected_values, "INS-REPPNLP", control.CHKINSREPPNLP)
    _add_if(lines, selected_values, "LAB-SITEVIS", control.CHKLABSITEATT)
    _add_if(lines, selected_values, "LAB-SITEASS", control.CHKLABSITEASS)
    _add_if(lines, selected_values, "INS-BOL", control.CHKINSBOL)
    _add_if(lines, selected_values, "LAB-SWING-REMOVAL", control.CHKLABSWIREMOVAL)
    _add_if(lines, selected_values, "LAB-STRIP-REMOVAL", control.CHKLABSLDREMOVAL)
    _add_if(lines, selected_values, "INS-SOD-MECH", control.CHKINSHSDSECTIONAL)
    _add_if(lines, selected_values, "DISPOSAL-RRD", control.CHKLABRRDDISPOSAL)
    _add_if(lines, selected_values, "INS-SHUTTER5X5PLUS", control.CHKINSSHUTTER5X5PLUS)
    _add_if(lines, selected_values, "LAB-SLD-REMOVAL", control.CHKLABSLDREMOVAL)
    _add_if(lines, selected_values, "INS-COM-MECH4X4PLUS", control.CHKINSENT6X6)
    _add_if(lines, selected_values, "LAB-RRD-REMOVAL", control.CHKLABRRDREMOVAL)
    _add_if(lines, selected_values, "DISPOSAL-SWI", control.CHKSWIDISPOSAL)
    _add_accom(lines, selected_values)

    _add_swing_install_parts(lines, selected_values)
    _add_manual_cost(lines, selected_values, control.NUMFREIGHTALLOWANCE, "Freight Allowance")
    _add_operation_cost(
        lines,
        selected_values,
        control.NUMLUMSUM,
        str(get_value(selected_values, control.TXTLUMPSUMDESC, "") or "").strip() or "Lump Sum Install Cost",
        apply_after_hours=False,
    )

    if is_true(selected_values, control.CHKRETURNTRIP):
        _add_operation_cost(
            lines,
            selected_values,
            control.NUMRETURN_COST,
            "Return Trip",
            apply_after_hours=True,
        )

    return lines


# ---------------------------------------------------------------------------
# Generic quantity rule engine
# ---------------------------------------------------------------------------

def calc_qty_per_assembly(
    selected_values: dict[str, Any],
    cUnit: str,
    nAHFactor: int = 1,
    swi_pair_doubles: bool = False,
) -> float:
    """
    Generic quantity-per-assembly formula matching the M1 configurator logic.

    cUnit controls which branch runs:
      ""             -> Per Door: qty = 1 (default)
      "Per Project"  -> qty = 1 / numTotalDoorsProj
      "Per Leaf"     -> qty = 2 if pair, else 1
      "Per Hour"     -> qty = (numDrivingTime / numTotalDoorsProj) / numEstProjectsOnRun
      "Per Night"    -> qty = (numAccomNight * numPersonInstall) / numTotalDoorsProj

    swi_pair_doubles: when True, SWI- paired configs double qty within the unit formula.
    nAHFactor: applied as a multiplier when CHKINSAH is checked.
    """
    qty = 1.0

    if cUnit == "Per Project":
        total_doors = max(1, int(_to_float(get_value(selected_values, control.NUMTOTALDOORSPROJ, 1))))
        qty = 1.0 / total_doors

    elif cUnit == "Per Door":
        # Default qty = 1; SWI pair variant: qty = (1 / numTotalDoorsProj) * 2
        if swi_pair_doubles and _is_swi_pair(selected_values):
            total_doors = max(1, int(_to_float(get_value(selected_values, control.NUMTOTALDOORSPROJ, 1))))
            qty = (1.0 / total_doors) * 2

    elif cUnit == "Per Leaf":
        if is_true(selected_values, control.CHKISPAIR):
            qty = 2.0

    elif cUnit == "Per Hour":
        driving_time = _to_float(get_value(selected_values, control.NUMDRIVINGTIME, 0))
        total_doors = max(1, int(_to_float(get_value(selected_values, control.NUMTOTALDOORSPROJ, 1))))
        projects_on_run = max(1, int(_to_float(get_value(selected_values, control.NUMESTPROJECTSONRUN, 1))))
        qty = (driving_time / total_doors) / projects_on_run
        if swi_pair_doubles and _is_swi_pair(selected_values):
            qty *= 2

    elif cUnit == "Per Night":
        accom_nights = max(1, int(_to_float(get_value(selected_values, control.NUMACCOMNIGHT, 0))))
        persons = max(1, int(_to_float(get_value(selected_values, control.NUMPERSONINSTALL, 1))))
        total_doors = max(1, int(_to_float(get_value(selected_values, control.NUMTOTALDOORSPROJ, 1))))
        qty = (accom_nights * persons) / total_doors
        if swi_pair_doubles and _is_swi_pair(selected_values):
            qty *= 2

    # else: "" or "Per Door" -> qty stays 1

    if nAHFactor != 1 and is_true(selected_values, control.CHKINSAH):
        qty *= nAHFactor

    return qty


def _part_quantity(part_id: str, selected_values: dict[str, Any]) -> float:
    rule = _PART_QTY_RULES.get(part_id)
    if rule is None:
        return 1.0
    cUnit, nAHFactor, swi_pair_doubles = rule
    return calc_qty_per_assembly(selected_values, cUnit, nAHFactor, swi_pair_doubles)


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _add_if(
    lines: list[dict[str, Any]],
    selected_values: dict[str, Any],
    part_id: str,
    control_name: str,
    extra_rule=None,
) -> None:
    if not is_true(selected_values, control_name):
        return

    if extra_rule is not None and not extra_rule(selected_values):
        return

    _add_part(lines, selected_values, part_id)


def _add_swing_install_parts(lines: list[dict[str, Any]], selected_values: dict[str, Any]) -> None:
    if not any(is_true(selected_values, control_name) for control_name in SWING_SELECTION_CONTROLS):
        return

    swing_install_part_id = str(get_value(selected_values, control.TXTSWINGINSTALLPARTID, "") or "").strip()
    if not swing_install_part_id:
        return

    for part_id, matching_ids in SWING_INSTALL_PARTS:
        if swing_install_part_id in matching_ids:
            _add_part(lines, selected_values, part_id)


def _add_part(lines: list[dict[str, Any]], selected_values: dict[str, Any], part_id: str) -> None:
    lines.append({
        "label": part_id,
        "part_id": part_id,
        "revision": "",
        "quantity": _part_quantity(part_id, selected_values),
        "manual_cost": 0.0,
    })


def _add_accom(lines: list[dict[str, Any]], selected_values: dict[str, Any]) -> None:
    # ACCOM: kept separate because it requires numAccomNight > 0 as an additional guard
    if not is_true(selected_values, control.CHKACCOM):
        return
    if _to_float(get_value(selected_values, control.NUMACCOMNIGHT, 0)) <= 0:
        return

    qty = calc_qty_per_assembly(
        selected_values,
        cUnit="Per Night",
        nAHFactor=1,
        swi_pair_doubles=True,
    )
    if qty <= 0:
        return

    lines.append({
        "label": "ACCOM",
        "part_id": "ACCOM",
        "revision": "",
        "quantity": qty,
        "manual_cost": 0.0,
    })


def _add_manual_cost(lines: list[dict[str, Any]], selected_values: dict[str, Any], control_name: str, label: str) -> None:
    cost = _to_float(get_value(selected_values, control_name, 0))
    if cost <= 0:
        return

    lines.append({
        "label": label,
        "part_id": "",
        "revision": "",
        "quantity": 1,
        "manual_cost": cost,
    })


def _add_operation_cost(
    lines: list[dict[str, Any]],
    selected_values: dict[str, Any],
    control_name: str,
    label: str,
    apply_after_hours: bool,
) -> None:
    cost = _allocated_project_cost(
        selected_values=selected_values,
        cost=_to_float(get_value(selected_values, control_name, 0)),
        apply_after_hours=apply_after_hours,
    )
    if cost <= 0:
        return

    lines.append({
        "label": label,
        "part_id": "",
        "revision": "",
        "quantity": 1,
        "manual_cost": cost,
        "operation": "INSTA",
    })


def _allocated_project_cost(selected_values: dict[str, Any], cost: float, apply_after_hours: bool) -> float:
    total_doors = max(1, int(_to_float(get_value(selected_values, control.NUMTOTALDOORSPROJ, 1))))
    allocated_cost = int(cost) / total_doors

    if _is_swi_pair(selected_values):
        allocated_cost = int(allocated_cost) * 2

    if apply_after_hours and is_true(selected_values, control.CHKINSAH):
        allocated_cost = int(allocated_cost) * 3

    return allocated_cost


def _is_swi_pair(selected_values: dict[str, Any]) -> bool:
    config_id = str(get_value(selected_values, control.CMBCONFIGID, "") or "").strip().upper()
    return config_id.startswith("SWI-") and is_true(selected_values, control.CHKISPAIR)


def _strip_area(selected_values: dict[str, Any]) -> float:
    return _to_float(get_value(selected_values, control.NUMSTRIPAREA, 0))


def _to_float(value: Any) -> float:
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0.0


def get_value(data: dict[str, Any], field: str, default=None):
    field_key = str(field).lower()

    for key, value in data.items():
        if str(key).lower() == field_key:
            return value

    return default


def is_true(data: dict[str, Any], field: str) -> bool:
    value = get_value(data, field, False)
    return value is True or str(value).strip().lower() in {"true", "1", "yes"}
