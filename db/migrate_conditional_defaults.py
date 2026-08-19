"""Make defaults conditional and formula-capable.

Adds:
  uCfgDefaults.Priority      - higher wins when several defaults target the same control
  uCfgDefaults.ValueFormula  - computed default, e.g. (NUMDOORWIDTH/1000)*(NUMDOORHEIGHT/1000)
  uCfgDefaultConditions      - same shape as uCfgRuleConditions (AND in a group, OR across)

Then seeds the five conditional defaults that could not be stored statically.

Run from the repo root:  python db/migrate_conditional_defaults.py
Re-runnable.
"""
from __future__ import annotations

import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "backend"))

from sqlalchemy import text  # noqa: E402

from app import config_repo  # noqa: E402

INSTALL = "INSTALLATION-TEMPLATE"

# (parent, control, value, formula, priority, [conditions])
# condition = (groupNo, controlName, operator, compareValue)
# Streamlit uses if/elif, so each branch must exclude the earlier ones.
NOT_FOLDING = ("CMBDOORMODEL", "not_in", "CONCERTINA, MOVIFOLD")
NOT_SLIDER = ("CHKISSLIDER", "not_checked", None)

CONDITIONAL_DEFAULTS = [
    # --- RRD: folding doors take precedence over the size band ------------
    ("RRD-MOVIDOR-TEMPLATE", "CHKINSHSDFOLDING", "1", None, 20, [
        (1, "CMBDOORMODEL", "in", "CONCERTINA, MOVIFOLD"),
    ]),
    # --- RRD: install size band (non-folding only) ------------------------
    ("RRD-MOVIDOR-TEMPLATE", "CHKINSRRD4X4", "1", None, 10, [
        (1, "NUMDOORWIDTH", "less_than", "4001"),
        (1, "NUMDOORHEIGHT", "less_than", "4001"),
        (1, *NOT_FOLDING),
    ]),
    ("RRD-MOVIDOR-TEMPLATE", "CHKINSRRD6X6", "1", None, 10, [
        # width over -> group 1
        (1, "NUMDOORWIDTH", "greater_than", "4000"),
        (1, *NOT_FOLDING),
        # ...or height over -> group 2
        (2, "NUMDOORHEIGHT", "greater_than", "4000"),
        (2, *NOT_FOLDING),
    ]),
    # --- SWI-PVC: single vs pair ------------------------------------------
    ("SWI-PVC-TEMPLATE", "CHKINSSWIS", "1", None, 10, [
        (1, "CHKISPAIR", "not_checked", None),
    ]),
    ("SWI-PVC-TEMPLATE", "CHKINSSWIP", "1", None, 10, [
        (1, "CHKISPAIR", "is_checked", None),
    ]),
    # --- SWI-THERMAL: slider wins, then 5000 pair/single, then plain ------
    ("SWI-THERMAL-TEMPLATE", "CHKINSSLD", "1", None, 30, [
        (1, "CHKISSLIDER", "is_checked", None),
    ]),
    ("SWI-THERMAL-TEMPLATE", "CHKINS50SWIS", "1", None, 20, [
        (1, "CHKISPAIR", "not_checked", None),
        (1, "CMBDOORMODEL", "contains", "5000"),
        (1, *NOT_SLIDER),
    ]),
    ("SWI-THERMAL-TEMPLATE", "CHKINS50SWIP", "1", None, 20, [
        (1, "CHKISPAIR", "is_checked", None),
        (1, "CMBDOORMODEL", "contains", "5000"),
        (1, *NOT_SLIDER),
    ]),
    ("SWI-THERMAL-TEMPLATE", "CHKINSSWIP", "1", None, 10, [
        (1, "CHKISPAIR", "is_checked", None),
        (1, "CMBDOORMODEL", "not_contains", "5000"),
        (1, *NOT_SLIDER),
    ]),
    ("SWI-THERMAL-TEMPLATE", "CHKINSSWIS", "1", None, 10, [
        (1, "CHKISPAIR", "not_checked", None),
        (1, "CMBDOORMODEL", "not_contains", "5000"),
        (1, *NOT_SLIDER),
    ]),
    # --- STRIPDOOR: computed area ----------------------------------------
    ("STRIPDOOR-TEMPLATE", "NUMSTRIPAREA", None,
     "(NUMDOORWIDTH / 1000) * (NUMDOORHEIGHT / 1000)", 10, []),
]

# These are now decided by the conditions above, so the old static per-model
# rows must go or they would fire unconditionally alongside them.
SUPERSEDED_STATIC = [
    "CHKINSRRD4X4", "CHKINSRRD6X6", "CHKINSHSDFOLDING",
    "CHKINSSWIS", "CHKINSSWIP", "CHKINS50SWIS", "CHKINS50SWIP",
    "CHKINSSLD", "NUMSTRIPAREA",
]


def main() -> None:
    engine = config_repo.get_config_engine()
    report: list[str] = []

    with engine.begin() as conn:
        # --- schema ---
        # A conditional default applies to every model, so DoorModel must allow NULL.
        nullable = conn.execute(text(
            "SELECT IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS "
            "WHERE TABLE_NAME='uCfgDefaults' AND COLUMN_NAME='DoorModel'")).scalar()
        if nullable == "NO":
            conn.execute(text("ALTER TABLE dbo.uCfgDefaults ALTER COLUMN DoorModel NVARCHAR(30) NULL"))
            report.append("uCfgDefaults.DoorModel -> nullable (applies to all models)")

        # The old unique key (CfgID, DoorModel, ControlName) blocks the same
        # control under two different parent configurators — widen it.
        uq = conn.execute(text(
            "SELECT name FROM sys.key_constraints "
            "WHERE parent_object_id = OBJECT_ID('dbo.uCfgDefaults') AND type='UQ'")).scalar()
        if uq:
            cols = [r[0] for r in conn.execute(text(
                "SELECT c.name FROM sys.index_columns ic "
                "JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id "
                "JOIN sys.indexes i ON i.object_id = ic.object_id AND i.index_id = ic.index_id "
                "WHERE i.name = :n AND ic.object_id = OBJECT_ID('dbo.uCfgDefaults')"), {"n": uq})]
            if "ParentPartID" not in cols:
                conn.execute(text(f"ALTER TABLE dbo.uCfgDefaults DROP CONSTRAINT [{uq}]"))
                conn.execute(text(
                    "ALTER TABLE dbo.uCfgDefaults ADD CONSTRAINT UQ_uCfgDefaults "
                    "UNIQUE (CfgID, ParentPartID, DoorModel, ControlName)"))
                report.append("unique key widened to include ParentPartID")

        for col, ddl in [("Priority", "INT NULL"), ("ValueFormula", "NVARCHAR(400) NULL")]:
            if conn.execute(text(f"SELECT COL_LENGTH('dbo.uCfgDefaults','{col}')")).scalar() is None:
                conn.execute(text(f"ALTER TABLE dbo.uCfgDefaults ADD {col} {ddl}"))
                report.append(f"added uCfgDefaults.{col}")

        if conn.execute(text("SELECT OBJECT_ID('dbo.uCfgDefaultConditions','U')")).scalar() is None:
            conn.execute(text("""
                CREATE TABLE dbo.uCfgDefaultConditions (
                    ConditionID INT IDENTITY(1,1) NOT NULL
                        CONSTRAINT PK_uCfgDefaultConditions PRIMARY KEY,
                    DefaultID   INT NOT NULL,
                    GroupNo     INT NOT NULL CONSTRAINT DF_uCfgDefCond_Grp DEFAULT (1),
                    ControlName NVARCHAR(35) NOT NULL,
                    Operator    NVARCHAR(20) NOT NULL,
                    CompareValue NVARCHAR(255) NULL,
                    CONSTRAINT FK_uCfgDefCond_Default FOREIGN KEY (DefaultID)
                        REFERENCES dbo.uCfgDefaults (DefaultID))"""))
            conn.execute(text(
                "CREATE INDEX IX_uCfgDefaultConditions_Default "
                "ON dbo.uCfgDefaultConditions (DefaultID)"))
            report.append("created uCfgDefaultConditions")

        # --- seed the conditional defaults ---
        inst = conn.execute(text(
            "SELECT CfgID FROM dbo.uCfgConfigurators WHERE PartID=:p"), {"p": INSTALL}).scalar()
        if not inst:
            report.append("! INSTALLATION-TEMPLATE missing — nothing seeded")
        else:
            # clear only previously-seeded conditional rows (DoorModel IS NULL = applies to all)
            conn.execute(text("""
                DELETE dc FROM dbo.uCfgDefaultConditions dc
                JOIN dbo.uCfgDefaults d ON dc.DefaultID = d.DefaultID
                WHERE d.CfgID = :c AND d.DoorModel IS NULL"""), {"c": inst})
            conn.execute(text(
                "DELETE FROM dbo.uCfgDefaults WHERE CfgID=:c AND DoorModel IS NULL"), {"c": inst})

            n_def = n_cond = 0
            for parent, control, value, formula, priority, conds in CONDITIONAL_DEFAULTS:
                did = conn.execute(text(
                    "INSERT INTO dbo.uCfgDefaults "
                    "(CfgID, DoorModel, ControlName, DefaultValue, ParentPartID, Priority, ValueFormula) "
                    "OUTPUT INSERTED.DefaultID "
                    "VALUES (:c, NULL, :cn, :v, :p, :pr, :f)"),
                    {"c": inst, "cn": control, "v": value, "p": parent,
                     "pr": priority, "f": formula}).scalar()
                n_def += 1
                for group_no, ctrl, op, cmp_val in conds:
                    conn.execute(text(
                        "INSERT INTO dbo.uCfgDefaultConditions "
                        "(DefaultID, GroupNo, ControlName, Operator, CompareValue) "
                        "VALUES (:d,:g,:cn,:op,:v)"),
                        {"d": did, "g": group_no, "cn": ctrl, "op": op, "v": cmp_val})
                    n_cond += 1
            report.append(f"conditional defaults seeded: {n_def} (with {n_cond} conditions)")

            # drop the static rows these conditionals replace
            removed = conn.execute(text(
                "DELETE FROM dbo.uCfgDefaults WHERE CfgID=:c AND DoorModel IS NOT NULL "
                "AND ControlName IN (" +
                ",".join(f"'{c}'" for c in SUPERSEDED_STATIC) + ")"
            ), {"c": inst}).rowcount
            report.append(f"superseded static defaults removed: {removed}")

            # the static rows keep priority 0 so a matching conditional default wins
            conn.execute(text(
                "UPDATE dbo.uCfgDefaults SET Priority = 0 "
                "WHERE CfgID=:c AND Priority IS NULL"), {"c": inst})

    print("\n".join("  " + r for r in report))


if __name__ == "__main__":
    main()
