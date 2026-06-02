from __future__ import annotations

import math

import streamlit as st

from services.curtain_config import curtain_control_names as control


def is_hs25_special(door_model: str, door_height: float) -> bool:
    door_model = str(door_model or "").strip().upper()
    door_height = float(door_height or 0)
    return door_model == "HS25" and (
        1070 < door_height < 1800
        or 2025 < door_height < 2610
    )


def calculate_default_windows(door_model: str, curtain_width: float) -> int:
    door_model = str(door_model or "").strip().upper()
    curtain_width = float(curtain_width or 0)

    if door_model in {"HS35-THERMIC", "HS50-THERMIC", "MOVICHILL", "MOVICHILL-XL"}:
        return 0

    if door_model in {"EX35", "EX45"}:
        if curtain_width <= 1600:
            return 1
        if curtain_width <= 2800:
            return 2
        return 3

    if door_model == "MOVIFOLD":
        if curtain_width <= 3000:
            return 2
        if curtain_width <= 5000:
            return 3
        return 6

    if curtain_width <= 0:
        return 0

    return min(13, max(1, math.ceil((curtain_width - 1800) / 1000) + 1))


def get_default_selections(door_model: str, door_height: float = 0, curtain_width: float = 0) -> dict[str, object]:
    door_model = str(door_model or "").strip().upper()
    hs25_special = is_hs25_special(door_model, door_height)
    default_windows = calculate_default_windows(door_model, curtain_width)
    defaults: dict[str, object] = {
        control.NUMWINDOWSDEFAULT: default_windows,
        control.NUMWINDOWSREQ: default_windows,
        control.CHKUSEDEFAULTWINPERROW: 1,
        control.CHKHS25SPECIAL: int(hs25_special),
    }
    defaults.update(_blank_window_rows())

    if not door_model:
        return defaults

    if "THERMIC" in door_model or door_model in {"MOVICHILL", "MOVICHILL-XL"}:
        defaults.update({
            control.CMBNUMWINDROWS: "No Window",
            control.CMBWINDOWTYPEDEFAULT: "No Window",
            control.CMBCURTAINCOLOUR: "B6353-Grey" if "THERMIC" in door_model else "",
            control.WINDOW_ROW_LOCATION_NAMES[0]: "No Window Rows",
        })
        return defaults

    if door_model in {"ES40", "BUGSTOP"}:
        defaults.update({
            control.CMBNUMWINDROWS: "No Window",
            control.WINDOW_ROW_LOCATION_NAMES[0]: "Between 1st and 2nd Windbar",
            control.WINDOW_ROW_LOCATION_NAMES[1]: "Between 2nd and 3rd Windbar",
            control.WINDOW_ROW_LOCATION_NAMES[2]: "Between 3rd and 4th Windbar",
            control.WINDOW_ROW_TYPE_NAMES[0]: "Coloured Panel",
            control.WINDOW_ROW_TYPE_NAMES[1]: "Vision Clear Panel",
            control.WINDOW_ROW_TYPE_NAMES[2]: "Coloured Panel",
        })
        return defaults

    if door_model in {"EX35", "EX45"}:
        defaults.update({
            control.CMBNUMWINDROWS: "1",
            control.CMBWINDOWTYPEDEFAULT: "Clear PVC (Std)",
            control.WINDOW_ROW_LOCATION_NAMES[0]: "Bottom of window at 1265mm from Floor",
            control.WINDOW_ROW_TYPE_NAMES[0]: "Clear PVC (Std)",
        })
        return defaults

    if door_model == "HS25":
        defaults.update({
            control.CMBNUMWINDROWS: "1",
            control.CMBWINDOWTYPEDEFAULT: "Clear PVC (Std)",
            control.WINDOW_ROW_LOCATION_NAMES[0]: (
                "Between 2nd and 3rd Windbar"
                if hs25_special
                else "Between 1st and 2nd Windbar"
            ),
            control.WINDOW_ROW_TYPE_NAMES[0]: "Clear PVC (Std)",
        })
        return defaults

    if door_model == "CONCERTINA":
        defaults.update({
            control.CMBNUMWINDROWS: "No Window",
            control.WINDOW_ROW_LOCATION_NAMES[0]: "Between 1st and 2nd Windbar",
            control.WINDOW_ROW_LOCATION_NAMES[1]: "Between 2nd and 3rd Windbar",
            control.WINDOW_ROW_LOCATION_NAMES[2]: "Between 3rd and 4th Windbar",
            control.WINDOW_ROW_TYPE_NAMES[0]: "Coloured Panel",
            control.WINDOW_ROW_TYPE_NAMES[1]: "Vision Clear Panel",
            control.WINDOW_ROW_TYPE_NAMES[2]: "Coloured Panel",
        })
        return defaults

    defaults.update({
        control.CMBNUMWINDROWS: "1",
        control.CMBWINDOWTYPEDEFAULT: "Clear PVC (Std)",
        control.WINDOW_ROW_LOCATION_NAMES[0]: "Between 2nd and 3rd Windbar",
        control.WINDOW_ROW_TYPE_NAMES[0]: "Clear PVC (Std)",
    })
    return defaults


def apply_default_selections(door_model: str, door_height: float = 0, curtain_width: float = 0) -> dict[str, object]:
    defaults = get_default_selections(door_model, door_height, curtain_width)

    for control_name, control_value in defaults.items():
        st.session_state[control_name] = control_value

    return defaults


def calculate_es40_panels(
    door_model: str,
    finished_height_left: float,
    finished_height_right: float,
    adjusted_height_left: float,
    adjusted_height_right: float,
    window_row_types: list[str],
) -> dict:
    """
    Mirrors VB ES40CalculatePanels().

    ES40 / BUGSTOP
    --------------
    panels_req  = ceil((largest_finished_height - 230) / 830)

    CONCERTINA
    ----------
    Panel COUNT  uses adjusted DLO heights (slope applied, no curtain correction):
        panels_req = ceil((smallest_adjusted_height - 230) / 1070)

    Panel HEIGHT uses finished curtain heights:
        panel_height = round((smallest_finished - 230 - panels_req * 20) / panels_req)
        If panel_height > 1100: add one more panel and recalculate.

    Panel type counts are derived from CmbWindRowType1–14:
        "Coloured Panel", "Vision Clear Panel", "Vision Mesh Panel"
    """
    door_model = str(door_model or "").strip().upper()

    panels_coloured     = sum(1 for t in window_row_types if t == "Coloured Panel")
    panels_vision_clear = sum(1 for t in window_row_types if t == "Vision Clear Panel")
    panels_vision_mesh  = sum(1 for t in window_row_types if t == "Vision Mesh Panel")
    panel_height = 0.0
    panels_req = 0

    if door_model in {"ES40", "BUGSTOP"}:
        largest = max(finished_height_left, finished_height_right)
        panels_req = math.ceil((largest - 230) / 830) if largest > 230 else 0

    elif door_model == "CONCERTINA":
        # Panel count — adjusted DLO height (no curtain correction factor)
        smallest_adj = min(adjusted_height_left, adjusted_height_right)
        panels_req = math.ceil((smallest_adj - 230) / 1070) if smallest_adj > 230 else 0

        # Panel height — finished curtain height
        smallest_fin = min(finished_height_left, finished_height_right)
        _WIND_BATTEN = 20
        _BOTTOM_EDGE = 230
        if panels_req > 0:
            panel_height = round(
                (smallest_fin - _BOTTOM_EDGE - panels_req * _WIND_BATTEN) / panels_req
            )
            if panel_height > 1100:
                panels_req += 1
                panel_height = round(
                    (smallest_fin - _BOTTOM_EDGE - panels_req * _WIND_BATTEN) / panels_req
                )

    return {
        "panels_req":          max(0, panels_req),
        "panels_coloured":     panels_coloured,
        "panels_vision_clear": panels_vision_clear,
        "panels_vision_mesh":  panels_vision_mesh,
        "panel_height":        float(panel_height),
    }


def _blank_window_rows() -> dict[str, str]:
    values: dict[str, str] = {}
    for control_name in (*control.WINDOW_ROW_LOCATION_NAMES, *control.WINDOW_ROW_TYPE_NAMES):
        values[control_name] = ""
    return values
