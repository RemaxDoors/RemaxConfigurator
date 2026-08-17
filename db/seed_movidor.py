# -*- coding: utf-8 -*-
"""Generate a T-SQL seed file for the RRD Movidor configurator from the existing
Python dicts (control names, option registry, model defaults).

Run it (from the repo root, any Python — streamlit is stubbed so it's not needed):
    python db/seed_movidor.py
Then run the generated db/seed_movidor_generated.sql on your config DB in SSMS.

It ONLY covers the dict-based data (parameters / options / defaults). Validations
are procedural code, translated separately (seed_movidor_validations.sql).
"""
import os
import sys
import types

# Stub the streamlit-family imports so the data modules import without them.
for _m in ("streamlit", "st_aggrid"):
    sys.modules.setdefault(_m, types.ModuleType(_m))

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(REPO, "src"))

from services.movidor_door_config import movidor_control_names as ctl  # noqa: E402
from services.movidor_door_config import movidor_option_registery as reg  # noqa: E402
from services.movidor_door_config import movidor_default_defaults as dfl  # noqa: E402

PART_ID = "RRD-MOVIDOR-TEMPLATE"
OUT = os.path.join(REPO, "db", "seed_movidor_generated.sql")


def kind_of(name: str) -> str:
    if name.startswith("CMB"):
        return "dropdown"
    if name.startswith("CHK"):
        return "checkbox"
    if name.startswith("NUM") or name == "QTY":
        return "number"
    return "text"


def s(value) -> str:
    if value is None:
        return "NULL"
    return "N'" + str(value).replace("'", "''") + "'"


out = []
out.append("/* AUTO-GENERATED from the Python dicts by db/seed_movidor.py. Re-runnable. */")
out.append("SET NOCOUNT ON;")
out.append("")
out.append(
    "IF NOT EXISTS (SELECT 1 FROM dbo.uCfgConfigurators WHERE PartID = "
    f"{s(PART_ID)})"
)
out.append(
    "    INSERT INTO dbo.uCfgConfigurators (PartID, PartRevision, PartDescription, ConfiguratorName, DoorType) "
    f"VALUES ({s(PART_ID)}, N'A', N'RRD Movidor configurator template', N'RRD Movidor', N'RRD');"
)
out.append(f"DECLARE @Cfg INT = (SELECT TOP 1 CfgID FROM dbo.uCfgConfigurators WHERE PartID = {s(PART_ID)});")
out.append("DECLARE @P INT;")
out.append("")
out.append("-- Clear this configurator's existing definition (idempotent re-run)")
out.append("DELETE o FROM dbo.uCfgParameterOptions o JOIN dbo.uCfgParameters p ON o.ParamID = p.ParamID WHERE p.CfgID = @Cfg;")
out.append("DELETE FROM dbo.uCfgParameters WHERE CfgID = @Cfg;")
out.append("DELETE FROM dbo.uCfgDefaults   WHERE CfgID = @Cfg;")
out.append("")

# ---- Parameters ----
visible = set(ctl.VISIBLE_DOOR_CONTROL_NAMES)
out.append("-- Parameters (from movidor_control_names.py)")
for i, name in enumerate(ctl.DOOR_CONTROL_NAMES, start=1):
    is_vis = 1 if name in visible else 0
    out.append(
        "INSERT INTO dbo.uCfgParameters (CfgID, ControlName, Label, Kind, IsVisible, SortOrder) VALUES "
        f"(@Cfg, {s(name)}, {s(name)}, {s(kind_of(name))}, {is_vis}, {i});"
    )
out.append("")

# ---- Options ----
opt_by_lower = {k.lower(): v for k, v in reg.M1_OPTIONS.items()}
out.append("-- Options (from movidor_option_registery.py, matched to Movidor controls)")
opt_count = 0
for name in ctl.DOOR_CONTROL_NAMES:
    options = opt_by_lower.get(name.lower())
    if not options:
        continue
    out.append(f"SET @P = (SELECT ParamID FROM dbo.uCfgParameters WHERE CfgID = @Cfg AND ControlName = {s(name)});")
    for j, opt in enumerate(options, start=1):
        val = opt.get("value", "")
        lab = opt.get("label", val)
        out.append(
            "INSERT INTO dbo.uCfgParameterOptions (ParamID, OptionValue, OptionLabel, SortOrder) VALUES "
            f"(@P, {s(val)}, {s(lab)}, {j});"
        )
        opt_count += 1
out.append("")

# ---- Defaults (per model) ----
out.append("-- Defaults per door model (from movidor_default_defaults.get_default_selections)")
models = [o["value"] for o in reg.M1_OPTIONS.get("CMBDOORMODEL", []) if o.get("value")]
def_count = 0
for model in models:
    try:
        defaults = dfl.get_default_selections(model, 0)
    except Exception:
        continue
    for control, value in defaults.items():
        out.append(
            "INSERT INTO dbo.uCfgDefaults (CfgID, DoorModel, ControlName, DefaultValue) VALUES "
            f"(@Cfg, {s(model)}, {s(control)}, {s(value)});"
        )
        def_count += 1
out.append("")
out.append("PRINT 'Movidor seed complete.';")

with open(OUT, "w", encoding="utf-8") as fh:
    fh.write("\n".join(out) + "\n")

print(f"Wrote {OUT}")
print(f"  parameters: {len(ctl.DOOR_CONTROL_NAMES)}")
print(f"  option rows: {opt_count}")
print(f"  default rows: {def_count} (models: {len(models)})")
