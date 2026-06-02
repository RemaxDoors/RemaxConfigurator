from __future__ import annotations

from services.curtain_config import curtain_control_names as control
from services.data_mapping import get_value, is_true


def get_curtain_price_key(door_model: str, selected_values: dict) -> str:
    door_model = str(door_model or "").strip().upper()

    if door_model == "HS25" and is_true(selected_values, control.CHKHS25SPECIAL):
        return "HS25SPECIAL"
    if door_model == "EX45":
        return "EX35"
    if door_model == "MOVICHILL-XL":
        return "MOVICHILL"
    if door_model == "BUGSTOP":
        return "ES40"
    if door_model in {"HS50", "HS65"} and str(get_value(selected_values, control.CMBCURTAINCOLOUR, "")).startswith("Antistatic"):
        return "HS50-HS65-AS"
    return door_model


def build_curtain_upgrade_summary(selected_values: dict) -> list[dict[str, object]]:
    upgrades: list[dict[str, object]] = []

    _add_flag_upgrade(upgrades, selected_values, control.CHKSLOPEREQUIRED, "Slope edge")
    _add_flag_upgrade(upgrades, selected_values, control.CHKDRIPEDGE, "Drip edge")
    _add_flag_upgrade(upgrades, selected_values, control.CHKCOMOWEAR, "Como wear strip")
    _add_flag_upgrade(upgrades, selected_values, control.CHKEMERGZIP, "Emergency zip")
    _add_flag_upgrade(upgrades, selected_values, control.CHKCUSTBOTTOMEDGE, "Custom bottom edge")
    _add_flag_upgrade(upgrades, selected_values, control.CHKCUSTSCREENPRINT, "Custom screen printing")

    extra_windows = int(get_value(selected_values, control.NUMEXTRAWINDOWS, 0) or 0)
    if extra_windows > 0:
        upgrades.append({
            "Upgrade": "Extra windows",
            "Control": control.NUMEXTRAWINDOWS,
            "Quantity": extra_windows,
        })

    return upgrades


def _add_flag_upgrade(upgrades: list[dict[str, object]], selected_values: dict, control_name: str, label: str) -> None:
    if is_true(selected_values, control_name):
        upgrades.append({
            "Upgrade": label,
            "Control": control_name,
            "Quantity": 1,
        })
