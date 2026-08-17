"""Curtain pricing — ported from the Streamlit app (repositories/pricing_lookup.py
and services/curtain_config/*) so the API no longer depends on src/.

Prices come from M1:
  uCurtainPrices  — unit price by door model / drop / width / component
  uRapidFormulas  — per-model finished-dimension corrections
"""
from sqlalchemy import text

from .m1_pricing import get_m1_engine


def _num(v) -> float:
    try:
        return float(v or 0)
    except (TypeError, ValueError):
        return 0.0


def _get(values: dict, field: str, default=None):
    """Case-insensitive lookup, matching the Streamlit get_value()."""
    key = str(field).lower()
    for k, v in values.items():
        if str(k).lower() == key:
            return v
    return default


def _is_true(values: dict, field: str) -> bool:
    v = _get(values, field, False)
    if isinstance(v, bool):
        return v
    if isinstance(v, (int, float)):
        return v != 0
    return str(v or "").strip().lower() in {"1", "true", "yes"}


# ---------------------------------------------------------------------------
# Which uCurtainPrices model key to price against
# ---------------------------------------------------------------------------
def curtain_price_key(door_model: str, values: dict) -> str:
    m = str(door_model or "").strip().upper()
    if m == "HS25" and _is_true(values, "CHKHS25SPECIAL"):
        return "HS25SPECIAL"
    if m == "EX45":
        return "EX35"
    if m == "MOVICHILL-XL":
        return "MOVICHILL"
    if m == "BUGSTOP":
        return "ES40"
    if m in {"HS50", "HS65"} and str(_get(values, "CMBCURTAINCOLOUR", "") or "").startswith("Antistatic"):
        return "HS50-HS65-AS"
    return m


# ---------------------------------------------------------------------------
# Finished curtain dimensions
# ---------------------------------------------------------------------------
def _formula_correction(model: str, descriptor: str) -> float:
    with get_m1_engine().connect() as conn:
        row = conn.execute(text(
            "SELECT TOP 1 ISNULL(urfCorr,0) FROM uRapidFormulas "
            "WHERE urfDoorModelID = :m AND urfDesc = :d "
            "ORDER BY urfDoorModelID DESC, urfRapidFormulaID DESC"
        ), {"m": model, "d": descriptor}).fetchone()
    return _num(row[0]) if row else 0.0


def _growing_height_correction(model: str, height: float) -> float:
    if model == "MOVIFOLD":
        for upper, corr in ((6000, 75), (7000, 150), (8000, 225), (9000, 300)):
            if upper - 1000 < height <= upper:
                return corr
    if model == "CONCERTINA":
        for upper, corr in ((6000, 55), (7000, 110), (8000, 165), (9000, 220), (10000, 275)):
            if upper - 1000 < height <= upper:
                return corr
    return 0.0


def finished_dimensions(door_model: str, values: dict) -> dict:
    """Finished curtain height/width after slope, track and per-model corrections."""
    model = str(door_model or "").strip().upper()
    formula_model = "ES40" if model == "BUGSTOP" else model

    height = _num(_get(values, "NUMDOORHEIGHT", 0))
    width = _num(_get(values, "NUMDOORWIDTH", 0))
    slope_amount = _num(_get(values, "NUMFLOORSLOPE", 0))
    slope = str(_get(values, "CMBFLOORSLOPE", "No Slope") or "")
    slope_required = _is_true(values, "CHKSLOPEREQUIRED")
    track_config = str(_get(values, "CMBTRACKCONFIG", "") or "")
    wind_track = str(_get(values, "CMBWINDTRACK", "") or "")

    left = right = height
    if slope_required and slope_amount > 0 and slope != "No Slope":
        if slope == "Subtract from LHS (RHS Taller)":
            left = max(0, height - slope_amount)
        elif slope == "Subtract from RHS (LHS Taller)":
            right = max(0, height - slope_amount)
        elif slope == "Add to LHS (LHS Taller)":
            left = height + slope_amount
        elif slope == "Add to RHS (RHS Taller)":
            right = height + slope_amount

    adjusted_width = width
    concealed = high_wind = 0.0
    if track_config == "Concealed":
        if formula_model in {"EX35", "EX45"}:
            concealed = 50
        elif formula_model in {"MOVIFOLD", "CONCERTINA"}:
            concealed = 0
        else:
            concealed = 170
        adjusted_width = width + concealed
        if wind_track == "Yes":
            high_wind = 260
            adjusted_width = width + high_wind

    h_corr = (_formula_correction(formula_model, "Curtain Height")
              + _growing_height_correction(formula_model, height))
    w_corr = _formula_correction(formula_model, "Curtain Width")

    return {
        "finishedHeightLeft": max(0, left + h_corr),
        "finishedHeightRight": max(0, right + h_corr),
        "finishedWidth": max(0, adjusted_width + w_corr),
        "concealedCorrection": concealed,
        "highWindCorrection": high_wind,
        "heightCorrection": h_corr,
        "widthCorrection": w_corr,
    }


# ---------------------------------------------------------------------------
# Component pricing
# ---------------------------------------------------------------------------
def _component_price(model: str, drop: float, width: float, component: str | None = None) -> float:
    sql = ("SELECT TOP 1 ISNULL(ucpUnitPrice,0) FROM uCurtainPrices "
           "WHERE ucpDoorModelID = :m AND ucpDrop >= :d AND ucpWidth >= :w")
    params = {"m": model, "d": drop, "w": width}
    if component is not None:
        sql += " AND ucpPriceComponentID = :c"
        params["c"] = component
    sql += " ORDER BY ucpUnitPrice ASC"
    with get_m1_engine().connect() as conn:
        row = conn.execute(text(sql), params).fetchone()
    return _num(row[0]) if row else 0.0


def _component(name: str, qty: float, unit: float) -> dict:
    return {"component": name, "quantity": qty, "unitPrice": unit, "extendedPrice": qty * unit}


def price_curtain(values: dict) -> dict:
    """Curtain price for a configuration. Mirrors DoorPriceLookup.get_curtain_price."""
    door_model = str(_get(values, "CMBDOORMODEL", "") or "").strip()
    key = curtain_price_key(door_model, values)
    dims = finished_dimensions(door_model, values)
    drop = max(dims["finishedHeightLeft"], dims["finishedHeightRight"])
    width = dims["finishedWidth"]

    coloured_qty = _num(_get(values, "NUMES40PANELSCOLOURED", 0))
    clear_qty = _num(_get(values, "NUMES40PANELSVISIONCLEAR", 0))
    mesh_qty = _num(_get(values, "NUMES40PANELSVISIONMESH", 0))

    if key == "ES40":
        bottom = _component_price(key, 10, width, "Bottom Edge")
        coloured = _component_price(key, 10, width, "Coloured Panel")
        clear = _component_price(key, 10, width, "Clear Panel")
        components = [
            _component("Bottom Edge", 1, bottom),
            _component("Coloured Panel", coloured_qty, coloured),
            _component("Vision Clear Panel", clear_qty, clear),
            _component("Vision Mesh Panel", mesh_qty, clear),
        ]
    elif key == "CONCERTINA":
        bottom = _component_price(key, 10, width, "Bottom Edge")
        panel_drop = _num(_get(values, "NUMPANELHEIGHT", 0)) or max(
            _num(_get(values, "NUMCURTFINHL", 0)), _num(_get(values, "NUMCURTFINHR", 0))
        )
        coloured = _component_price(key, panel_drop, width, "Coloured Panel")
        windows_per_panel = _num(_get(values, "NUMWINDOWSREQ", 0))
        components = [
            _component("Bottom Edge", 1, bottom),
            _component("Coloured Panel", coloured_qty * 2, coloured),
            {
                "component": "Vision Clear Panel", "quantity": clear_qty * 2, "unitPrice": coloured,
                "extendedPrice": ((clear_qty * coloured) + (clear_qty * windows_per_panel * 26)) * 2,
            },
            {
                "component": "Vision Mesh Panel", "quantity": mesh_qty * 2, "unitPrice": coloured,
                "extendedPrice": ((mesh_qty * coloured) + (mesh_qty * windows_per_panel * 26)) * 2,
            },
        ]
    else:
        component = "ALDI D07 with Zip" if (
            _is_true(values, "CHKEMERGZIP") and key == "EX35"
        ) else None
        price = _component_price(key, drop, width, component)
        components = [_component(component or "Curtain", 1, price)] if price else []

    total = sum(c["extendedPrice"] for c in components)
    return {
        "curtainModel": key,
        "curtainSell": round(total, 2),
        "curtainCost": round(total, 2),
        "components": components,
        "dimensions": dims,
    }


# ---------------------------------------------------------------------------
# Curtain option flags (summary, not priced parts)
# ---------------------------------------------------------------------------
_FLAGS = [
    ("CHKSLOPEREQUIRED", "Slope edge"),
    ("CHKDRIPEDGE", "Drip edge"),
    ("CHKCOMOWEAR", "Como wear strip"),
    ("CHKEMERGZIP", "Emergency zip"),
    ("CHKCUSTBOTTOMEDGE", "Custom bottom edge"),
    ("CHKCUSTSCREENPRINT", "Custom screen printing"),
]


def curtain_upgrades(values: dict) -> list[dict]:
    out = [{"upgrade": label, "control": ctrl, "quantity": 1}
           for ctrl, label in _FLAGS if _is_true(values, ctrl)]
    extra = int(_num(_get(values, "NUMEXTRAWINDOWS", 0)))
    if extra > 0:
        out.append({"upgrade": "Extra windows", "control": "NUMEXTRAWINDOWS", "quantity": extra})
    return out
