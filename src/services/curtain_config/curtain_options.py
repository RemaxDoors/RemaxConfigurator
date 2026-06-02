from __future__ import annotations

from services.curtain_config import curtain_control_names as control


def _options(values: list[str], labels: dict[str, str] | None = None) -> list[dict[str, str]]:
    labels = labels or {}
    return [{"value": value, "label": labels.get(value, value)} for value in values]


def get_window_row_options(door_model: str) -> list[dict[str, str]]:
    door_model = str(door_model or "").strip().upper()

    if door_model in {"MOVICHILL", "MOVICHILL-XL"} or "THERMIC" in door_model:
        return _options(["", "No Window", "CUSTOM"])

    if door_model == "HS25":
        return _options(["", "No Window", "1", "2"], {"1": "1-Row", "2": "2-Rows"})

    if door_model in {"MOVIFOLD", "CONCERTINA"}:
        labels = {str(index): f"{index}-Rows" for index in range(1, 15)}
        return _options(["", "No Window", *[str(index) for index in range(1, 15)], "CUSTOM"], labels)

    labels = {str(index): f"{index}-Rows" for index in range(1, 6)}
    return _options(["", "No Window", "1", "2", "3", "4", "5", "CUSTOM"], labels)


def get_window_type_options(door_model: str) -> list[dict[str, str]]:
    door_model = str(door_model or "").strip().upper()

    if door_model in {"ES40", "BUGSTOP"}:
        return _options(
            ["", "Coloured Panel", "Vision Clear Panel", "Vision Mesh Panel"],
            {
                "Coloured Panel": "ES40 - Coloured",
                "Vision Clear Panel": "ES40 - Vision Clear",
                "Vision Mesh Panel": "ES40 - Vision Mesh",
            },
        )

    if door_model == "CONCERTINA":
        return _options(
            ["", "Coloured Panel", "Vision Clear Panel", "Vision Mesh Panel"],
            {
                "Coloured Panel": "Coloured",
                "Vision Clear Panel": "Coloured With Clear PVC Windows",
                "Vision Mesh Panel": "Coloured With Mesh Windows",
            },
        )

    return _options(["", "No Window", "Clear PVC (Std)", "Mesh"])


def get_window_location_options(door_model: str) -> list[dict[str, str]]:
    door_model = str(door_model or "").strip().upper()

    if door_model in {"EX35", "EX45"}:
        return _options(
            [
                "",
                "Bottom of window at 1265mm from Floor",
                "Bottom of window at 830mm from Floor",
                "Aldi Spec - 1400mm from the floor, 230H x 660W.",
                "CUSTOM",
            ],
            {
                "Bottom of window at 1265mm from Floor": "Bottom of window at 1265mm from Floor (New Spec)",
                "Bottom of window at 830mm from Floor": "Bottom of window at 830mm from Floor (Old Spec)",
            },
        )

    if door_model == "HS25":
        return _options(
            [
                "",
                "No Window Rows",
                "Between 1st and 2nd Windbar",
                "Between 2nd and 3rd Windbar",
                "CUSTOM",
            ]
        )

    if door_model in {"MOVIFOLD", "CONCERTINA"}:
        locations = [f"Between {index}{_ordinal_suffix(index)} and {index + 1}{_ordinal_suffix(index + 1)} Windbar" for index in range(1, 14)]
        return _options(["", "No Window Rows", *locations, "CUSTOM"])

    locations = [f"Between {index}{_ordinal_suffix(index)} and {index + 1}{_ordinal_suffix(index + 1)} Windbar" for index in range(1, 9)]
    return _options(["", "No Window Rows", *locations, "CUSTOM"])


def _ordinal_suffix(value: int) -> str:
    if 10 <= value % 100 <= 20:
        return "th"
    return {1: "st", 2: "nd", 3: "rd"}.get(value % 10, "th")


M1_OPTIONS = {
    control.CMBCURTAINCOLOUR: [
        {"value": "", "label": ""},
        {"value": "Light Green 602", "label": "Light Green 602 (Not Stocked)"},
        {"value": "Dark Green 679", "label": "Dark Green 679"},
        {"value": "Grey 705", "label": "Grey 705"},
        {"value": "Light Grey 729", "label": "Light Grey 729"},
        {"value": "Black 905", "label": "Black 905"},
        {"value": "Blue 560", "label": "Blue 560 (Obsolete)"},
        {"value": "Blue 520", "label": "Blue 520"},
        {"value": "Light Blue 586", "label": "Light Blue 586"},
        {"value": "Navy 541", "label": "Navy 541"},
        {"value": "Red 356", "label": "Red 356"},
        {"value": "Burgundy 371", "label": "Burgundy 371"},
        {"value": "Orange 244", "label": "Orange 244"},
        {"value": "Yellow 119", "label": "Yellow 119"},
        {"value": "White 907", "label": "White 907"},
        {"value": "B6353-Grey", "label": "Thermic Grey"},
        {"value": "Thermic Red", "label": "Thermic Red"},
        {"value": "Antistatic - Black Face Side", "label": "Antistatic - Black Door Side, Yellow Non-door Side"},
        {"value": "Antistatic - Yellow Face Side", "label": "Antistatic - Yellow Door Side, Black Non-door Side"},
        {"value": "***Custom***", "label": "Custom - confirm before order"},
    ],
    control.CMBFLOORSLOPE: _options(
        [
            "No Slope",
            "Subtract from LHS (RHS Taller)",
            "Subtract from RHS (LHS Taller)",
            "Add to LHS (LHS Taller)",
            "Add to RHS (RHS Taller)",
        ]
    ),
    control.CMBWINDPOT: _options(
        ["", "Low", "Med", "High"],
        {"Low": "Low Wind", "Med": "Medium Wind", "High": "High Wind"},
    ),
}
