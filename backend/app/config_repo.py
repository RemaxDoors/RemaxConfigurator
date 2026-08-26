"""Reads the configurator DEFINITION from the config DB (uCfg* tables).

Same server/creds as M1, but the CONFIG_DB_NAME database. pyodbc is imported
lazily by SQLAlchemy at connect time.
"""
import urllib.parse
from collections import defaultdict

from sqlalchemy import create_engine, text

from . import settings

_engine = None
_col_cache: dict = {}


def column_exists(conn, table: str, column: str) -> bool:
    """Cached check so the app keeps working before a migration is applied.

    Only a positive result is cached. Caching "missing" would pin the answer for
    the life of the process, so applying the migration would appear to do
    nothing until someone restarted the API — which is exactly the kind of
    thing that gets diagnosed as "the script didn't work".
    """
    key = (table.lower(), column.lower())
    if _col_cache.get(key):
        return True
    present = conn.execute(
        text(f"SELECT COL_LENGTH('dbo.{table}', '{column}')")
    ).scalar() is not None
    if present:
        _col_cache[key] = True
    return present


def get_config_engine():
    global _engine
    if _engine is None:
        params = urllib.parse.quote_plus(
            f"DRIVER={{{settings.CONFIG_DB_DRIVER}}};"
            f"SERVER={settings.CONFIG_DB_SERVER};"
            f"DATABASE={settings.CONFIG_DB_NAME};"
            f"UID={settings.CONFIG_DB_USER};"
            f"PWD={settings.CONFIG_DB_PASSWORD};"
            "TrustServerCertificate=yes;"
        )
        _engine = create_engine(f"mssql+pyodbc:///?odbc_connect={params}")
    return _engine


def load_configurators() -> list[dict]:
    engine = get_config_engine()
    with engine.connect() as conn:
        # PartRevision is the CONFIGURATOR's revision, not the quote's. M1
        # builds the form id as PART-{PartID}-REV-{PartRevision}, so Movidor
        # is PART-RRD-MOVIDOR-TEMPLATE-REV-BOM while curtain and installation
        # carry a blank revision. Sending the quote revision instead produced
        # a form id that matches nothing in FormInputValues.
        configs = conn.execute(text(
            "SELECT CfgID, PartID, ConfiguratorName, DoorType, PartRevision "
            "FROM dbo.uCfgConfigurators WHERE IsActive = 1 ORDER BY ConfiguratorName"
        )).fetchall()
        sec_expr = (
            "Section" if column_exists(conn, "uCfgParameters", "Section")
            else "CAST(NULL AS NVARCHAR(50))"
        )
        params = conn.execute(text(
            "SELECT CfgID, ControlName, Label, Kind, IsRequired, IsVisible, "
            f"SortOrder, MinValue, MaxValue, StepValue, HelpText, {sec_expr} AS Section "
            "FROM dbo.uCfgParameters ORDER BY CfgID, SortOrder"
        )).fetchall()
        options = conn.execute(text(
            "SELECT p.CfgID, p.ControlName, o.OptionValue, o.OptionLabel "
            "FROM dbo.uCfgParameterOptions o "
            "JOIN dbo.uCfgParameters p ON o.ParamID = p.ParamID "
            "WHERE o.IsActive = 1 ORDER BY p.CfgID, p.SortOrder, o.SortOrder"
        )).fetchall()
        # SpecName names the customer specification a default belongs to.
        # Without it the Defaults tab shows a specification's rows as 174
        # entries with no door model and nothing to say why they exist.
        spec_expr = (
            "SpecName" if column_exists(conn, "uCfgDefaults", "SpecName")
            else "CAST(NULL AS NVARCHAR(100))"
        )
        defaults = conn.execute(text(
            "SELECT CfgID, DoorModel, ControlName, DefaultValue, "
            f"{spec_expr} AS SpecName "
            "FROM dbo.uCfgDefaults ORDER BY CfgID, DoorModel, ControlName"
        )).fetchall()

    opts_by: dict = defaultdict(list)
    for cfg_id, control, value, label in options:
        opts_by[(cfg_id, control)].append({"value": value, "label": label})

    defaults_by: dict = defaultdict(list)
    for cfg_id, model, control, value, spec in defaults:
        row = {"doorModel": model, "controlName": control, "value": value}
        if spec:
            row["specName"] = spec
        defaults_by[cfg_id].append(row)

    params_by: dict = defaultdict(list)
    for (cfg_id, control, label, kind, required, visible, order,
         min_v, max_v, step_v, help_text, section) in params:
        param = {
            "controlName": control,
            "label": label,
            "kind": kind,
            "required": bool(required),
            "isVisible": bool(visible),
            "options": opts_by.get((cfg_id, control), []),
        }
        if min_v is not None:
            param["min"] = float(min_v)
        if max_v is not None:
            param["max"] = float(max_v)
        if step_v is not None:
            param["step"] = float(step_v)
        if help_text:
            param["helpText"] = help_text
        if section:
            param["section"] = section
        params_by[cfg_id].append(param)

    return [
        {
            "id": part_id,
            "name": name,
            "doorTypeFilter": door_type,
            # Blank is a real value here, not a missing one: two of the three
            # configurators in M1 carry an empty revision.
            "partRevision": "" if revision is None else revision,
            "parameters": params_by.get(cfg_id, []),
            "defaults": defaults_by.get(cfg_id, []),
        }
        for (cfg_id, part_id, name, door_type, revision) in configs
    ]


def load_links() -> list[dict]:
    """Which sub-configurators run under each door configurator."""
    engine = get_config_engine()
    with engine.connect() as conn:
        if not column_exists(conn, "uCfgConfiguratorLinks", "LinkID"):
            return []
        rows = conn.execute(text(
            "SELECT ParentPartID, ChildPartID, LinkType, IsAutomatic, Notes "
            "FROM dbo.uCfgConfiguratorLinks ORDER BY ParentPartID, SortOrder"
        )).fetchall()
    return [
        {
            "parentId": r[0],
            "childId": r[1],
            "linkType": r[2],
            "isAutomatic": bool(r[3]),
            "notes": r[4],
        }
        for r in rows
    ]


def load_rules(configurator_id: str | None = None) -> list[dict]:
    """Pricing / upgrade rules with their conditions (uCfgRules + conditions)."""
    engine = get_config_engine()
    with engine.connect() as conn:
        if not column_exists(conn, "uCfgRules", "RuleID"):
            return []
        has_qty = column_exists(conn, "uCfgRules", "QuantityUnit")
        extra = (
            ", r.QuantityUnit, r.AHFactor, r.SwiPairDoubles, r.QuantityFormula, r.Notes"
            if has_qty
            else ", NULL, NULL, NULL, NULL, NULL"
        )
        extra += (", r.ResultRevisionFormula"
                  if column_exists(conn, "uCfgRules", "ResultRevisionFormula")
                  else ", NULL")
        extra += (", r.ConditionFormula"
                  if column_exists(conn, "uCfgRules", "ConditionFormula")
                  else ", NULL")
        where = "WHERE c.PartID = :pid" if configurator_id else ""
        rules = conn.execute(
            text(
                "SELECT r.RuleID, c.PartID, r.RuleCode, r.Name, r.Category, "
                "r.ResultPartID, r.ResultRevision, r.Quantity, r.IsActive" + extra + " "
                "FROM dbo.uCfgRules r "
                "JOIN dbo.uCfgConfigurators c ON r.CfgID = c.CfgID "
                f"{where} ORDER BY r.RuleCode"
            ),
            {"pid": configurator_id} if configurator_id else {},
        ).fetchall()
        conds = conn.execute(text(
            "SELECT rc.RuleID, rc.GroupNo, rc.ControlName, rc.Operator, rc.CompareValue "
            "FROM dbo.uCfgRuleConditions rc ORDER BY rc.RuleID, rc.GroupNo, rc.ConditionID"
        )).fetchall()

    conds_by: dict = defaultdict(list)
    for rid, group_no, control, operator, compare in conds:
        conds_by[rid].append({
            "controlName": control,
            "operator": operator,
            "value": compare or "",
            "groupNo": group_no or 1,
        })

    out = []
    for (rid, part_id, code, name, category, result_part, result_rev, qty, active,
         q_unit, ah, swi, formula, notes, rev_formula, cond_formula) in rules:
        rule = {
            "id": code,
            "configuratorId": part_id,
            "name": name,
            "category": category,
            "resultPartId": result_part or "",
            "quantity": str(qty or "1"),
            "isActive": bool(active),
            "conditions": conds_by.get(rid, []),
        }
        if result_rev:
            rule["resultRevision"] = result_rev
        if q_unit:
            rule["quantityUnit"] = q_unit
        if ah is not None:
            rule["ahFactor"] = int(ah)
        if swi is not None:
            rule["swiPairDoubles"] = bool(swi)
        if formula:
            rule["quantityFormula"] = formula
        if notes:
            rule["notes"] = notes
        if rev_formula:
            rule["resultRevisionFormula"] = rev_formula
        if cond_formula:
            rule["conditionFormula"] = cond_formula
        out.append(rule)
    return out


def load_field_map() -> list[dict]:
    """App-field → M1-column mappings (from uCfgM1FieldMap)."""
    engine = get_config_engine()
    with engine.connect() as conn:
        if not column_exists(conn, "uCfgM1FieldMap", "MapID"):
            return []
        rows = conn.execute(text(
            "SELECT Entity, AppField, M1Column, Constant, Notes FROM dbo.uCfgM1FieldMap "
            "ORDER BY Entity, AppField"
        )).fetchall()
    return [
        {"entity": r[0], "appField": r[1], "m1Column": r[2], "constant": r[3], "notes": r[4]}
        for r in rows
    ]


def load_validation_rules(configurator_id: str) -> list[dict]:
    engine = get_config_engine()
    with engine.connect() as conn:
        rules = conn.execute(text(
            "SELECT r.ValidationID, r.RuleCode, r.Severity, r.TargetField, r.Message, r.CalculatorRef "
            "FROM dbo.uCfgValidationRules r "
            "JOIN dbo.uCfgConfigurators c ON r.CfgID = c.CfgID "
            "WHERE c.PartID = :pid AND r.IsActive = 1"
        ), {"pid": configurator_id}).fetchall()
        conds = conn.execute(text(
            "SELECT vc.ValidationID, vc.GroupNo, vc.ControlName, vc.Operator, vc.CompareValue "
            "FROM dbo.uCfgValidationConditions vc "
            "JOIN dbo.uCfgValidationRules r ON vc.ValidationID = r.ValidationID "
            "JOIN dbo.uCfgConfigurators c ON r.CfgID = c.CfgID "
            "WHERE c.PartID = :pid"
        ), {"pid": configurator_id}).fetchall()

    conds_by: dict = defaultdict(list)
    for vid, group_no, control, operator, compare in conds:
        conds_by[vid].append({
            "groupNo": group_no,
            "controlName": control,
            "operator": operator,
            "compareValue": compare,
        })

    return [
        {
            "ruleCode": code,
            "severity": severity,
            "targetField": field,
            "message": message,
            "calculatorRef": calc_ref,
            "conditions": conds_by.get(vid, []),
        }
        for (vid, code, severity, field, message, calc_ref) in rules
    ]
