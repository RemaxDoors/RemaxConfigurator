"""Safe formula evaluation for quantities and computed defaults.

Supports arithmetic, comparisons and IF(), with control names resolving to the
current configuration values:

    IF(CMBSINGLEPAIR = "Pair", 2, 1)
    ceil(NUMDOORHEIGHT / 1000)
    IF(NUMDOORWIDTH > 4000, 2, 1) * NUMTOTALDOORSPROJ

The M1 style `IF(x)="Pair" Then 2` is normalised to `IF(x = "Pair", 2, 0)` so
formulas can be pasted straight from the configurator.

Not eval(): the expression is parsed to an AST and only whitelisted nodes run.
"""
from __future__ import annotations

import ast
import math
import operator as op
import re

_BIN = {
    ast.Add: op.add, ast.Sub: op.sub, ast.Mult: op.mul,
    ast.Div: op.truediv, ast.Mod: op.mod, ast.Pow: op.pow,
}
_CMP = {
    ast.Eq: lambda a, b: _eq(a, b),
    ast.NotEq: lambda a, b: not _eq(a, b),
    ast.Gt: lambda a, b: _num(a) > _num(b),
    ast.GtE: lambda a, b: _num(a) >= _num(b),
    ast.Lt: lambda a, b: _num(a) < _num(b),
    ast.LtE: lambda a, b: _num(a) <= _num(b),
}
def _text(v) -> str:
    """Render a value as text, without a trailing .0 on whole numbers."""
    if isinstance(v, float) and v.is_integer():
        return str(int(v))
    return str(v if v is not None else "")


_FUNCS = {
    "ceil": lambda *a: math.ceil(_num(a[0])),
    "floor": lambda *a: math.floor(_num(a[0])),
    "round": lambda *a: round(_num(a[0]), int(_num(a[1])) if len(a) > 1 else 0),
    "abs": lambda *a: abs(_num(a[0])),
    "min": lambda *a: min(_num(x) for x in a),
    "max": lambda *a: max(_num(x) for x in a),
    # text helpers — LEFT/RIGHT mirror the M1 configurator
    "left": lambda *a: _text(a[0])[: int(_num(a[1]))],
    "right": lambda *a: _text(a[0])[-int(_num(a[1])):] if int(_num(a[1])) else "",
    "mid": lambda *a: _text(a[0])[int(_num(a[1])) - 1: int(_num(a[1])) - 1 + int(_num(a[2]))],
    "len": lambda *a: float(len(_text(a[0]))),
    "upper": lambda *a: _text(a[0]).upper(),
    "lower": lambda *a: _text(a[0]).lower(),
    "startswith": lambda *a: _text(a[0]).strip().lower().startswith(_text(a[1]).strip().lower()),
    "endswith": lambda *a: _text(a[0]).strip().lower().endswith(_text(a[1]).strip().lower()),
    "contains": lambda *a: _text(a[1]).strip().lower() in _text(a[0]).strip().lower(),
    # Charged per metre of opening, to 0.1 m increments (M1: 5523mm -> 5.5).
    #   value / 100 -> round -> / 10
    "metresofopening": lambda *a: round(_num(a[0]) / 100) / 10,
    "metersofopening": lambda *a: round(_num(a[0]) / 100) / 10,
}
# functions whose result is text/boolean rather than a number
_NON_NUMERIC = {"left", "right", "mid", "upper", "lower",
                "startswith", "endswith", "contains"}
TRUTHY = {"1", "true", "yes", "y"}


class Slots(list):
    """A numbered group of controls — CMBACT1..CMBACT4, NUMREMOTEQTY1..4.

    Holds (index, value) pairs ordered by the number in the control name, so a
    second group can be lined up against the first (activation -> its quantity).
    """


def _group(prefix: str, lookup: dict) -> Slots:
    """Collect every control called <prefix><number>, in numeric order."""
    pattern = re.compile(re.escape(prefix.strip().upper()) + r"(\d+)$")
    found = []
    for key, value in lookup.items():
        m = pattern.match(str(key).upper())
        if m:
            found.append((int(m.group(1)), value))
    if found:
        return Slots(sorted(found))
    # Nothing in the configuration yet — still give the caller the usual slots
    # so a formula written against CMBACT1..4 evaluates to 0 rather than error.
    return Slots((i, "") for i in range(1, 5))


def _as_slots(value) -> Slots:
    """Treat a bare control as a one-slot group, so both forms work."""
    return value if isinstance(value, Slots) else Slots([(1, value)])


def _matches(value, needle: str, mode: str) -> bool:
    v = _text(value).strip().lower()
    n = _text(needle).strip().lower()
    if not v:
        return False
    if mode == "equals":
        return v == n
    if mode == "contains":
        return n in v
    if mode == "ends":
        return v.endswith(n)
    return v.startswith(n)


_PREDICATE_MODES = {
    "starts": "starts", "startswith": "starts",
    "has": "contains", "contains": "contains",
    "is": "equals", "equals": "equals",
    "ends": "ends", "endswith": "ends",
}


def _predicate(spec: str):
    """Parse one countWhere predicate, e.g. 'starts:Induction Loop - ' or '!has:Existing'.

    Returns (negate, mode, text). Defaults to 'contains' when no prefix is
    given, so countWhere(group("X"), "Loop") reads the obvious way.
    """
    raw = _text(spec)
    negate = raw.startswith("!")
    if negate:
        raw = raw[1:]
    mode, sep, needle = raw.partition(":")
    key = mode.strip().lower()
    if sep and key in _PREDICATE_MODES:
        return negate, _PREDICATE_MODES[key], needle
    # no recognised prefix — treat the whole thing as a "contains" test, so a
    # value that legitimately contains a colon still works.
    return negate, "contains", raw


def _count_where(slots: Slots, specs: list[str]) -> float:
    """Count slots satisfying EVERY predicate.

    This is the general form; countEquals / countStartsWith / countContains are
    the one-predicate shorthands. Two positive tests on the same slot value is
    what the shorthands cannot express:

        M1: Left(v,17) = "Induction Loop - " AND Instr(v,"Only") > 0
        ->  countWhere(group("CMBACT"), "starts:Induction Loop - ", "has:Only")

    Checking them per slot matters: two separate counts would be satisfied by a
    loop in one slot and "…Only" in a different one.
    """
    parsed = [_predicate(s) for s in specs]
    total = 0
    for _, value in slots:
        if not _text(value).strip():
            continue
        if all(
            (not _matches(value, needle, mode)) if negate
            else _matches(value, needle, mode)
            for negate, mode, needle in parsed
        ):
            total += 1
    return float(total)


def _slot_count(slots: Slots, needle: str, mode: str, exclude: str | None) -> float:
    """How many slots match — optionally skipping ones that also match `exclude`.

    The exclusion is what makes "a Loop, but not an Existing one" expressible:
        countContains(group("CMBACT"), "Loop", "Existing")
    """
    total = 0
    for _, value in slots:
        if not _matches(value, needle, mode):
            continue
        if exclude and _matches(value, exclude, "contains"):
            continue
        total += 1
    return float(total)


def _num(v) -> float:
    if isinstance(v, bool):
        return 1.0 if v else 0.0
    try:
        return float(v or 0)
    except (TypeError, ValueError):
        return 0.0


def _eq(a, b) -> bool:
    """Compare numerically when both look numeric, else case-insensitive text."""
    try:
        return float(a) == float(b)
    except (TypeError, ValueError):
        return str(a or "").strip().lower() == str(b or "").strip().lower()


def _truthy(v) -> bool:
    if isinstance(v, bool):
        return v
    if isinstance(v, (int, float)):
        return v != 0
    return str(v or "").strip().lower() in TRUTHY


# M1 writes `IF(x)="Pair" Then 2` (optionally `Else 1`). Rewrite to IF(x="Pair",2,1).
_M1_IF = re.compile(
    r"""IF\s*\(\s*(?P<lhs>[^)]+?)\s*\)\s*(?P<op><>|!=|>=|<=|=|>|<)\s*(?P<rhs>"[^"]*"|'[^']*'|[\w.\-]+)\s*
        THEN\s+(?P<then>[^;]+?)(?:\s+ELSE\s+(?P<else>[^;]+?))?\s*$""",
    re.I | re.X,
)


def normalise(formula: str) -> str:
    """Accept the M1 IF/Then spelling and a few cosmetic differences."""
    f = (formula or "").strip()
    if not f:
        return f
    m = _M1_IF.match(f)
    if m:
        operator_ = "==" if m.group("op") == "=" else (
            "!=" if m.group("op") == "<>" else m.group("op")
        )
        else_part = (m.group("else") or "0").strip()
        f = (f'IF({m.group("lhs").strip()} {operator_} {m.group("rhs").strip()}, '
             f'{m.group("then").strip()}, {else_part})')
    # Rewrite operators only outside quoted text, so values like "A AND B" survive.
    parts = re.split(r"(\"[^\"]*\"|'[^']*')", f)
    for i, part in enumerate(parts):
        if i % 2:  # a quoted literal — leave alone
            continue
        part = re.sub(r"(?<![=!<>])=(?!=)", "==", part)
        part = part.replace("<>", "!=")
        # M1 writes AND / OR / NOT in caps
        part = re.sub(r"\bAND\b", "and", part)
        part = re.sub(r"\bOR\b", "or", part)
        part = re.sub(r"\bNOT\b", "not", part)
        parts[i] = part
    return "".join(parts)


class FormulaError(ValueError):
    """Raised when a formula cannot be parsed or uses something not allowed."""


def _eval_raw(formula: str, values: dict):
    """Evaluate and return the raw value (number, text or boolean)."""
    expr = normalise(formula)
    if not expr:
        return None
    lookup = {str(k).upper(): v for k, v in (values or {}).items()}

    def ev(node):
        if isinstance(node, ast.Expression):
            return ev(node.body)
        if isinstance(node, ast.Constant):
            if isinstance(node.value, (int, float, str, bool)):
                return node.value
            raise FormulaError("only numbers and text are allowed")
        if isinstance(node, ast.Name):
            key = node.id.upper()
            if key in ("TRUE", "FALSE"):
                return key == "TRUE"
            return lookup.get(key, "")
        if isinstance(node, ast.BinOp) and type(node.op) in _BIN:
            right = ev(node.right)
            if type(node.op) in (ast.Div, ast.Mod) and _num(right) == 0:
                return 0.0
            return _BIN[type(node.op)](_num(ev(node.left)), _num(right))
        if isinstance(node, ast.UnaryOp):
            if isinstance(node.op, ast.USub):
                return -_num(ev(node.operand))
            if isinstance(node.op, ast.UAdd):
                return _num(ev(node.operand))
            if isinstance(node.op, ast.Not):
                return not _truthy(ev(node.operand))
        if isinstance(node, ast.Compare) and len(node.ops) == 1:
            fn = _CMP.get(type(node.ops[0]))
            if not fn:
                raise FormulaError("that comparison is not supported")
            return fn(ev(node.left), ev(node.comparators[0]))
        if isinstance(node, ast.BoolOp):
            parts = [_truthy(ev(v)) for v in node.values]
            return all(parts) if isinstance(node.op, ast.And) else any(parts)
        if isinstance(node, ast.IfExp):  # then if cond else other
            return ev(node.body) if _truthy(ev(node.test)) else ev(node.orelse)
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Name):
            name = node.func.id.lower()
            args = node.args
            if name == "if":
                if len(args) < 2:
                    raise FormulaError("IF needs a condition and a value, e.g. IF(X = \"Pair\", 2, 1)")
                if _truthy(ev(args[0])):
                    return ev(args[1])
                return ev(args[2]) if len(args) > 2 else 0.0
            if name in ("group", "slots"):
                if not args:
                    raise FormulaError('group needs a control prefix, e.g. group("CMBACT")')
                return _group(_text(ev(args[0])), lookup)
            if name == "countwhere":
                # countWhere(group("CMBACT"), "starts:Induction Loop - ", "has:Only")
                if len(args) < 2:
                    raise FormulaError(
                        'countWhere needs a group and at least one test, e.g. '
                        'countWhere(group("CMBACT"), "starts:Induction Loop - ")'
                    )
                return _count_where(
                    _as_slots(ev(args[0])), [_text(ev(a)) for a in args[1:]]
                )
            if name in ("countequals", "countstartswith", "countcontains"):
                if len(args) < 2:
                    raise FormulaError(f"{name} needs controls and a value")
                mode = {"countequals": "equals", "countstartswith": "starts"}.get(
                    name, "contains"
                )
                first = ev(args[0])
                if isinstance(first, Slots):
                    # group form: countStartsWith(group("CMBACT"), "Induction Loop - ")
                    exclude = _text(ev(args[2])) if len(args) > 2 else None
                    return _slot_count(first, _text(ev(args[1])), mode, exclude)
                # listed form: countEquals(CMBACT1, CMBACT2, CMBACT3, "Pull Cord")
                listed = Slots((i, ev(a)) for i, a in enumerate(args[:-1], start=1))
                return _slot_count(listed, _text(ev(args[-1])), mode, None)
            if name == "sumwhere":
                # sumWhere(group("CMBACT"), "Elsema Remote - 2", group("NUMREMOTEQTY"))
                # Adds up the second group wherever the first one matches, pairing
                # the two by slot number.
                if len(args) < 3:
                    raise FormulaError(
                        'sumWhere needs a group to match, a value, and a group to add up'
                    )
                match_slots = _as_slots(ev(args[0]))
                needle = _text(ev(args[1]))
                value_slots = _as_slots(ev(args[2]))
                mode = _text(ev(args[3])).lower() if len(args) > 3 else "starts"
                by_index = dict(value_slots)
                total = 0.0
                for index, value in match_slots:
                    if _matches(value, needle, mode):
                        total += _num(by_index.get(index, 0))
                return total
            fn = _FUNCS.get(name)
            if not fn:
                raise FormulaError(f"function '{node.func.id}' is not allowed")
            out = fn(*[ev(a) for a in args])
            # text/boolean helpers pass through; numeric ones are coerced
            return out if name in _NON_NUMERIC else float(out)
        raise FormulaError("that expression is not supported")

    try:
        tree = ast.parse(expr, mode="eval")
    except SyntaxError as exc:
        raise FormulaError(f"could not parse the formula: {exc.msg}") from exc
    return ev(tree)


def evaluate(formula: str, values: dict) -> float:
    """Evaluate a formula that yields a number (quantities, computed defaults)."""
    return _num(_eval_raw(formula, values))


def evaluate_text(formula: str, values: dict) -> str:
    """Evaluate a formula that yields text (e.g. a conditional part revision)."""
    return _text(_eval_raw(formula, values)).strip()


def check(formula: str, values: dict | None = None) -> dict:
    """Validate a formula and show what it evaluates to (for the editor)."""
    try:
        result = evaluate(formula, values or {})
        return {"ok": True, "result": result, "normalised": normalise(formula)}
    except FormulaError as exc:
        return {"ok": False, "error": str(exc), "normalised": normalise(formula)}
    except Exception as exc:  # pragma: no cover
        return {"ok": False, "error": str(exc), "normalised": normalise(formula)}


if __name__ == "__main__":
    # Parity checks against the M1 configurator's cmbAct1..4 loops.
    ACTS = {
        "CMBACT1": "Induction Loop - Single", "NUMREMOTEQTY1": 0,
        "CMBACT2": "Elsema Remote - 2 Button", "NUMREMOTEQTY2": 4,
        "CMBACT3": "Existing Induction Loop", "NUMREMOTEQTY3": 0,
        "CMBACT4": "", "NUMREMOTEQTY4": 0,
    }
    TRAP = {
        "CMBACT1": "Elsema Receiver Card Only",
        "CMBACT2": "Induction Loop - Door Side Only",
        "CMBACT3": "", "CMBACT4": "",
    }
    BOTH_SIDES = {
        "CMBACT1": "Elsema Receiver Card Only",
        "CMBACT2": "Induction Loop - Both Sides",
        "CMBACT3": "", "CMBACT4": "",
    }
    cases = [
        # '@@@@ if floor loops selected, keep. cmbAct1234.
        ('countStartsWith(group("CMBACT"), "Induction Loop - ")', ACTS, 1),
        # Instr(v,"Loop")>0 and Instr(v,"Existing")=0 — the RSS exclusion
        ('countContains(group("CMBACT"), "Loop", "Existing")', ACTS, 1),
        ('countContains(group("CMBACT"), "Loop")', ACTS, 2),
        # nQtyPerAss = sum of the quantity beside each matching activation
        ('sumWhere(group("CMBACT"), "Elsema Remote - 2", group("NUMREMOTEQTY"))', ACTS, 4),
        ('sumWhere(group("CMBACT"), "Elsema Remote", group("NUMREMOTEQTY"), "equals")', ACTS, 0),
        # the listed form still works
        ('countEquals(CMBACT1, CMBACT2, "Induction Loop - Single")', ACTS, 1),
        # a group that isn't in the configuration counts as zero, not an error
        ('countStartsWith(group("CMBNOPE"), "x")', ACTS, 0),
        # countWhere: two positive tests on the SAME slot value, which the
        # shorthands cannot express. "Elsema Receiver Card Only" must not count
        # towards the single-side floor-loop discount.
        ('countWhere(group("CMBACT"), "starts:Induction Loop - ", "has:Only")', TRAP, 1),
        ('countWhere(group("CMBACT"), "starts:Induction Loop - ", "has:Only")', BOTH_SIDES, 0),
        # and it reproduces each shorthand
        ('countWhere(group("CMBACT"), "has:Loop", "!has:Existing")', ACTS, 1),
        ('countWhere(group("CMBACT"), "is:Elsema Remote - 2 Button")', ACTS, 1),
    ]
    failures = 0
    for expr, values, expected in cases:
        got = evaluate(expr, values)
        ok = abs(got - expected) < 1e-9
        failures += 0 if ok else 1
        print(f"{'ok  ' if ok else 'FAIL'} {expr} = {got:g} (expected {expected})")
    print("failures:", failures)
    raise SystemExit(1 if failures else 0)
