from __future__ import annotations

from typing import Any

from services.movidor_door_config import movidor_control_names as door_control
from services.curtain_config import curtain_control_names as control
from services.data_mapping import get_value


def build_upgrade_columns(
    selected_values: dict[str, Any],
    part_prices: dict[str, dict[str, Any]],
) -> list[dict[str, Any]]:
    """
    Returns curtain upgrade rows for the configurator grid.

    Keep curtain material, assembly, and discount rules here so the curtain
    configurator follows the same pattern as the Movidor door rules.
    """

    assembly_upgrades: list[dict[str, Any]] = []
    material_upgrades: list[dict[str, Any]] = []
    material_discount: list[dict[str, Any]] = []

    door_model = str(get_value(selected_values, door_control.CMBDOORMODEL, "") or "").strip().upper()
    extra_windows = _to_int(get_value(selected_values, control.NUMEXTRAWINDOWS, 0))
    folding_door = door_model in {"CONCERTINA", "MOVIFOLD"}

    if extra_windows > 0 and door_model == "HS25":
        part_id = "OPTION-RRD-WIN-HS25"
        part = part_prices.get(part_id, {})
        material_upgrades.append({
            "part_id": part_id,
            "label": part.get("label", part_id),
            "price": float(part.get("price", 0) or 0),
            "cost": float(part.get("cost", 0) or 0),
            "quantity": _extra_window_rows_quantity(selected_values),
            "revision": "",
        })

    if extra_windows > 0 and door_model == "HS35":
        part_id = "OPTION-RRD-WIN-HS35"
        part = part_prices.get(part_id, {})
        material_upgrades.append({
            "part_id": part_id,
            "label": part.get("label", part_id),
            "price": float(part.get("price", 0) or 0),
            "cost": float(part.get("cost", 0) or 0),
            "quantity": _extra_window_rows_quantity(selected_values),
            "revision": "",
        })

    if extra_windows > 0 and door_model in {"HS50", "HS65"}:
        part_id = "OPTION-RRD-WIN-HS65"
        part = part_prices.get(part_id, {})
        material_upgrades.append({
            "part_id": part_id,
            "label": part.get("label", part_id),
            "price": float(part.get("price", 0) or 0),
            "cost": float(part.get("cost", 0) or 0),
            "quantity": _extra_window_rows_quantity(selected_values),
            "revision": "",
        })

    if _is_true(get_value(selected_values, control.CHKSLOPEREQUIRED, False)) and not folding_door:
        part_id = "OPTION-CURTAIN-SLOPE"
        part = part_prices.get(part_id, {})
        material_upgrades.append({
            "part_id": part_id,
            "label": part.get("label", part_id),
            "price": float(part.get("price", 0) or 0),
            "cost": float(part.get("cost", 0) or 0),
            "quantity": 1,
            "revision": "",
        })

    if _is_true(get_value(selected_values, control.CHKSLOPEREQUIRED, False)) and folding_door:
        part_id = "OPTION-CURTAIN-SLOPE-FOL"
        part = part_prices.get(part_id, {})
        material_upgrades.append({
            "part_id": part_id,
            "label": part.get("label", part_id),
            "price": float(part.get("price", 0) or 0),
            "cost": float(part.get("cost", 0) or 0),
            "quantity": 1,
            "revision": "",
        })

    if _is_true(get_value(selected_values, control.CHKCUSTBOTTOMEDGE, False)):
        part_id = "OPTION-CURTAIN-BOT-EDGE"
        part = part_prices.get(part_id, {})
        material_upgrades.append({
            "part_id": part_id,
            "label": part.get("label", part_id),
            "price": float(part.get("price", 0) or 0),
            "cost": float(part.get("cost", 0) or 0),
            "quantity": 1,
            "revision": "",
        })

    if _is_true(get_value(selected_values, control.CHKDRIPEDGE, False)):
        part_id = "OPTION-CURTAIN-DRIP-EDGE"
        part = part_prices.get(part_id, {})
        material_upgrades.append({
            "part_id": part_id,
            "label": part.get("label", part_id),
            "price": float(part.get("price", 0) or 0),
            "cost": float(part.get("cost", 0) or 0),
            "quantity": 1,
            "revision": "",
        })

    if _is_true(get_value(selected_values, control.CHKCOMOWEAR, False)):
        part_id = "OPTION-CURTAIN-WEAR-STRIP"
        part = part_prices.get(part_id, {})
        material_upgrades.append({
            "part_id": part_id,
            "label": part.get("label", part_id),
            "price": float(part.get("price", 0) or 0),
            "cost": float(part.get("cost", 0) or 0),
            "quantity": 1,
            "revision": "",
        })

    curtain_colour = str(get_value(selected_values, control.CMBCURTAINCOLOUR, "") or "").strip()
    if curtain_colour.startswith("Antistatic"):
        part_id = "OPTION-RRD-ANTISTATIC"
        part = part_prices.get(part_id, {})
        material_upgrades.append({
            "part_id": part_id,
            "label": part.get("label", part_id),
            "price": float(part.get("price", 0) or 0),
            "cost": float(part.get("cost", 0) or 0),
            "quantity": _antistatic_quantity(selected_values),
            "revision": "",
        })

    rows = []
    max_rows = max(len(assembly_upgrades), len(material_upgrades), len(material_discount))

    for index in range(max_rows):
        assembly = assembly_upgrades[index] if index < len(assembly_upgrades) else {}
        material = material_upgrades[index] if index < len(material_upgrades) else {}
        discount = material_discount[index] if index < len(material_discount) else {}

        rows.append({
            "Assembly Upgrade": assembly.get("label", ""),
            "Assembly Part ID": assembly.get("part_id", ""),
            "Assembly Revision": assembly.get("revision", ""),
            "Assembly Qty": assembly.get("quantity", ""),
            "Assembly Price": assembly.get("price", ""),
            "Assembly Cost": assembly.get("cost", ""),
            "Material Discount": discount.get("label", ""),
            "Material Discount Part ID": discount.get("part_id", ""),
            "Material Discount Revision": discount.get("revision", ""),
            "Material Discount Qty": discount.get("quantity", ""),
            "Material Discount Price": discount.get("price", ""),
            "Material Discount Cost": discount.get("cost", ""),
            "Material Upgrade": material.get("label", ""),
            "Material Part ID": material.get("part_id", ""),
            "Material Revision": material.get("revision", ""),
            "Material Qty": material.get("quantity", ""),
            "Material Price": material.get("price", ""),
            "Material Cost": material.get("cost", ""),
        })

    return rows


def _extra_window_rows_quantity(selected_values: dict[str, Any]) -> int:
    row_count = _to_int(get_value(selected_values, control.CMBNUMWINDROWS, 0))
    if row_count in {2, 3, 4, 5}:
        return row_count - 1
    return 1


def _antistatic_quantity(selected_values: dict[str, Any]) -> float:
    adjusted_width = _to_float(get_value(selected_values, "NUMADJUSTEDWIDTH", 0))
    if adjusted_width == 0:
        adjusted_width = _to_float(get_value(selected_values, control.NUMCURTFINW, 0))
    if adjusted_width == 0:
        adjusted_width = _to_float(get_value(selected_values, door_control.NUMDOORWIDTH, 0))

    door_height = _to_float(get_value(selected_values, door_control.NUMDOORHEIGHT, 0))
    return (_to_int(adjusted_width / 100) * _to_int(door_height / 100)) / 100


def _is_true(value: Any) -> bool:
    return value is True or str(value).strip().lower() in {"1", "true", "yes"}


def _to_int(value: Any) -> int:
    """Mirrors VB's CInt: rounds to nearest integer (half rounds away from zero)."""
    try:
        return round(float(value or 0))
    except (TypeError, ValueError):
        return 0


def _to_float(value: Any) -> float:
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0.0
