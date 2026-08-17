"""Model the configurator relationships and re-extract installation defaults
per parent configurator.

From ui/configurator_section.py:
  - curtain runs for RRD (rapid) only
  - installation runs for every door type, adapting via CMBCONFIGID = parent id

Run from the repo root:  python db/migrate_configurator_links.py
Re-runnable.
"""
from __future__ import annotations

import os
import sys
import types

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "src"))
sys.path.insert(0, os.path.join(ROOT, "api"))
if "streamlit" not in sys.modules:
    _st = types.ModuleType("streamlit")
    _st.session_state = {}
    sys.modules["streamlit"] = _st

from sqlalchemy import text  # noqa: E402

from app import config_repo  # noqa: E402
from services.installation_config import installation_defaults as idef  # noqa: E402

CURTAIN = "CURTAIN-TEMPLATE"
INSTALL = "INSTALLATION-TEMPLATE"

# Door configurators, and the models each one covers (configurator_section.py)
DOOR_CONFIGS = {
    "RRD-MOVIDOR-TEMPLATE": ["ES40", "EX35", "EX45", "HS25", "HS35", "HS35-THERMIC",
                             "HS50", "HS50-THERMIC", "HS65", "MOVICHILL",
                             "MOVICHILL-XL", "MOVIFOLD", "CONCERTINA"],
    "SWI-PVC-TEMPLATE":     ["2400", "3000"],
    "SWI-THERMAL-TEMPLATE": ["4500", "5000"],
    "RMX-ENTURI-TEMPLATE":  ["ENTURI"],
    "STRIPDOOR-TEMPLATE":   ["STRIPDOOR"],
}

LINKS = [
    # parent, child, type, automatic, note
    ("RRD-MOVIDOR-TEMPLATE", CURTAIN, "curtain", 1,
     "Rapid doors only — curtain is priced from uCurtainPrices."),
    ("RRD-MOVIDOR-TEMPLATE", INSTALL, "installation", 1, None),
    ("SWI-PVC-TEMPLATE",     INSTALL, "installation", 1, None),
    ("SWI-THERMAL-TEMPLATE", INSTALL, "installation", 1, None),
    ("RMX-ENTURI-TEMPLATE",  INSTALL, "installation", 1, None),
    ("STRIPDOOR-TEMPLATE",   INSTALL, "installation", 1, None),
]

# Defaults that depend on runtime values (size / pair / slider), so they cannot
# be stored as a single static default. Reported for follow-up as rules.
CONDITIONAL = [
    "RRD-MOVIDOR-TEMPLATE: CHKINSRRD4X4 vs CHKINSRRD6X6 depends on door width/height (<=4000)",
    "RRD-MOVIDOR-TEMPLATE: CHKINSHSDFOLDING when model is CONCERTINA/MOVIFOLD",
    "SWI-*: CHKINSSWIS vs CHKINSSWIP depends on Single/Pair",
    "SWI-THERMAL-TEMPLATE: CHKINSSLD when the door is a slider",
    "STRIPDOOR-TEMPLATE: NUMSTRIPAREA = (width/1000) * (height/1000)",
]


def main() -> None:
    engine = config_repo.get_config_engine()
    report: list[str] = []

    with engine.begin() as conn:
        # --- schema (idempotent) ---
        if conn.execute(text("SELECT OBJECT_ID('dbo.uCfgConfiguratorLinks','U')")).scalar() is None:
            conn.execute(text("""
                CREATE TABLE dbo.uCfgConfiguratorLinks (
                    LinkID INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_uCfgConfiguratorLinks PRIMARY KEY,
                    ParentPartID NVARCHAR(30) NOT NULL, ChildPartID NVARCHAR(30) NOT NULL,
                    LinkType NVARCHAR(20) NOT NULL,
                    IsAutomatic BIT NOT NULL CONSTRAINT DF_uCfgLinks_Auto DEFAULT (1),
                    SortOrder INT NOT NULL CONSTRAINT DF_uCfgLinks_Sort DEFAULT (1),
                    Notes NVARCHAR(200) NULL,
                    CONSTRAINT UQ_uCfgConfiguratorLinks UNIQUE (ParentPartID, ChildPartID))"""))
            report.append("created uCfgConfiguratorLinks")
        if conn.execute(text("SELECT COL_LENGTH('dbo.uCfgDefaults','ParentPartID')")).scalar() is None:
            conn.execute(text("ALTER TABLE dbo.uCfgDefaults ADD ParentPartID NVARCHAR(30) NULL"))
            report.append("added uCfgDefaults.ParentPartID")

        # --- links ---
        conn.execute(text("DELETE FROM dbo.uCfgConfiguratorLinks"))
        for i, (parent, child, ltype, auto, note) in enumerate(LINKS, start=1):
            conn.execute(text(
                "INSERT INTO dbo.uCfgConfiguratorLinks "
                "(ParentPartID, ChildPartID, LinkType, IsAutomatic, SortOrder, Notes) "
                "VALUES (:p,:c,:t,:a,:s,:n)"),
                {"p": parent, "c": child, "t": ltype, "a": auto, "s": i, "n": note})
        report.append(f"links: {len(LINKS)} "
                      f"(curtain -> RRD only; installation -> {len(LINKS)-1} door types)")

        # --- installation defaults, per parent configurator ---
        inst = conn.execute(text(
            "SELECT CfgID FROM dbo.uCfgConfigurators WHERE PartID=:p"), {"p": INSTALL}).scalar()
        if not inst:
            report.append("! INSTALLATION-TEMPLATE missing — skipped defaults")
        else:
            # Only the static per-model rows belong to this script; the
            # conditional ones (DoorModel IS NULL) are owned by
            # migrate_conditional_defaults.py and must survive a re-run.
            conn.execute(text("""
                DELETE dc FROM dbo.uCfgDefaultConditions dc
                JOIN dbo.uCfgDefaults d ON dc.DefaultID = d.DefaultID
                WHERE d.CfgID = :c AND d.DoorModel IS NOT NULL"""), {"c": inst})
            conn.execute(text(
                "DELETE FROM dbo.uCfgDefaults WHERE CfgID=:c AND DoorModel IS NOT NULL"),
                {"c": inst})
            total = 0
            for parent, models in DOOR_CONFIGS.items():
                for model in models:
                    try:
                        d = idef.get_default_selections(parent, model, 0, 0)
                    except Exception as exc:
                        report.append(f"  ! {parent}/{model}: {exc}")
                        continue
                    for control, value in d.items():
                        if value in (None, ""):
                            continue
                        conn.execute(text(
                            "INSERT INTO dbo.uCfgDefaults "
                            "(CfgID, DoorModel, ControlName, DefaultValue, ParentPartID) "
                            "VALUES (:c,:m,:cn,:v,:p)"),
                            {"c": inst, "m": model, "cn": control,
                             "v": str(value), "p": parent})
                        total += 1
            report.append(f"installation defaults: {total} rows across "
                          f"{len(DOOR_CONFIGS)} parent configurators")

    print("\n".join("  " + r for r in report))
    print("\n  Conditional defaults that still need a rule (not static):")
    for c in CONDITIONAL:
        print(f"    - {c}")


if __name__ == "__main__":
    main()
