"""Run every configuration migration, in dependency order.

    python db/migrate_all.py

Order matters:
  1. streamlit -> DB        curtain params/options/defaults + validations
  2. configurator links     parent -> child, installation defaults per parent
  3. conditional defaults   conditions + formulas (removes superseded statics)
  4. rules CSV import       movidor (RRD) + installation rule sets

Every step is idempotent, so this can be re-run safely.
"""
from __future__ import annotations

import os
import runpy
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB = os.path.join(ROOT, "db")

STEPS = [
    ("Curtain + validations", "migrate_streamlit_to_db.py"),
    ("Configurator links + installation defaults", "migrate_configurator_links.py"),
    ("Conditional / computed defaults", "migrate_conditional_defaults.py"),
]

RULE_IMPORTS = [
    ("RRD-MOVIDOR-TEMPLATE", "import_samples/rrd_movidor_rules.csv"),
    ("INSTALLATION-TEMPLATE", "import_samples/installation_rules.csv"),
]


def main() -> None:
    for title, script in STEPS:
        print(f"\n=== {title} ===")
        path = os.path.join(DB, script)
        if not os.path.exists(path):
            print(f"  ! missing {script}")
            continue
        sys.argv = [path]
        runpy.run_path(path, run_name="__main__")

    print("\n=== Rules import ===")
    for configurator_id, rel in RULE_IMPORTS:
        csv_path = os.path.join(DB, rel)
        if not os.path.exists(csv_path):
            print(f"  ! missing {rel} — skipped {configurator_id}")
            continue
        subprocess.run(
            [sys.executable, os.path.join(DB, "import_rules_csv.py"), configurator_id, csv_path],
            check=False,
        )

    print("\n=== Final state ===")
    sys.path.insert(0, os.path.join(ROOT, "api"))
    from app import config_repo
    from sqlalchemy import text

    with config_repo.get_config_engine().connect() as conn:
        rows = conn.execute(text("""
            SELECT g.PartID,
              (SELECT COUNT(*) FROM dbo.uCfgParameters WHERE CfgID=g.CfgID),
              (SELECT COUNT(*) FROM dbo.uCfgDefaults WHERE CfgID=g.CfgID),
              (SELECT COUNT(*) FROM dbo.uCfgRules WHERE CfgID=g.CfgID),
              (SELECT COUNT(*) FROM dbo.uCfgValidationRules WHERE CfgID=g.CfgID)
            FROM dbo.uCfgConfigurators g ORDER BY g.PartID""")).fetchall()
        print(f"  {'configurator':<24}{'params':>7}{'defaults':>10}{'rules':>7}{'valid':>7}")
        for r in rows:
            print(f"  {r[0]:<24}{r[1]:>7}{r[2]:>10}{r[3]:>7}{r[4]:>7}")
        conds = conn.execute(text("SELECT COUNT(*) FROM dbo.uCfgDefaultConditions")).scalar()
        links = conn.execute(text("SELECT COUNT(*) FROM dbo.uCfgConfiguratorLinks")).scalar()
        rconds = conn.execute(text("SELECT COUNT(*) FROM dbo.uCfgRuleConditions")).scalar()
        print(f"\n  default conditions: {conds} | rule conditions: {rconds} | links: {links}")


if __name__ == "__main__":
    main()
