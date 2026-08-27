from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from .. import config_repo, curtain_pricing, m1_pricing, rules_pricing, settings

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


class OverrideIn(BaseModel):
    """A negotiated unit price for one part on one quote line.

    Keyed by part id rather than by parameter, because the override is a price
    for a PART: one parameter can trigger several parts, and a parameter can be
    renamed while a part id is M1's own identity and does not move.

    listUnitPrice is carried so the line can still say what was given away, and
    so a list price that moves after the discount was agreed is detectable
    rather than silently absorbed.
    """
    unitPrice: float
    listUnitPrice: float | None = None
    parameter: str | None = None
    label: str | None = None


class PriceIn(BaseModel):
    configuratorId: str | None = None
    values: dict
    # Deliberately NOT inside `values`. That dictionary is configurator state
    # and maps to FormInputValues; mixing pricing into it would mean everything
    # reading configurator values has to learn to skip rows that are not
    # configurator values.
    overrides: dict[str, OverrideIn] | None = None


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
    values = body.values or {}
    try:
        result = m1_pricing.price_configuration(values)
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=502, detail=f"Pricing failed: {exc}")

    # Upgrades come from uCfgRules, not from pricing_rules/*.py.
    #
    # The hardcoded module only ever covered Movidor, so every other
    # configurator priced no upgrades at all through it. Reading the rules
    # means one mechanism for all of them, and an edit in the admin screen
    # changing the price on the next recalculation rather than at the next
    # deploy.
    #
    # If the config DB cannot be reached the legacy figures are left in place
    # and `pricingSource` says so -- a quote priced from stale logic that
    # admits it beats a quote silently priced at zero.
    if body.configuratorId:
        try:
            rules = config_repo.load_rules(body.configuratorId)
            result = _apply_rules_pricing(result, rules, values, body.overrides)
        except Exception as exc:  # pragma: no cover - pricing must still return
            result["pricingSource"] = "legacy"
            result["pricingSourceReason"] = f"rules unavailable: {exc}"
            result["upgradeAttribution"] = None
    else:
        result["pricingSource"] = "legacy"
        result["pricingSourceReason"] = "no configuratorId supplied"
    return result


def _apply_rules_pricing(
    result: dict, rules: list[dict], values: dict,
    overrides: dict[str, OverrideIn] | None = None,
) -> dict:
    """Replace the hardcoded upgrade figures with the rules-driven ones."""
    # Upper-cased on the way in so a part id typed in either case still
    # matches the rule's ResultPartID.
    unit_prices = {
        str(k).strip().upper(): float(v.unitPrice)
        for k, v in (overrides or {}).items()
    }
    priced = rules_pricing.evaluate(
        rules, values, m1_pricing.part_price, unit_prices)
    result["priceOverrides"] = {
        k: v.model_dump() for k, v in (overrides or {}).items()
    }

    # Kept for comparison while the rules are being completed, so the gap
    # between the two is visible instead of being discovered on a quote.
    result["legacyUpgrades"] = {
        "assemblyUpgrade": result.get("assemblyUpgrade"),
        "materialOnlyUpgrade": result.get("materialOnlyUpgrade"),
        "materialDiscount": result.get("materialDiscount"),
    }
    result["rulesVsLegacy"] = rules_pricing.compare_with_legacy(priced, result)

    for key in ("assemblyUpgrade", "assemblyUpgradeCost",
                "materialOnlyUpgrade", "materialOnlyUpgradeCost",
                "materialDiscount", "materialDiscountCost"):
        result[key] = priced[key]

    # Installation still comes from the legacy builder unless the rules carry
    # INSTALLATION rules of their own. Zeroing a real installation charge
    # because nobody has written those rules yet would be a silent undercharge.
    install_from_rules = any(
        line["category"] == rules_pricing.INSTALLATION for line in priced["lines"]
    )
    if install_from_rules:
        result["installation"] = priced["installation"]
        result["installationCost"] = priced["installationCost"]

    result["materialUpgrade"] = round(
        result["assemblyUpgrade"] + result["materialOnlyUpgrade"], 2)
    result["materialUpgradeCost"] = round(
        result["assemblyUpgradeCost"] + result["materialOnlyUpgradeCost"], 2)

    # The totals are derived, so they have to be rebuilt from the new figures
    # rather than left carrying the hardcoded module's arithmetic.
    qty = int(result.get("qty") or 1)
    unit_sell = (result["doorPrice"] + result["materialUpgrade"]
                 - result["materialDiscount"] + result["installation"]
                 + result.get("miscExtra", 0.0))
    unit_cost = (result["doorCost"] + result["materialUpgradeCost"]
                 - result["materialDiscountCost"] + result["installationCost"]
                 + result.get("miscExtraCost", 0.0))
    # Reseller discount, off the whole unit sell.
    #
    # It was previously stored on the quote line, shown on screen and written
    # to uqmqResellerDiscount -- but never actually taken off anything, so a
    # 22% reseller was quoted the full price. It applies to sell only; cost is
    # what the door costs regardless of who is buying it, and the margin below
    # is recomputed from the discounted figure so it tells the truth.
    reseller_pct = m1_pricing._num(values.get("NUMRESELLERDISCOUNT"))
    reseller_pct = min(max(reseller_pct, 0.0), 100.0)
    list_unit_sell = unit_sell
    if reseller_pct:
        unit_sell = unit_sell * (1 - reseller_pct / 100.0)

    result["resellerDiscountPercent"] = round(reseller_pct, 2)
    result["listUnitSell"] = round(list_unit_sell, 2)
    result["resellerDiscountAmount"] = round(list_unit_sell - unit_sell, 2)
    result["unitSell"] = round(unit_sell, 2)
    result["unitCost"] = round(unit_cost, 2)
    result["totalSell"] = round(unit_sell * qty, 2)
    result["totalCost"] = round(unit_cost * qty, 2)
    result["marginPercent"] = round(
        ((unit_sell - unit_cost) / unit_sell * 100) if unit_sell else 0.0, 2)

    # Replace the upgrade lines; the door, installation and misc lines the
    # legacy path produced are still the ones being charged for.
    kept = [l for l in (result.get("lines") or [])
            if l.get("category") not in
            {rules_pricing.ASSEMBLY, rules_pricing.MATERIAL, rules_pricing.DISCOUNT}]
    if install_from_rules:
        kept = [l for l in kept if l.get("category") != rules_pricing.INSTALLATION]
    result["lines"] = kept + priced["lines"]

    result["pricingSource"] = "rules"
    result["rulesEvaluated"] = len(rules)
    result["rulesSkipped"] = priced["skipped"]
    result["upgradeAttribution"] = {
        "byControl": priced["byControl"],
        # Nothing is unattributed any more: every charge comes from a rule, and
        # a rule always names the controls that fired it.
        "unattributed": [],
        "unattributedTotal": 0.0,
        "attributedTotal": round(
            sum(s["amount"] for s in priced["byControl"].values()), 2),
    }
    return result


class FormulaIn(BaseModel):
    formula: str
    values: dict = {}


@router.post("/formula/check")
def formula_check(body: FormulaIn):
    """Validate a quantity/default formula and show what it evaluates to."""
    from .. import formula as formula_mod

    return formula_mod.check(body.formula, body.values or {})
