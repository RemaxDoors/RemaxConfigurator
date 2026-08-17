"""Compare the pricing rules against a recorded baseline.

Run after touching anything in app/pricing_rules — it is a lift-and-shift of
the rules the business has been quoting from, so any output change is a bug
until proven otherwise.

    python api/tests/check_pricing_parity.py --record   # write the baseline
    python api/tests/check_pricing_parity.py            # compare against it

The same harness is what will retire app/pricing_rules: point it at the
DB-driven engine and it shows exactly which configurations disagree.
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from parity_cases import INSTALL_CASES, PART_PRICES, UPGRADE_CASES  # noqa: E402

from app.pricing_rules import build_installation_lines, build_upgrade_columns  # noqa: E402

BASELINE = os.path.join(os.path.dirname(__file__), "pricing_baseline.json")


def snapshot() -> dict:
    out = {"upgrades": {}, "install": {}}
    for name, values in UPGRADE_CASES:
        out["upgrades"][name] = build_upgrade_columns(values, PART_PRICES)
    for name, values in INSTALL_CASES:
        out["install"][name] = build_installation_lines(values)
    # Round-trip through JSON so comparisons are structural, not object identity.
    return json.loads(json.dumps(out, sort_keys=True, default=str))


def main() -> int:
    current = snapshot()
    if "--record" in sys.argv:
        with open(BASELINE, "w", encoding="utf-8") as fh:
            json.dump(current, fh, indent=1, sort_keys=True)
        rows = sum(len(v) for k in current for v in current[k].values())
        print(f"baseline written: {BASELINE} ({rows} rows)")
        return 0

    if not os.path.isfile(BASELINE):
        print("No baseline. Run with --record first.")
        return 1
    with open(BASELINE, encoding="utf-8") as fh:
        expected = json.load(fh)

    failures = 0
    for kind in ("upgrades", "install"):
        for name in sorted(expected[kind]):
            want, got = expected[kind][name], current[kind].get(name)
            ok = want == got
            failures += 0 if ok else 1
            print(f"  {'ok  ' if ok else 'FAIL'} {kind:<9} {name}")
            if not ok:
                print(f"       expected {json.dumps(want)[:300]}")
                print(f"       got      {json.dumps(got)[:300]}")
    new = set(current["upgrades"]) - set(expected["upgrades"])
    if new:
        print(f"  note: {len(new)} case(s) not in the baseline: {sorted(new)}")
    print(f"\nfailures: {failures}")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
