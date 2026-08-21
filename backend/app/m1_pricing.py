"""M1 pricing — door price + part prices come from the M1 database.

- Door price/cost: uSellPriceMatrixs (smallest matrix cell that fits W×H).
- Part price/cost: PartUnitSalePrices (+ Parts / PartRevisions).
- Upgrade / installation parts come from app.pricing_rules, then priced from M1.
"""
import urllib.parse

from sqlalchemy import create_engine, text

from . import settings
from .pricing_rules import build_installation_lines, build_upgrade_columns

# Kept so callers can still branch on rule availability; the rules are part of
# this package now, so importing them cannot fail at runtime the way the old
# sys.path lookup into ../../src could.
_RULES_OK = True

_engine = None


def get_m1_engine():
    global _engine
    if _engine is None:
        params = urllib.parse.quote_plus(
            f"DRIVER={{{settings.DB_DRIVER}}};"
            f"SERVER={settings.DB_SERVER};"
            f"DATABASE={settings.DB_NAME};"
            f"UID={settings.DB_USER};"
            f"PWD={settings.DB_PASSWORD};"
            "TrustServerCertificate=yes;"
        )
        _engine = create_engine(f"mssql+pyodbc:///?odbc_connect={params}")
    return _engine


def _num(v) -> float:
    try:
        return float(v or 0)
    except (TypeError, ValueError):
        return 0.0


def door_price(model: str, width: float, height: float) -> dict:
    if not model:
        return {"sell": 0.0, "cost": 0.0}
    with get_m1_engine().connect() as conn:
        row = conn.execute(text(
            "SELECT TOP 1 uaeRetailPriceBase, uaeDoorCost FROM dbo.uSellPriceMatrixs "
            "WHERE uaeDoorModelID = :m AND uaeHeight >= :h AND uaeWidth >= :w "
            "ORDER BY uaeHeight ASC, uaeWidth ASC"
        ), {"m": model, "h": height, "w": width}).fetchone()
    if not row:
        return {"sell": 0.0, "cost": 0.0}
    return {"sell": _num(row[0]), "cost": _num(row[1])}


def part_price(part_id: str, revision) -> dict:
    if not part_id:
        return {"sell": 0.0, "cost": 0.0, "description": ""}
    rev = "" if revision in (None, "None") else str(revision)
    with get_m1_engine().connect() as conn:
        row = conn.execute(text(
            "SELECT TOP 1 imrShortDescription, "
            "(COALESCE(imrAverageDutyCost,0)+COALESCE(imrAverageFreightCost,0)"
            "+COALESCE(imrAverageLaborCost,0)+COALESCE(imrAverageMaterialCost,0)"
            "+COALESCE(imrAverageMiscCost,0)+COALESCE(imrAverageSubcontractCost,0)"
            "+COALESCE(imrAverageOverheadCost,0)) AS TotalUnitCost, imhUnitSalePrice "
            "FROM PartUnitSalePrices "
            "LEFT JOIN Parts ON impPartID = imhPartID "
            "LEFT JOIN PartRevisions ON imhPartID = imrPartID AND imhPartRevisionID = imrPartRevisionID "
            "WHERE (imhEndDate IS NULL OR imhEndDate = '') AND imhPartID = :p "
            "AND COALESCE(imhPartRevisionID,'') = :r"
        ), {"p": part_id, "r": rev}).fetchone()
    if not row:
        return {"sell": 0.0, "cost": 0.0, "description": ""}
    return {"description": row[0] or "", "cost": _num(row[1]), "sell": _num(row[2])}


# Tables the mapping UI is allowed to read column metadata for.
MAPPABLE_TABLES = {
    "Quotes",
    "QuoteLines",
    "QuoteQuantities",  # where M1 keeps line pricing (qty, unit price, totals)
    "FormInputValues",
    "uFormInputValues",
}


def table_columns(table: str) -> list[dict]:
    """Column metadata for an allowlisted M1 table (the SELECT * WHERE 1=0 list)."""
    if table not in MAPPABLE_TABLES:
        raise ValueError(f"Table '{table}' is not mappable")
    with get_m1_engine().connect() as conn:
        rows = conn.execute(text(
            "SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE "
            "FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = :t ORDER BY ORDINAL_POSITION"
        ), {"t": table}).fetchall()
    return [
        {
            "name": r[0],
            "type": r[1],
            "maxLength": r[2],
            "nullable": r[3] == "YES",
            # timestamp/identity columns should never be written by us
            "readOnly": r[1] in ("timestamp",),
        }
        for r in rows
    ]


def search_parts(term: str, limit: int = 40) -> list[dict]:
    """Search active M1 parts by part id or description, with sell + cost."""
    q = (term or "").strip()
    if len(q) < 2:
        return []
    like = f"%{q}%"
    with get_m1_engine().connect() as conn:
        rows = conn.execute(text(
            "SELECT TOP (:lim) pr.imrPartID, pr.imrPartRevisionID, pr.imrShortDescription, "
            "pr.imrLongDescriptionText, "
            "COALESCE(psp.imhUnitSalePrice, pr.uimrConfigSellPrice, 0) AS SellPrice, "
            "(COALESCE(pr.imrAverageDutyCost,0)+COALESCE(pr.imrAverageFreightCost,0)"
            "+COALESCE(pr.imrAverageLaborCost,0)+COALESCE(pr.imrAverageMaterialCost,0)"
            "+COALESCE(pr.imrAverageMiscCost,0)+COALESCE(pr.imrAverageSubcontractCost,0)"
            "+COALESCE(pr.imrAverageOverheadCost,0)) AS Cost "
            "FROM PartRevisions pr "
            "LEFT JOIN Parts p ON p.impPartID = pr.imrPartID "
            "LEFT JOIN PartUnitSalePrices psp ON psp.imhPartID = pr.imrPartID "
            "AND psp.imhPartRevisionID = pr.imrPartRevisionID "
            "AND (psp.imhEndDate IS NULL OR psp.imhEndDate = '') "
            "WHERE ISNULL(p.impInactive, 0) = 0 "
            "AND (pr.imrPartID LIKE :like OR pr.imrShortDescription LIKE :like) "
            "ORDER BY CASE WHEN pr.imrPartID LIKE :starts THEN 0 ELSE 1 END, pr.imrPartID"
        ), {"lim": limit, "like": like, "starts": f"{q}%"}).fetchall()
    return [
        {
            "partId": r[0],
            "partRevision": r[1] or "",
            "partDescription": r[2] or "",
            "partLongDescription": r[3] or "",
            "sell": _num(r[4]),
            "cost": _num(r[5]),
        }
        for r in rows
    ]


def price_configuration(values: dict) -> dict:
    """Full priced breakdown for a door configuration."""
    model = str(values.get("CMBDOORMODEL", "") or "").strip()
    width = _num(values.get("NUMDOORWIDTH"))
    height = _num(values.get("NUMDOORHEIGHT"))
    qty = int(_num(values.get("QTY", 1)) or 1)

    door = door_price(model, width, height)

    assembly_sell = assembly_cost = 0.0
    material_sell = material_cost = 0.0
    disc_sell = disc_cost = 0.0
    inst_sell = inst_cost = 0.0
    lines: list[dict] = []

    def add_line(category, part_id, rev, qty_raw, fallback_label):
        pp = part_price(part_id, rev)
        q = _num(qty_raw or 1)
        sell, cost = pp["sell"] * q, pp["cost"] * q
        lines.append({
            "category": category,
            "partId": part_id,
            "description": pp["description"] or fallback_label or part_id,
            "qty": q,
            "sell": sell,
            "cost": cost,
        })
        return sell, cost

    if _RULES_OK and model:
        for r in build_upgrade_columns(values, part_prices={}):
            if r.get("Assembly Part ID"):
                s, c = add_line("ASSEMBLY_UPGRADE", r["Assembly Part ID"],
                                r.get("Assembly Revision"), r.get("Assembly Qty"),
                                r.get("Assembly Upgrade"))
                assembly_sell += s
                assembly_cost += c
            if r.get("Material Part ID"):
                s, c = add_line("MATERIAL_UPGRADE", r["Material Part ID"],
                                r.get("Material Revision"), r.get("Material Qty"),
                                r.get("Material Upgrade"))
                material_sell += s
                material_cost += c
            if r.get("Material Discount Part ID"):
                s, c = add_line("MATERIAL_DISCOUNT", r["Material Discount Part ID"],
                                r.get("Material Discount Revision"), r.get("Material Discount Qty"),
                                r.get("Material Discount"))
                disc_sell += s
                disc_cost += c

        for il in build_installation_lines(values):
            pid = il.get("part_id", "")
            q = _num(il.get("quantity", 1))
            if pid:
                pp = part_price(pid, il.get("revision", ""))
                s, c = pp["sell"] * q, pp["cost"] * q
                desc = pp["description"] or il.get("label", pid)
            else:
                mc = _num(il.get("manual_cost", 0))
                s = c = mc * q
                desc = il.get("label", "")
            inst_sell += s
            inst_cost += c
            lines.append({
                "category": "INSTALLATION", "partId": pid, "description": desc,
                "qty": q, "sell": s, "cost": c,
            })

    material_upgrade_sell = assembly_sell + material_sell
    material_upgrade_cost = assembly_cost + material_cost

    # --- Misc extra, per door ------------------------------------------------
    # M1's quote matrix carries a free-form "Misc Extra (p/door)" with its own
    # description, for one-offs that are not a catalogue part (a duct lifter,
    # say). It is per door, so it joins unit_sell and is multiplied by qty with
    # everything else. Cost is entered separately -- leaving it blank books the
    # extra at full margin, which is rarely right, so it is worth filling in.
    misc_sell = _num(values.get("NUMMISCEXTRA"))
    misc_cost = _num(values.get("NUMMISCEXTRACOST"))
    misc_desc = str(values.get("TXTMISCEXTRADESC", "") or "").strip()
    if misc_sell or misc_cost:
        lines.append({
            "category": "MISC_EXTRA",
            "partId": "MISC-EXTRA",
            "description": misc_desc or "Misc extra",
            "qty": 1,
            "sell": misc_sell,
            "cost": misc_cost,
        })

    unit_sell = (
        door["sell"] + material_upgrade_sell - disc_sell + inst_sell + misc_sell
    )
    unit_cost = (
        door["cost"] + material_upgrade_cost - disc_cost + inst_cost + misc_cost
    )
    total_sell = unit_sell * qty
    total_cost = unit_cost * qty
    margin_percent = ((unit_sell - unit_cost) / unit_sell * 100) if unit_sell else 0.0

    return {
        "model": model,
        "width": width,
        "height": height,
        "qty": qty,
        "doorPrice": round(door["sell"], 2),
        "doorCost": round(door["cost"], 2),
        "installation": round(inst_sell, 2),
        "installationCost": round(inst_cost, 2),
        # materialUpgrade is assembly + material combined, which is what M1's
        # quote matrix calls two separate figures. Kept under its existing name
        # so nothing reading it changes, with the two halves reported alongside
        # so a summary can show them the way M1 does.
        "materialUpgrade": round(material_upgrade_sell, 2),
        "materialUpgradeCost": round(material_upgrade_cost, 2),
        "assemblyUpgrade": round(assembly_sell, 2),
        "assemblyUpgradeCost": round(assembly_cost, 2),
        "materialOnlyUpgrade": round(material_sell, 2),
        "materialOnlyUpgradeCost": round(material_cost, 2),
        "miscExtra": round(misc_sell, 2),
        "miscExtraCost": round(misc_cost, 2),
        "miscExtraDescription": misc_desc,
        "materialDiscount": round(disc_sell, 2),
        "materialDiscountCost": round(disc_cost, 2),
        "unitSell": round(unit_sell, 2),
        "unitCost": round(unit_cost, 2),
        "totalSell": round(total_sell, 2),
        "totalCost": round(total_cost, 2),
        "marginPercent": round(margin_percent, 1),
        "lines": lines,
        "rulesAvailable": _RULES_OK,
    }
