"""Move the remaining Streamlit configuration into the config DB.

Covers:
  1. CURTAIN-TEMPLATE  — create the configurator, its parameters + options + defaults
  2. INSTALLATION      — defaults per configurator/model
  3. Validations       — curtain + installation validation rules

Run from the repo root:   python db/migrate_streamlit_to_db.py
Re-runnable: each section replaces what it owns.
"""
from __future__ import annotations

import os
import sys
import types

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "src"))
sys.path.insert(0, os.path.join(ROOT, "api"))

# --- stub streamlit so the pure config modules import without a UI -----------
if "streamlit" not in sys.modules:
    st = types.ModuleType("streamlit")
    st.session_state = {}
    sys.modules["streamlit"] = st

from sqlalchemy import text  # noqa: E402

from app import config_repo  # noqa: E402
from services.curtain_config import curtain_control_names as cc  # noqa: E402
from services.curtain_config import curtain_defaults as cdef  # noqa: E402
from services.curtain_config import curtain_options as copts  # noqa: E402
from services.installation_config import installation_control_names as ic  # noqa: E402
from services.installation_config import installation_defaults as idef  # noqa: E402

CURTAIN_ID = "CURTAIN-TEMPLATE"
DOOR_MODELS = [
    "ES40", "EX35", "EX45", "HS25", "HS35", "HS35-THERMIC", "HS50",
    "HS50-THERMIC", "HS65", "MOVICHILL", "MOVICHILL-XL", "MOVIFOLD", "CONCERTINA",
]

# Friendly labels taken from ui/curtain_section.py
CURTAIN_LABELS = {
    "CMBCURTAINCOLOUR": "Curtain Colour",
    "CMBNUMWINDROWS": "Window Rows",
    "CMBWINDOWTYPEDEFAULT": "Default Window Type",
    "CMBFLOORSLOPE": "Floor Slope",
    "CMBWINDPOT": "Wind Potential",
    "NUMWINDOWSDEFAULT": "Default # of Windows",
    "NUMWINDOWSREQ": "# of Windows Required Per Row",
    "NUMEXTRAWINDOWS": "Extra Windows",
    "NUMCURTFINHL": "Finished Height Left",
    "NUMCURTFINHR": "Finished Height Right",
    "NUMCURTFINW": "Finished Width",
    "NUMFLOORSLOPE": "Floor Slope Amount",
    "NUMES40PANELSREQ": "ES40 Panels Required",
    "NUMES40PANELSCOLOURED": "ES40 Coloured Panels",
    "NUMES40PANELSVISIONCLEAR": "ES40 Vision Clear Panels",
    "NUMES40PANELSVISIONMESH": "ES40 Vision Mesh Panels",
    "NUMPANELHEIGHT": "Panel Height (Concertina)",
    "CHKSLOPEREQUIRED": "Slope Edge Required",
    "CHKCUSTBOTTOMEDGE": "Custom Bottom Edge",
    "CHKCUSTSCREENPRINT": "Custom Screen Printing",
    "CHKEMERGZIP": "Emergency Zip with 'Push Here' Graphic",
    "CHKDRIPEDGE": "Drip Edge Required",
    "CHKCOMOWEAR": "Como Wear Strip",
    "CHKEX35BVSEAL": "EX BV Seal",
    "CHKUSEDEFAULTWINPERROW": "Use Default # Windows",
    "CHKHS25SPECIAL": "HS25 Special",
}

# Which form section each curtain parameter belongs to (drives the wizard steps)
CURTAIN_SECTIONS = {
    "NUMCURTFINHL": "Dimensions", "NUMCURTFINHR": "Dimensions",
    "NUMCURTFINW": "Dimensions", "CMBFLOORSLOPE": "Dimensions",
    "NUMFLOORSLOPE": "Dimensions", "CHKSLOPEREQUIRED": "Dimensions",
    "CMBCURTAINCOLOUR": "Curtain", "CMBWINDPOT": "Curtain",
    "CMBNUMWINDROWS": "Windows", "CMBWINDOWTYPEDEFAULT": "Windows",
    "NUMWINDOWSDEFAULT": "Windows", "NUMWINDOWSREQ": "Windows",
    "NUMEXTRAWINDOWS": "Windows", "CHKUSEDEFAULTWINPERROW": "Windows",
    "NUMES40PANELSREQ": "Panels", "NUMES40PANELSCOLOURED": "Panels",
    "NUMES40PANELSVISIONCLEAR": "Panels", "NUMES40PANELSVISIONMESH": "Panels",
    "NUMPANELHEIGHT": "Panels",
}


def kind_for(control: str) -> str:
    if control.startswith("CHK"):
        return "checkbox"
    if control.startswith("NUM"):
        return "number"
    if control.startswith("CMB"):
        return "dropdown"
    return "text"


def label_for(control: str) -> str:
    if control in CURTAIN_LABELS:
        return CURTAIN_LABELS[control]
    if control.startswith("CMBWINDROWLOC"):
        return f"Window Row {control.replace('CMBWINDROWLOC','')} — Location"
    if control.startswith("CMBWINDROWTYPE"):
        return f"Window Row {control.replace('CMBWINDROWTYPE','')} — Type"
    return control


def section_for(control: str) -> str | None:
    if control in CURTAIN_SECTIONS:
        return CURTAIN_SECTIONS[control]
    if control.startswith("CMBWINDROW"):
        return "Window Rows"
    return None


def curtain_options(control: str) -> list[dict]:
    """Union of the model-dependent option lists, de-duplicated in order."""
    seen, out = set(), []

    def add(items):
        for o in items or []:
            v = o.get("value", "")
            if v not in seen:
                seen.add(v)
                out.append({"value": v, "label": o.get("label", v) or v})

    for model in DOOR_MODELS:
        if control == "CMBNUMWINDROWS":
            add(copts.get_window_row_options(model))
        elif control == "CMBWINDOWTYPEDEFAULT" or control.startswith("CMBWINDROWTYPE"):
            add(copts.get_window_type_options(model))
        elif control.startswith("CMBWINDROWLOC"):
            add(copts.get_window_location_options(model))
    if control == "CMBFLOORSLOPE":
        add([{"value": v, "label": v} for v in [
            "No Slope", "Subtract from LHS (RHS Taller)", "Subtract from RHS (LHS Taller)",
            "Add to LHS (LHS Taller)", "Add to RHS (RHS Taller)"]])
    return out


def main() -> None:
    engine = config_repo.get_config_engine()
    report: list[str] = []

    with engine.begin() as conn:
        # ---------- 1. CURTAIN configurator ----------
        cfg = conn.execute(
            text("SELECT CfgID FROM dbo.uCfgConfigurators WHERE PartID=:p"), {"p": CURTAIN_ID}
        ).scalar()
        if cfg is None:
            conn.execute(text(
                "INSERT INTO dbo.uCfgConfigurators (PartID, PartRevision, PartDescription, "
                "ConfiguratorName, DoorType) VALUES (:p,'A','Curtain configurator template','Curtain',NULL)"
            ), {"p": CURTAIN_ID})
            cfg = conn.execute(
                text("SELECT CfgID FROM dbo.uCfgConfigurators WHERE PartID=:p"), {"p": CURTAIN_ID}
            ).scalar()
            report.append(f"created configurator {CURTAIN_ID}")
        else:
            report.append(f"configurator {CURTAIN_ID} already existed")

        has_section = config_repo.column_exists(conn, "uCfgParameters", "Section")

        # replace curtain parameters + options
        conn.execute(text(
            "DELETE o FROM dbo.uCfgParameterOptions o "
            "JOIN dbo.uCfgParameters p ON o.ParamID=p.ParamID WHERE p.CfgID=:c"), {"c": cfg})
        conn.execute(text("DELETE FROM dbo.uCfgParameters WHERE CfgID=:c"), {"c": cfg})

        n_params = n_opts = 0
        for order, control in enumerate(cc.CURTAIN_CONTROL_NAMES, start=1):
            cols = "CfgID, ControlName, Label, Kind, IsRequired, IsVisible, SortOrder"
            vals = ":c, :cn, :l, :k, 0, 1, :o"
            params = {"c": cfg, "cn": control, "l": label_for(control),
                      "k": kind_for(control), "o": order}
            if has_section:
                cols += ", Section"
                vals += ", :sec"
                params["sec"] = section_for(control)
            conn.execute(text(f"INSERT INTO dbo.uCfgParameters ({cols}) VALUES ({vals})"), params)
            pid = conn.execute(text(
                "SELECT ParamID FROM dbo.uCfgParameters WHERE CfgID=:c AND ControlName=:cn"),
                {"c": cfg, "cn": control}).scalar()
            n_params += 1
            for i, opt in enumerate(curtain_options(control), start=1):
                conn.execute(text(
                    "INSERT INTO dbo.uCfgParameterOptions (ParamID, OptionValue, OptionLabel, SortOrder) "
                    "VALUES (:p,:v,:l,:s)"),
                    {"p": pid, "v": opt["value"], "l": opt["label"], "s": i})
                n_opts += 1
        report.append(f"curtain parameters: {n_params} (with {n_opts} options)")

        # curtain defaults per door model (drop any conditions first — FK)
        conn.execute(text("""
            DELETE dc FROM dbo.uCfgDefaultConditions dc
            JOIN dbo.uCfgDefaults d ON dc.DefaultID = d.DefaultID
            WHERE d.CfgID = :c"""), {"c": cfg})
        conn.execute(text("DELETE FROM dbo.uCfgDefaults WHERE CfgID=:c"), {"c": cfg})
        n_def = 0
        for model in DOOR_MODELS:
            try:
                d = cdef.get_default_selections(model, 0, 0)
            except Exception as exc:
                report.append(f"  ! curtain defaults failed for {model}: {exc}")
                continue
            for control, value in d.items():
                if value in (None, ""):
                    continue
                conn.execute(text(
                    "INSERT INTO dbo.uCfgDefaults (CfgID, DoorModel, ControlName, DefaultValue) "
                    "VALUES (:c,:m,:cn,:v)"),
                    {"c": cfg, "m": model, "cn": control, "v": str(value)})
                n_def += 1
        report.append(f"curtain defaults: {n_def} rows across {len(DOOR_MODELS)} models")

        # ---------- 2. INSTALLATION defaults ----------
        # Handled by migrate_configurator_links.py, which keys them by the parent
        # configurator (installation adapts via CMBCONFIGID). Re-seeding them here
        # would drop that scoping, so this script only reports.
        inst = conn.execute(text(
            "SELECT CfgID FROM dbo.uCfgConfigurators WHERE PartID='INSTALLATION-TEMPLATE'")).scalar()
        if inst:
            have = conn.execute(text(
                "SELECT COUNT(*) FROM dbo.uCfgDefaults WHERE CfgID=:c"), {"c": inst}).scalar()
            report.append(f"installation defaults: {have} rows "
                          "(owned by migrate_configurator_links.py — not touched)")
        else:
            report.append("! INSTALLATION-TEMPLATE not found")

        # ---------- 3. Validation rules ----------
        def add_validation(cfg_id, code, severity, field, message):
            conn.execute(text(
                "INSERT INTO dbo.uCfgValidationRules (CfgID, RuleCode, Severity, TargetField, Message, IsActive) "
                "VALUES (:c,:code,:sev,:f,:m,1)"),
                {"c": cfg_id, "code": code, "sev": severity, "f": field, "m": message})

        if inst:
            conn.execute(text(
                "DELETE vc FROM dbo.uCfgValidationConditions vc "
                "JOIN dbo.uCfgValidationRules r ON vc.ValidationID=r.ValidationID WHERE r.CfgID=:c"), {"c": inst})
            conn.execute(text("DELETE FROM dbo.uCfgValidationRules WHERE CfgID=:c"), {"c": inst})
            add_validation(inst, "INST-ACCOM-NIGHTS", "error", ic.NUMACCOMNIGHT,
                           "Must enter # of nights accommodation.")
            add_validation(inst, "INST-PROJ-RUN", "error", ic.NUMESTPROJECTSONRUN,
                           "Estimated projects on install run must be at least 1.")
            add_validation(inst, "INST-TOTAL-DOORS", "error", ic.NUMTOTALDOORSPROJ,
                           "Total doors in project must be at least 1.")
            report.append("installation validations: 3")

        conn.execute(text(
            "DELETE vc FROM dbo.uCfgValidationConditions vc "
            "JOIN dbo.uCfgValidationRules r ON vc.ValidationID=r.ValidationID WHERE r.CfgID=:c"), {"c": cfg})
        conn.execute(text("DELETE FROM dbo.uCfgValidationRules WHERE CfgID=:c"), {"c": cfg})
        add_validation(cfg, "CURT-SLOPE-AMOUNT", "error", cc.NUMFLOORSLOPE,
                       "Enter the floor slope amount when a slope edge is required.")
        add_validation(cfg, "CURT-WINDOW-ROWS", "error", cc.CMBNUMWINDROWS,
                       "Select the number of window rows.")
        report.append("curtain validations: 2")

    print("\n".join("  " + line for line in report))


if __name__ == "__main__":
    main()
