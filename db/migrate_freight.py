"""Add the freight rate parameter + freight allowance calculation.

From the M1 Movidor template (cmdCalcFreight_Click):

    nLongest = (max(NumDoorHeight, NumDoorWidth) + 500) / 1000
    nVol     = 360 * nLongest * 0.8 * 0.8
    nFee     = nVol * cmbFreightRate
    numFreightAllowance = nFee

cmbFreightRate stores the RATE as its value and the STATE as its label. The
odd decimals (0.9002 / 0.9001 / 1.9001) are deliberate in M1 so NSW/SA/VIC and
NT/TAS/WA stay distinct despite sharing a headline rate.

Run from the repo root:  python db/migrate_freight.py
Re-runnable.
"""
from __future__ import annotations

import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "backend"))

from sqlalchemy import text  # noqa: E402

from app import config_repo  # noqa: E402

# value = rate (what the formula multiplies by), label = what the user picks
FREIGHT_RATES = [
    ("0.9", "VIC"),
    ("1.9", "TAS"),
    ("0.9002", "NSW"),
    ("0.9001", "SA"),
    ("1.5", "QLD"),
    ("1.9", "WA"),
    ("1.9001", "NT"),
]

# Rates the old Streamlit app used — kept only to report the difference.
STREAMLIT_RATES = {"VIC": 0.5, "TAS": 1.4, "NSW": 0.6, "SA": 0.7,
                   "QLD": 0.9, "WA": 1.4, "NT": 1.8}

FREIGHT_FORMULA = (
    "360 * ((max(NUMDOORHEIGHT, NUMDOORWIDTH) + 500) / 1000) * 0.8 * 0.8 * CMBFREIGHTRATE"
)

# Door configurators that quote freight.
TARGETS = ["RRD-MOVIDOR-TEMPLATE", "SWI-PVC-TEMPLATE", "SWI-THERMAL-TEMPLATE"]

PARAMS = [
    ("CMBFREIGHTRATE", "State / Freight Rate", "dropdown", FREIGHT_RATES),
    ("NUMFREIGHTALLOWANCE", "Freight Allowance ($)", "number", None),
]


def upsert_param(conn, cfg_id, control, label, kind, options, has_section):
    existing = conn.execute(text(
        "SELECT ParamID FROM dbo.uCfgParameters WHERE CfgID=:c AND ControlName=:cn"),
        {"c": cfg_id, "cn": control}).fetchone()
    if existing:
        param_id = existing[0]
        sec = ", Section='Freight'" if has_section else ""
        conn.execute(text(
            f"UPDATE dbo.uCfgParameters SET Label=:l, Kind=:k{sec} WHERE ParamID=:p"),
            {"l": label, "k": kind, "p": param_id})
    else:
        order = conn.execute(text(
            "SELECT ISNULL(MAX(SortOrder),0)+1 FROM dbo.uCfgParameters WHERE CfgID=:c"),
            {"c": cfg_id}).scalar()
        cols = "CfgID, ControlName, Label, Kind, IsRequired, IsVisible, SortOrder"
        vals = ":c, :cn, :l, :k, 0, 1, :o"
        params = {"c": cfg_id, "cn": control, "l": label, "k": kind, "o": order}
        if has_section:
            cols += ", Section"
            vals += ", 'Freight'"
        param_id = conn.execute(text(
            f"INSERT INTO dbo.uCfgParameters ({cols}) OUTPUT INSERTED.ParamID VALUES ({vals})"),
            params).scalar()

    conn.execute(text("DELETE FROM dbo.uCfgParameterOptions WHERE ParamID=:p"), {"p": param_id})
    for i, (value, label_text) in enumerate(options or [], start=1):
        conn.execute(text(
            "INSERT INTO dbo.uCfgParameterOptions (ParamID, OptionValue, OptionLabel, SortOrder) "
            "VALUES (:p,:v,:l,:s)"),
            {"p": param_id, "v": value, "l": label_text, "s": i})
    return param_id, bool(existing)


def main() -> None:
    engine = config_repo.get_config_engine()
    report: list[str] = []

    with engine.begin() as conn:
        has_section = config_repo.column_exists(conn, "uCfgParameters", "Section")
        has_formula = config_repo.column_exists(conn, "uCfgDefaults", "ValueFormula")

        # M1 gives TAS and WA the same rate (1.9), so an option list keyed only by
        # value cannot hold both. Widen the key to include the label.
        uq = conn.execute(text(
            "SELECT name FROM sys.key_constraints "
            "WHERE parent_object_id = OBJECT_ID('dbo.uCfgParameterOptions') AND type='UQ'")).scalar()
        if uq:
            cols = [r[0] for r in conn.execute(text(
                "SELECT c.name FROM sys.index_columns ic "
                "JOIN sys.columns c ON c.object_id=ic.object_id AND c.column_id=ic.column_id "
                "JOIN sys.indexes i ON i.object_id=ic.object_id AND i.index_id=ic.index_id "
                "WHERE i.name=:n AND ic.object_id=OBJECT_ID('dbo.uCfgParameterOptions')"), {"n": uq})]
            if "OptionLabel" not in cols:
                conn.execute(text(f"ALTER TABLE dbo.uCfgParameterOptions DROP CONSTRAINT [{uq}]"))
                conn.execute(text(
                    "ALTER TABLE dbo.uCfgParameterOptions ADD CONSTRAINT UQ_uCfgParameterOptions "
                    "UNIQUE (ParamID, OptionValue, OptionLabel)"))
                report.append("option unique key widened to include OptionLabel "
                              "(TAS and WA share rate 1.9)")

        for target in TARGETS:
            cfg = conn.execute(text(
                "SELECT CfgID FROM dbo.uCfgConfigurators WHERE PartID=:p"), {"p": target}).scalar()
            if not cfg:
                report.append(f"! {target}: configurator not found — skipped")
                continue

            added = []
            for control, label, kind, options in PARAMS:
                _, existed = upsert_param(conn, cfg, control, label, kind, options, has_section)
                added.append(f"{control}{'(updated)' if existed else '(new)'}")

            if has_formula:
                # computed default: freight allowance from the state rate
                conn.execute(text("""
                    DELETE dc FROM dbo.uCfgDefaultConditions dc
                    JOIN dbo.uCfgDefaults d ON dc.DefaultID = d.DefaultID
                    WHERE d.CfgID=:c AND d.ControlName='NUMFREIGHTALLOWANCE'"""), {"c": cfg})
                conn.execute(text(
                    "DELETE FROM dbo.uCfgDefaults WHERE CfgID=:c AND ControlName='NUMFREIGHTALLOWANCE'"),
                    {"c": cfg})
                conn.execute(text(
                    "INSERT INTO dbo.uCfgDefaults "
                    "(CfgID, DoorModel, ControlName, DefaultValue, Priority, ValueFormula) "
                    "VALUES (:c, NULL, 'NUMFREIGHTALLOWANCE', NULL, 10, :f)"),
                    {"c": cfg, "f": FREIGHT_FORMULA})
                added.append("freight formula")

            report.append(f"{target}: " + ", ".join(added))

    print("\n".join("  " + r for r in report))
    print(f"\n  formula: {FREIGHT_FORMULA}")
    print("\n  RATE CHECK — M1 template vs the old Streamlit app:")
    print(f"    {'state':<6}{'M1':>9}{'streamlit':>12}")
    for value, state in FREIGHT_RATES:
        old = STREAMLIT_RATES.get(state)
        flag = "" if float(value) == old else "  <-- differs"
        print(f"    {state:<6}{value:>9}{old:>12}{flag}")
    print("    Using the M1 rates (the template is the source of truth).")


if __name__ == "__main__":
    main()
