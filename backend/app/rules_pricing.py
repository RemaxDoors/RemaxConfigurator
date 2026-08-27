"""Upgrades priced from uCfgRules, not from hardcoded Python.

WHY THIS REPLACES pricing_rules/*.py AS THE SOURCE OF TRUTH

pricing_rules/movidor_upgrade_rules.py is forty-odd hardcoded `if` blocks that
only ever knew about Movidor. Swing, entrance, strip and curtain have no
equivalent and were never going to get one, so anything built on it works for
one configurator and silently produces nothing for the rest. It also cannot
answer "which selection caused this charge", because by the time a price exists
the control that triggered it is gone.

uCfgRules already holds the same knowledge as data: conditions naming the
controls, a ResultPartID, and a quantity or quantity formula. Reading it means
one mechanism for every configurator, an edit in the admin screen changing the
price immediately, and a charge that can be traced back to the control that
caused it.

The hardcoded module is NOT deleted. It stays as a cross-check -- see
compare_with_legacy() -- so the two can be run side by side on real
configurations until the rules are trusted. Nothing here imports it.

M1 remains the price source. Rules decide WHICH parts and HOW MANY; M1 says
what each part costs. That division is the point: prices belong in the ERP.
"""

from collections import defaultdict

from . import formula, validation_engine

# Categories as they appear on uCfgRules.Category. Anything else is ignored
# rather than guessed at -- a rule with an unrecognised category producing a
# silent charge is exactly the failure this replaces.
ASSEMBLY = "ASSEMBLY_UPGRADE"
MATERIAL = "MATERIAL_UPGRADE"
DISCOUNT = "MATERIAL_DISCOUNT"
INSTALLATION = "INSTALLATION"

_CATEGORY_ALIASES = {
    "ASSEMBLY": ASSEMBLY,
    "ASSEMBLY_UPGRADE": ASSEMBLY,
    "ASSEMBLYUPGRADE": ASSEMBLY,
    "MATERIAL": MATERIAL,
    "MATERIAL_UPGRADE": MATERIAL,
    "MATERIALUPGRADE": MATERIAL,
    "DISCOUNT": DISCOUNT,
    "MATERIAL_DISCOUNT": DISCOUNT,
    "MATERIALDISCOUNT": DISCOUNT,
    "INSTALL": INSTALLATION,
    "INSTALLATION": INSTALLATION,
}

# A discount makes the door cheaper, so it is carried as a negative amount and
# the caller never has to remember to subtract it.
NEGATIVE = {DISCOUNT}

# CMBDOORMODEL gates nearly every rule. Attributing to it would paint the model
# dropdown with the entire upgrade total and tell the salesperson nothing.
NOT_A_TRIGGER = {"CMBDOORMODEL"}


def normalise_category(raw) -> str | None:
    key = str(raw or "").strip().upper().replace(" ", "_")
    return _CATEGORY_ALIASES.get(key)


def resolve_quantity(rule: dict, values: dict) -> float:
    """How many of the result part this rule adds.

    A formula wins over the fixed quantity, because a rule that has one is
    counting something -- remotes, activation devices -- and the fixed value is
    only its fallback. A formula that will not evaluate yields 0 rather than 1:
    guessing "one of them" would put a part on a quote that nobody chose.
    """
    expr = (rule.get("quantityFormula") or "").strip()
    if expr:
        try:
            return float(formula.evaluate(expr, values))
        except formula.FormulaError:
            return 0.0
    try:
        return float(str(rule.get("quantity") or "1").strip() or 1)
    except ValueError:
        return 0.0


def resolve_revision(rule: dict, values: dict):
    """The result part's revision, which may itself be a formula."""
    expr = (rule.get("resultRevisionFormula") or "").strip()
    if expr:
        try:
            out = formula.evaluate(expr, values)
            return str(out).strip() or None
        except formula.FormulaError:
            return rule.get("resultRevision")
    return rule.get("resultRevision")


def triggering_controls(rule: dict) -> list[str]:
    """The controls a salesperson would say caused this charge."""
    out: list[str] = []
    for cond in rule.get("conditions") or []:
        control = (cond.get("controlName") or "").strip().upper()
        if control and control not in NOT_A_TRIGGER and control not in out:
            out.append(control)
    return out


def evaluate(rules: list[dict], values: dict, price_part, overrides: dict | None = None) -> dict:
    """Price every rule that fires.

    `price_part(part_id, revision) -> {"sell": float, "cost": float,
    "description": str}` is injected rather than imported so this can be tested
    without a database, and so the M1 lookup stays in one place.

    Returns totals, the priced lines, and the per-control attribution the
    configurator screen uses to highlight what drove the cost.
    """
    lines: list[dict] = []
    totals = defaultdict(float)
    costs = defaultdict(float)
    by_control: dict[str, dict] = {}
    skipped: list[dict] = []

    for rule in rules:
        if not rule.get("isActive", True):
            continue
        part_id = (rule.get("resultPartId") or "").strip()
        if not part_id:
            continue

        category = normalise_category(rule.get("category"))
        if category is None:
            skipped.append({"rule": rule.get("id"),
                            "reason": f"unrecognised category {rule.get('category')!r}"})
            continue

        try:
            if not validation_engine.rule_matches(rule, values):
                continue
        except Exception:  # pragma: no cover - one bad rule must not stop pricing
            skipped.append({"rule": rule.get("id"), "reason": "condition raised"})
            continue

        qty = resolve_quantity(rule, values)
        if qty <= 0:
            continue

        priced = price_part(part_id, resolve_revision(rule, values))
        list_unit = float(priced.get("sell") or 0.0)

        # A negotiated price for this part on this quote. It replaces the UNIT
        # price, not the line total, so changing the quantity still behaves --
        # overriding the total and then adding a second unit would silently
        # halve the agreed price.
        #
        # 0 is a real override (the part is being thrown in), so presence is
        # what counts, not truthiness.
        unit = list_unit
        overridden = False
        if overrides and part_id.upper() in overrides:
            unit = overrides[part_id.upper()]
            overridden = True

        sell = unit * qty
        cost = float(priced.get("cost") or 0.0) * qty
        signed = -sell if category in NEGATIVE else sell

        line = {
            "category": category,
            "ruleId": rule.get("id"),
            "ruleName": rule.get("name"),
            "partId": part_id,
            "description": priced.get("description") or rule.get("name") or part_id,
            "qty": qty,
            "unitSell": round(unit, 2),
            # Kept even when overridden, so the screen can show what was given
            # away rather than just the agreed figure.
            "listUnitSell": round(list_unit, 2),
            "overridden": overridden,
            "sell": sell,
            "cost": cost,
            "amount": round(signed, 2),
        }
        lines.append(line)
        totals[category] += sell
        costs[category] += cost

        # Each triggering control shows the WHOLE charge it is responsible for.
        # Splitting it between two controls would answer a question nobody
        # asked -- "this selection costs $412" is the question, and $206 is not
        # an answer to it. So these figures must never be summed as a total.
        for control in triggering_controls(rule):
            slot = by_control.setdefault(control, {"amount": 0.0, "parts": []})
            slot["amount"] = round(slot["amount"] + signed, 2)
            slot["parts"].append(line)

    return {
        "assemblyUpgrade": round(totals[ASSEMBLY], 2),
        "assemblyUpgradeCost": round(costs[ASSEMBLY], 2),
        "materialOnlyUpgrade": round(totals[MATERIAL], 2),
        "materialOnlyUpgradeCost": round(costs[MATERIAL], 2),
        "materialDiscount": round(totals[DISCOUNT], 2),
        "materialDiscountCost": round(costs[DISCOUNT], 2),
        "installation": round(totals[INSTALLATION], 2),
        "installationCost": round(costs[INSTALLATION], 2),
        "lines": lines,
        "byControl": by_control,
        # A rule that could not be evaluated is reported, not swallowed.
        "skipped": skipped,
    }


def compare_with_legacy(rules_result: dict, legacy: dict) -> dict:
    """Where the rules and the old hardcoded module disagree.

    For running both over real configurations while the rules are being
    completed. It reports rather than decides -- the rules are what price the
    quote, and this exists so the gaps are visible before anyone trusts them.
    """
    out = {}
    for key in ("assemblyUpgrade", "materialOnlyUpgrade", "materialDiscount"):
        a = round(float(rules_result.get(key) or 0), 2)
        b = round(float(legacy.get(key) or 0), 2)
        if a != b:
            out[key] = {"rules": a, "legacy": b, "difference": round(a - b, 2)}
    return out
