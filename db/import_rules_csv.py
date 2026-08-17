"""Import a rules CSV into uCfgRules (+ conditions).

Parses the same format the admin Import CSV uses, so the file is the single
source of truth for both paths.

    python db/import_rules_csv.py RRD-MOVIDOR-TEMPLATE db/import_samples/rrd_movidor_rules.csv
"""
from __future__ import annotations

import csv
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "api"))

from app import config_repo, config_write  # noqa: E402

VALID_CATEGORIES = {
    "BASE", "ASSEMBLY_UPGRADE", "MATERIAL_UPGRADE", "MATERIAL_DISCOUNT", "INSTALLATION",
}
TRUTHY = {"yes", "y", "true", "1", "active"}


def parse_condition(token: str) -> dict | None:
    """Mirror of parseCondition() in web/src/lib/rule-csv.ts."""
    t = token.strip()
    if not t:
        return None
    m = re.match(r"^(.*?)\s+is\s+not\s+checked$", t, re.I)
    if m:
        return {"controlName": m.group(1).strip(), "operator": "not_checked", "value": ""}
    m = re.match(r"^(.*?)\s+is\s+checked$", t, re.I)
    if m:
        return {"controlName": m.group(1).strip(), "operator": "is_checked", "value": ""}
    word_ops = [
        (r"\s+not\s+contains\s+", "not_contains"),
        (r"\s+contains\s+", "contains"),
        (r"\s+starts\s+with\s+", "starts_with"),
        (r"\s+not\s+in(?:\s+list)?\s+", "not_in"),
        (r"\s+in(?:\s+list)?\s+", "in"),
    ]
    for pattern, op in word_ops:
        parts = re.split(pattern, t, flags=re.I)
        if len(parts) == 2:
            return {"controlName": parts[0].strip(), "operator": op, "value": parts[1].strip()}
    for sym, op in [("≠", "not_equals"), ("!=", "not_equals"),
                    (">", "greater_than"), ("<", "less_than"), ("=", "equals")]:
        i = t.find(sym)
        if i > 0:
            return {"controlName": t[:i].strip(), "operator": op,
                    "value": t[i + len(sym):].strip()}
    return None


def parse_when(text_value: str) -> tuple[list[dict], list[str]]:
    """Groups split on OR, conditions within a group on AND."""
    s = (text_value or "").strip()
    if not s:
        return [], []
    out, bad = [], []
    for group_index, raw_group in enumerate(re.split(r"\s+OR\s+", s, flags=re.I), start=1):
        group = raw_group.strip()
        if group.startswith("(") and group.endswith(")"):
            group = group[1:-1].strip()
        for token in re.split(r"\s+AND\s+", group, flags=re.I):
            cond = parse_condition(token)
            if cond is None:
                bad.append(token.strip())
            else:
                out.append({**cond, "groupNo": group_index})
    return out, bad


def main() -> None:
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)
    configurator_id, path = sys.argv[1], sys.argv[2]

    rules, errors = [], []
    seen: set[str] = set()
    with open(path, newline="", encoding="utf-8-sig") as f:
        for line_no, row in enumerate(csv.DictReader(f), start=2):
            rid = (row.get("Rule ID") or "").strip()
            name = (row.get("Name") or "").strip()
            part = (row.get("Result Part") or "").strip()
            category = (row.get("Category") or "").strip().upper()
            qty = (row.get("Quantity") or "1").strip()

            if not rid:
                errors.append(f"row {line_no}: no rule id")
                continue
            if rid.upper() in seen:
                errors.append(f"row {line_no}: duplicate rule id {rid}")
                continue
            if category not in VALID_CATEGORIES:
                errors.append(f"row {line_no} ({rid}): bad category {category!r}")
                continue
            if not qty.replace(".", "", 1).isdigit():
                errors.append(f"row {line_no} ({rid}): quantity {qty!r} is not numeric")
                continue

            conditions, bad = parse_when(row.get("When", ""))
            for token in bad:
                errors.append(f"row {line_no} ({rid}): unparseable condition {token!r}")

            seen.add(rid.upper())
            active = (row.get("Active") or "Yes").strip().lower()
            rules.append({
                "id": rid,
                "configuratorId": configurator_id,
                "name": name or rid,
                "category": category,
                "resultPartId": part,
                "resultRevision": (row.get("Revision") or "").strip() or None,
                "quantity": qty,
                "quantityUnit": (row.get("Unit") or "").strip() or None,
                "quantityFormula": (row.get("Formula") or "").strip() or None,
                "notes": (row.get("Notes") or "").strip() or None,
                "isActive": active in TRUTHY,
                "conditions": conditions,
            })

    result = config_write.replace_rules(configurator_id, rules, "csv-import")
    print(f"  {configurator_id}")
    print(f"    parsed   : {len(rules)} rules from {os.path.basename(path)}")
    print(f"    inserted : {result['inserted']}  (replaced {result['deleted']})")
    if result.get("skipped"):
        print(f"    skipped  : {len(result['skipped'])}")
        for s in result["skipped"]:
            print(f"       - {s['id']}: {s['reason']}")
    if errors:
        print(f"    csv errors: {len(errors)}")
        for e in errors[:10]:
            print(f"       - {e}")

    saved = config_repo.load_rules(configurator_id)
    with_conds = sum(1 for r in saved if r["conditions"])
    print(f"    verified : {len(saved)} in DB, {with_conds} with conditions")


if __name__ == "__main__":
    main()
