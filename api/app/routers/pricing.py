from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from .. import curtain_pricing, m1_pricing, settings

router = APIRouter(tags=["pricing"])


@router.get("/parts")
def parts(search: str = Query(default="")):
    """Search M1 parts (Parts / PartRevisions) by id or description, with prices."""
    if not settings.db_configured():
        raise HTTPException(status_code=503, detail="M1 database not configured.")
    try:
        return {"parts": m1_pricing.search_parts(search)}
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=502, detail=f"Part search failed: {exc}")


class PriceIn(BaseModel):
    configuratorId: str | None = None
    values: dict


class PartRef(BaseModel):
    partId: str
    revision: str | None = None


class PartPricesIn(BaseModel):
    parts: list[PartRef]


@router.post("/parts/prices")
def part_prices(body: PartPricesIn):
    """Batch price lookup — used by the admin to show each rule's price impact."""
    if not settings.db_configured():
        raise HTTPException(status_code=503, detail="M1 database not configured.")
    out = {}
    for p in body.parts[:200]:
        try:
            pr = m1_pricing.part_price(p.partId, p.revision)
        except Exception:  # pragma: no cover - keep partial results usable
            pr = {"sell": 0.0, "cost": 0.0, "description": ""}
        # keyed by partId|revision so the same part under different revisions
        # (e.g. the hyperlift discount SML/MED/LGE) does not collide
        out[f"{p.partId}|{p.revision or ''}"] = pr
    return {"prices": out}


@router.post("/price/curtain")
def price_curtain(body: PriceIn):
    """Curtain price + finished dimensions (M1 uCurtainPrices / uRapidFormulas)."""
    if not settings.db_configured():
        raise HTTPException(status_code=503, detail="M1 database not configured.")
    try:
        values = body.values or {}
        result = curtain_pricing.price_curtain(values)
        result["upgrades"] = curtain_pricing.curtain_upgrades(values)
        return result
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=502, detail=f"Curtain pricing failed: {exc}")


@router.post("/price")
def price(body: PriceIn):
    """Priced breakdown for a door configuration, from the M1 database."""
    if not settings.db_configured():
        raise HTTPException(status_code=503, detail="M1 database not configured.")
    try:
        return m1_pricing.price_configuration(body.values or {})
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=502, detail=f"Pricing failed: {exc}")


class FormulaIn(BaseModel):
    formula: str
    values: dict = {}


@router.post("/formula/check")
def formula_check(body: FormulaIn):
    """Validate a quantity/default formula and show what it evaluates to."""
    from .. import formula as formula_mod

    return formula_mod.check(body.formula, body.values or {})
