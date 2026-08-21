"""Writes configurator DEFINITION changes to the config DB (uCfg* tables).

Uses only base-schema columns so it works whether or not the audit-columns
migration has been applied. Every create/update/delete is recorded in
dbo.uCfgChangeLog (best-effort — a missing log table never blocks a save).
"""
import json

from sqlalchemy import text

from . import config_repo, settings


class ParameterInUse(Exception):
    """Raised when a parameter cannot be deleted because rules depend on it.

    Carries the usage so the caller can show what is in the way and offer to
    remove it, rather than just refusing.
    """

    def __init__(self, message: str, usage: dict):
        super().__init__(message)
        self.usage = usage


def _cfg_id(conn, configurator_id: str):
    row = conn.execute(
        text("SELECT CfgID FROM dbo.uCfgConfigurators WHERE PartID = :pid"),
        {"pid": configurator_id},
    ).fetchone()
    return row[0] if row else None


def _set_options(conn, param_id, options: list) -> None:
    """Replace a parameter's option list (delete existing + insert new)."""
    conn.execute(text("DELETE FROM dbo.uCfgParameterOptions WHERE ParamID=:pid"), {"pid": param_id})
    for i, opt in enumerate(options or [], start=1):
        conn.execute(text(
            "INSERT INTO dbo.uCfgParameterOptions (ParamID, OptionValue, OptionLabel, SortOrder) "
            "VALUES (:pid, :v, :l, :s)"
        ), {"pid": param_id, "v": opt.get("value", ""), "l": opt.get("label", ""), "s": i})


# ---------------------------------------------------------------------------
# Change log
# ---------------------------------------------------------------------------
def _log_change(engine, primary_table, record_key, action, old_value, new_value, changed_by):
    """Write one audit row. Best-effort: swallow errors (e.g. table not yet
    created) so logging can never break a configuration save."""
    try:
        with engine.begin() as conn:
            conn.execute(
                text(
                    "INSERT INTO dbo.uCfgChangeLog "
                    "(PrimaryTable, RecordKey, Action, OldValue, NewValue, ChangedBy) "
                    "VALUES (:t, :k, :a, :ov, :nv, :by)"
                ),
                {
                    "t": primary_table,
                    "k": record_key,
                    "a": action,
                    "ov": None if old_value is None else json.dumps(old_value, default=str),
                    "nv": None if new_value is None else json.dumps(new_value, default=str),
                    "by": changed_by or "admin",
                },
            )
    except Exception:  # pragma: no cover - logging must never break a save
        pass


def replace_rules(configurator_id: str, rules: list[dict], changed_by: str = "admin") -> dict:
    """Replace the whole rule set for a configurator (uCfgRules + conditions).

    Used by the admin Save and the rules CSV import so edits survive a refresh.
    """
    engine = config_repo.get_config_engine()
    with engine.begin() as conn:
        cfg_id = _cfg_id(conn, configurator_id)
        if cfg_id is None:
            raise ValueError(f"Configurator '{configurator_id}' not found")

        has_qty = config_repo.column_exists(conn, "uCfgRules", "QuantityUnit")
        before = conn.execute(
            text("SELECT COUNT(*) FROM dbo.uCfgRules WHERE CfgID = :c"), {"c": cfg_id}
        ).scalar() or 0

        # clear existing rules + their conditions for this configurator
        conn.execute(text(
            "DELETE rc FROM dbo.uCfgRuleConditions rc "
            "JOIN dbo.uCfgRules r ON rc.RuleID = r.RuleID WHERE r.CfgID = :c"
        ), {"c": cfg_id})
        conn.execute(text("DELETE FROM dbo.uCfgRules WHERE CfgID = :c"), {"c": cfg_id})

        inserted = 0
        skipped: list[dict] = []
        for r in rules:
            code = (r.get("id") or "").strip()
            if not code:
                continue
            # Save each rule in its own savepoint so one bad row cannot roll back
            # the whole import — the good rules still land.
            nested = conn.begin_nested()
            try:
                cols = ("CfgID, RuleCode, Name, Category, ResultPartID, ResultRevision, "
                        "Quantity, IsActive, CreatedBy")
                vals = ":c, :code, :name, :cat, :part, :rev, :qty, :active, :by"
                params = {
                    "c": cfg_id,
                    "code": code,
                    "name": r.get("name") or code,
                    "cat": r.get("category") or "MATERIAL_UPGRADE",
                    "part": r.get("resultPartId") or None,
                    "rev": r.get("resultRevision") or None,
                    "qty": str(r.get("quantity") or "1"),
                    "active": 0 if r.get("isActive") is False else 1,
                    "by": changed_by,
                }
                if config_repo.column_exists(conn, "uCfgRules", "ResultRevisionFormula"):
                    cols += ", ResultRevisionFormula"
                    vals += ", :revformula"
                    params["revformula"] = r.get("resultRevisionFormula") or None
                if config_repo.column_exists(conn, "uCfgRules", "ConditionFormula"):
                    cols += ", ConditionFormula"
                    vals += ", :condformula"
                    params["condformula"] = r.get("conditionFormula") or None
                if has_qty:
                    cols += ", QuantityUnit, AHFactor, SwiPairDoubles, QuantityFormula, Notes"
                    vals += ", :unit, :ah, :swi, :formula, :notes"
                    params.update({
                        "unit": r.get("quantityUnit") or None,
                        "ah": r.get("ahFactor") if r.get("ahFactor") is not None else None,
                        "swi": 1 if r.get("swiPairDoubles") else 0,
                        "formula": r.get("quantityFormula") or None,
                        "notes": r.get("notes") or None,
                    })
                conn.execute(text(f"INSERT INTO dbo.uCfgRules ({cols}) VALUES ({vals})"), params)

                rule_id = conn.execute(
                    text("SELECT RuleID FROM dbo.uCfgRules WHERE CfgID=:c AND RuleCode=:code"),
                    {"c": cfg_id, "code": code},
                ).scalar()
                for cond in r.get("conditions") or []:
                    control = (cond.get("controlName") or "").strip()
                    if not control:
                        continue
                    conn.execute(text(
                        "INSERT INTO dbo.uCfgRuleConditions (RuleID, GroupNo, ControlName, Operator, CompareValue) "
                        "VALUES (:r, :g, :cn, :op, :v)"
                    ), {
                        "r": rule_id,
                        "g": int(cond.get("groupNo") or 1),
                        "cn": control,
                        "op": cond.get("operator") or "equals",
                        "v": cond.get("value") or None,
                    })
                nested.commit()
                inserted += 1
            except Exception as exc:  # this rule only — the rest still save
                nested.rollback()
                skipped.append({"id": code, "reason": _short_db_error(exc)})

    _log_change(
        engine, "uCfgRules", configurator_id, "REPLACE",
        {"count": before}, {"count": inserted}, changed_by,
    )
    return {"deleted": before, "inserted": inserted, "skipped": skipped}


def _short_db_error(exc: Exception) -> str:
    """Turn a driver traceback into something an admin can act on."""
    msg = str(exc)
    if "would be truncated" in msg:
        col = ""
        if "column '" in msg:
            col = msg.split("column '")[1].split("'")[0].split(".")[-1]
        val = ""
        if "Truncated value: '" in msg:
            val = msg.split("Truncated value: '")[1].split("'")[0]
        return f"Value too long for {col or 'a column'}" + (f" (starts '{val}')" if val else "")
    for marker in ("[SQL Server]", "]"):
        if marker in msg:
            msg = msg.split(marker)[-1]
    return msg.strip()[:180] or "Insert failed"


def save_field_map(entries: list[dict], changed_by: str = "admin") -> dict:
    """Upsert app-field → M1-column mappings (by Entity + AppField)."""
    engine = config_repo.get_config_engine()
    saved = 0
    with engine.begin() as conn:
        for e in entries:
            entity = e.get("entity")
            app_field = e.get("appField")
            if not entity or not app_field:
                continue
            params = {
                "e": entity,
                "a": app_field,
                "m": e.get("m1Column") or None,
                "c": e.get("constant") or None,
                "by": changed_by,
            }
            existing = conn.execute(
                text("SELECT MapID FROM dbo.uCfgM1FieldMap WHERE Entity=:e AND AppField=:a"),
                {"e": entity, "a": app_field},
            ).fetchone()
            if existing:
                conn.execute(text(
                    "UPDATE dbo.uCfgM1FieldMap SET M1Column=:m, Constant=:c, "
                    "ModifiedDate=GETDATE(), ModifiedBy=:by WHERE MapID=:id"
                ), {**params, "id": existing[0]})
            else:
                conn.execute(text(
                    "INSERT INTO dbo.uCfgM1FieldMap (Entity, AppField, M1Column, Constant, ModifiedBy) "
                    "VALUES (:e, :a, :m, :c, :by)"
                ), params)
            saved += 1
    return {"saved": saved}


def replace_defaults(configurator_id: str, defaults: list[dict], changed_by: str = "admin") -> dict:
    """Replace the whole defaults set (DoorModel → ControlName = value) for a
    configurator. Used by the defaults CSV import."""
    engine = config_repo.get_config_engine()
    with engine.begin() as conn:
        cfg_id = _cfg_id(conn, configurator_id)
        if cfg_id is None:
            raise ValueError(f"Configurator '{configurator_id}' not found")
        before = conn.execute(
            text("SELECT COUNT(*) FROM dbo.uCfgDefaults WHERE CfgID=:c"), {"c": cfg_id}
        ).scalar() or 0
        conn.execute(text("DELETE FROM dbo.uCfgDefaults WHERE CfgID=:c"), {"c": cfg_id})
        inserted = 0
        for d in defaults:
            conn.execute(text(
                "INSERT INTO dbo.uCfgDefaults (CfgID, DoorModel, ControlName, DefaultValue) "
                "VALUES (:c, :m, :cn, :v)"
            ), {
                "c": cfg_id,
                "m": d.get("doorModel", ""),
                "cn": d.get("controlName", ""),
                "v": d.get("value", ""),
            })
            inserted += 1

    _log_change(
        engine, "uCfgDefaults", configurator_id, "REPLACE",
        {"count": before}, {"count": inserted}, changed_by,
    )
    return {"deleted": before, "inserted": inserted}


class DefaultExists(Exception):
    """Raised when moving a default would collide with one already there.

    UQ_uCfgDefaults is (CfgID, ParentPartID, DoorModel, ControlName) — plus
    SpecName once that migration has run — so re-pointing a default at another
    door model can land on a row that already exists. Caught before the write
    so the message names the clash instead of surfacing "Msg 2627".
    """


def _find_default(conn, cfg_id, door_model, control_name):
    """One default row, matched the way the unique key does.

    A NULL DoorModel has to be matched with IS NULL: `DoorModel = NULL` is
    never true, so equality would silently miss every conditional and manual
    default and look like the row did not exist.
    """
    clause = (
        "DoorModel IS NULL" if door_model is None
        else "UPPER(DoorModel) = UPPER(:m)"
    )
    params = {"c": cfg_id, "cn": control_name}
    if door_model is not None:
        params["m"] = door_model
    return conn.execute(text(
        f"SELECT DefaultID, DefaultValue, IsManual FROM dbo.uCfgDefaults "
        f"WHERE CfgID = :c AND UPPER(ControlName) = UPPER(:cn) AND {clause}"
    ), params).fetchone()


def update_default(
    configurator_id: str,
    door_model: str | None,
    control_name: str,
    value: str,
    changed_by: str = "admin",
    new_door_model: str | None = None,
    move: bool = False,
) -> dict:
    """Change ONE default's value, leaving every other column alone.

    Deliberately narrow, for the same reason update_layout() is. The bulk path,
    replace_defaults(), deletes the whole set and re-inserts four columns --
    which drops Priority, ValueFormula, IsManual and ParentPartID, and cannot
    delete a row that uCfgDefaultConditions references at all
    (FK_uCfgDefCond_Default is NO_ACTION). Editing a single value must not go
    anywhere near that.

    A NULL door model identifies a conditional or manual default. Those are
    matched on IS NULL rather than equality, so editing one does not silently
    create a second row.
    """
    engine = config_repo.get_config_engine()
    with engine.begin() as conn:
        cfg_id = _cfg_id(conn, configurator_id)
        if cfg_id is None:
            raise ValueError(f"Configurator '{configurator_id}' not found")

        row = _find_default(conn, cfg_id, door_model, control_name)
        if row is None:
            raise ValueError(
                f"No default for '{control_name}' on "
                f"{door_model or 'all models'} in this configurator."
            )

        default_id, old_value, is_manual = row[0], row[1], row[2]

        # Moving to another door model. Checked here rather than left to the
        # unique constraint so the message says which row is in the way.
        target = (new_door_model or None) if move else None
        moving = move and (target or None) != (door_model or None)
        if moving:
            clash = _find_default(conn, cfg_id, target, control_name)
            if clash is not None and clash[0] != default_id:
                raise DefaultExists(
                    f"{control_name} already has a default for "
                    f"{target or 'all models'}. Edit that one instead, or "
                    "delete it first."
                )

        if is_manual:
            # Manual defaults (freight and similar) are never applied
            # automatically. Giving one a value here would look like it had
            # taken effect when nothing reads it.
            raise ValueError(
                f"'{control_name}' is a manual default and is not pre-filled "
                "automatically, so setting a value here would have no effect."
            )

        if moving:
            conn.execute(text(
                "UPDATE dbo.uCfgDefaults SET DefaultValue = :v, DoorModel = :m "
                "WHERE DefaultID = :id"
            ), {"v": value, "m": target, "id": default_id})
        else:
            conn.execute(text(
                "UPDATE dbo.uCfgDefaults SET DefaultValue = :v WHERE DefaultID = :id"
            ), {"v": value, "id": default_id})

    _log_change(
        engine, "uCfgDefaults", configurator_id, "UPDATE",
        {"controlName": control_name, "doorModel": door_model, "value": old_value},
        {"controlName": control_name, "doorModel": door_model, "value": value},
        changed_by,
    )
    return {
        "controlName": control_name,
        "doorModel": target if moving else door_model,
        "movedFrom": door_model if moving else None,
        "from": old_value,
        "to": value,
    }


def delete_default(
    configurator_id: str,
    door_model: str | None,
    control_name: str,
    changed_by: str = "admin",
) -> dict:
    """Delete one default row.

    Its conditions go first: FK_uCfgDefCond_Default is NO_ACTION, so deleting a
    default that a condition points at fails outright rather than cascading.
    That is the whole reason replace_defaults() cannot be used to remove a
    single conditional default.
    """
    engine = config_repo.get_config_engine()
    with engine.begin() as conn:
        cfg_id = _cfg_id(conn, configurator_id)
        if cfg_id is None:
            raise ValueError(f"Configurator '{configurator_id}' not found")

        row = _find_default(conn, cfg_id, door_model, control_name)
        if row is None:
            raise ValueError(
                f"No default for '{control_name}' on "
                f"{door_model or 'all models'} in this configurator."
            )
        default_id, old_value = row[0], row[1]

        conditions = conn.execute(text(
            "DELETE FROM dbo.uCfgDefaultConditions WHERE DefaultID = :id"
        ), {"id": default_id}).rowcount or 0
        conn.execute(text(
            "DELETE FROM dbo.uCfgDefaults WHERE DefaultID = :id"
        ), {"id": default_id})

    _log_change(
        engine, "uCfgDefaults", configurator_id, "DELETE",
        {"controlName": control_name, "doorModel": door_model, "value": old_value},
        None, changed_by,
    )
    return {
        "controlName": control_name,
        "doorModel": door_model,
        "conditionsRemoved": conditions,
    }


def create_configurator(
    part_id: str,
    name: str,
    door_type: str | None = None,
    part_revision: str = "A",
    description: str | None = None,
    changed_by: str = "admin",
) -> dict:
    """Insert a new configurator template row into uCfgConfigurators."""
    engine = config_repo.get_config_engine()
    with engine.begin() as conn:
        existing = conn.execute(
            text(
                "SELECT 1 FROM dbo.uCfgConfigurators "
                "WHERE PartID = :pid AND ISNULL(PartRevision,'') = ISNULL(:rev,'')"
            ),
            {"pid": part_id, "rev": part_revision},
        ).fetchone()
        if existing:
            raise ValueError(f"Configurator '{part_id}' (rev {part_revision}) already exists")

        conn.execute(
            text(
                "INSERT INTO dbo.uCfgConfigurators "
                "(PartID, PartRevision, PartDescription, ConfiguratorName, DoorType) "
                "VALUES (:pid, :rev, :desc, :name, :dt)"
            ),
            {
                "pid": part_id,
                "rev": part_revision or None,
                "desc": description or name,
                "name": name,
                "dt": (door_type or None),
            },
        )

    _log_change(
        engine, "uCfgConfigurators", part_id, "INSERT", None,
        {"partId": part_id, "name": name, "doorType": door_type, "partRevision": part_revision},
        changed_by,
    )
    return {"ok": True, "id": part_id}


def _read_param_full(conn, cfg_id, control):
    """Snapshot of a parameter (for the change log's OldValue)."""
    row = conn.execute(
        text(
            "SELECT ParamID, Label, Kind, IsRequired, MinValue, MaxValue, StepValue, HelpText "
            "FROM dbo.uCfgParameters WHERE CfgID = :c AND ControlName = :cn"
        ),
        {"c": cfg_id, "cn": control},
    ).fetchone()
    if not row:
        return None
    opts = conn.execute(
        text("SELECT OptionValue FROM dbo.uCfgParameterOptions WHERE ParamID = :p ORDER BY SortOrder"),
        {"p": row[0]},
    ).fetchall()
    return {
        "controlName": control,
        "label": row[1],
        "kind": row[2],
        "required": bool(row[3]),
        "min": row[4],
        "max": row[5],
        "step": row[6],
        "helpText": row[7],
        "options": [o[0] for o in opts],
    }


def _input_snapshot(param):
    return {
        "controlName": param.get("controlName"),
        "label": param.get("label"),
        "kind": param.get("kind"),
        "required": bool(param.get("required")),
        "min": param.get("min"),
        "max": param.get("max"),
        "step": param.get("step"),
        "helpText": param.get("helpText"),
        "options": [o.get("value", "") for o in (param.get("options") or [])],
    }


# ---------------------------------------------------------------------------
# Single-parameter writes
# ---------------------------------------------------------------------------
def upsert_parameter(configurator_id: str, param: dict, changed_by: str = "admin") -> dict:
    """Update an existing parameter (by control name) or insert a new one, then
    replace its options. Preserves IsVisible / SortOrder on update."""
    engine = config_repo.get_config_engine()
    old_snap = None
    with engine.begin() as conn:  # transaction
        cfg_id = _cfg_id(conn, configurator_id)
        if cfg_id is None:
            raise ValueError(f"Configurator '{configurator_id}' not found")

        control = param["controlName"]
        old_snap = _read_param_full(conn, cfg_id, control)
        has_section = config_repo.column_exists(conn, "uCfgParameters", "Section")
        # Without the column the statements below quietly drop Section and still
        # report success, so the admin UI says "saved" and the value vanishes.
        # Only object when a section was actually supplied — saving a parameter
        # that has no section is legitimate on an un-migrated database.
        if not has_section and (param.get("section") or "").strip():
            raise ValueError(
                "This database has no uCfgParameters.Section column, so the "
                "section cannot be saved — run db/uCfg_add_section.sql against "
                f"'{settings.CONFIG_DB_NAME}' first."
            )

        vals = {
            "label": param.get("label") or control,
            "kind": param.get("kind") or "text",
            "req": 1 if param.get("required") else 0,
            "mn": param.get("min"),
            "mx": param.get("max"),
            "st": param.get("step"),
            "help": param.get("helpText"),
            "sec": param.get("section"),
        }

        if old_snap:
            param_id = conn.execute(
                text("SELECT ParamID FROM dbo.uCfgParameters WHERE CfgID=:c AND ControlName=:cn"),
                {"c": cfg_id, "cn": control},
            ).scalar()
            set_sec = ", Section=:sec" if has_section else ""
            conn.execute(text(
                "UPDATE dbo.uCfgParameters SET Label=:label, Kind=:kind, IsRequired=:req, "
                f"MinValue=:mn, MaxValue=:mx, StepValue=:st, HelpText=:help{set_sec} WHERE ParamID=:pid"
            ), {**vals, "pid": param_id})
        else:
            is_visible = 0 if param.get("isVisible") is False else 1
            next_order = conn.execute(
                text("SELECT ISNULL(MAX(SortOrder),0)+1 FROM dbo.uCfgParameters WHERE CfgID=:c"),
                {"c": cfg_id},
            ).scalar()
            sec_col = ", Section" if has_section else ""
            sec_val = ", :sec" if has_section else ""
            conn.execute(text(
                "INSERT INTO dbo.uCfgParameters (CfgID, ControlName, Label, Kind, IsRequired, "
                f"IsVisible, SortOrder, MinValue, MaxValue, StepValue, HelpText{sec_col}) "
                f"VALUES (:c, :cn, :label, :kind, :req, :vis, :ord, :mn, :mx, :st, :help{sec_val})"
            ), {**vals, "c": cfg_id, "cn": control, "vis": is_visible, "ord": next_order})
            param_id = conn.execute(
                text("SELECT ParamID FROM dbo.uCfgParameters WHERE CfgID=:c AND ControlName=:cn"),
                {"c": cfg_id, "cn": control},
            ).scalar()

        # replace options
        conn.execute(text("DELETE FROM dbo.uCfgParameterOptions WHERE ParamID=:pid"), {"pid": param_id})
        for i, opt in enumerate(param.get("options") or [], start=1):
            conn.execute(text(
                "INSERT INTO dbo.uCfgParameterOptions (ParamID, OptionValue, OptionLabel, SortOrder) "
                "VALUES (:pid, :v, :l, :s)"
            ), {"pid": param_id, "v": opt.get("value", ""), "l": opt.get("label", ""), "s": i})

    _log_change(
        engine, "uCfgParameters", f"{configurator_id}/{control}",
        "UPDATE" if old_snap else "INSERT", old_snap, _input_snapshot(param), changed_by,
    )
    return {"ok": True, "controlName": control}


def parameter_usage(configurator_id: str, control_name: str) -> dict:
    """Everything that refers to a parameter by name.

    Rule conditions, validation conditions and defaults all store a ControlName
    string rather than a foreign key to ParamID, so the database will happily
    delete a parameter and leave them pointing at a control that no longer
    exists. A condition naming a missing control silently stops matching -- it
    does not error -- so the loss shows up as a wrong quote, not a message.
    """
    engine = config_repo.get_config_engine()
    with engine.connect() as conn:
        cfg_id = _cfg_id(conn, configurator_id)
        if cfg_id is None:
            raise ValueError("Configurator '%s' not found" % configurator_id)

        rules = conn.execute(text(
            "SELECT DISTINCT r.RuleCode, r.Name, r.ResultPartID "
            "FROM dbo.uCfgRules r "
            "JOIN dbo.uCfgRuleConditions rc ON rc.RuleID = r.RuleID "
            "WHERE r.CfgID = :c AND UPPER(rc.ControlName) = UPPER(:cn) "
            "ORDER BY r.RuleCode"
        ), {"c": cfg_id, "cn": control_name}).fetchall()

        # A rule can also name a control only inside a formula, where it is
        # text rather than a condition row. LIKE is a blunt test, but missing
        # one of these is worse than naming one that merely looks similar.
        formula_rules = []
        if config_repo.column_exists(conn, "uCfgRules", "ConditionFormula"):
            formula_rules = conn.execute(text(
                "SELECT RuleCode, Name, ResultPartID FROM dbo.uCfgRules "
                "WHERE CfgID = :c AND ("
                "  UPPER(ISNULL(ConditionFormula,'')) LIKE '%' + UPPER(:cn) + '%'"
                "  OR UPPER(ISNULL(QuantityFormula,'')) LIKE '%' + UPPER(:cn) + '%'"
                "  OR UPPER(ISNULL(ResultRevisionFormula,'')) LIKE '%' + UPPER(:cn) + '%')"
                " ORDER BY RuleCode"
            ), {"c": cfg_id, "cn": control_name}).fetchall()

        validations = conn.execute(text(
            "SELECT DISTINCT v.RuleCode, v.Message "
            "FROM dbo.uCfgValidationRules v "
            "JOIN dbo.uCfgValidationConditions vc ON vc.ValidationID = v.ValidationID "
            "WHERE v.CfgID = :c AND ("
            "  UPPER(vc.ControlName) = UPPER(:cn) OR UPPER(ISNULL(v.TargetField,'')) = UPPER(:cn))"
            " ORDER BY v.RuleCode"
        ), {"c": cfg_id, "cn": control_name}).fetchall()

        defaults = conn.execute(text(
            "SELECT ISNULL(DoorModel, ''), ISNULL(DefaultValue, '') "
            "FROM dbo.uCfgDefaults WHERE CfgID = :c AND UPPER(ControlName) = UPPER(:cn)"
        ), {"c": cfg_id, "cn": control_name}).fetchall()

    seen = set(r[0] for r in rules)
    combined = [
        {"ruleCode": r[0], "name": r[1], "resultPartId": r[2], "via": "condition"}
        for r in rules
    ] + [
        {"ruleCode": r[0], "name": r[1], "resultPartId": r[2], "via": "formula"}
        for r in formula_rules if r[0] not in seen
    ]

    return {
        "controlName": control_name,
        "rules": combined,
        "validations": [{"ruleCode": v[0], "message": v[1]} for v in validations],
        "defaults": [{"doorModel": d[0], "value": d[1]} for d in defaults],
    }


def delete_parameter(
    configurator_id: str,
    control_name: str,
    changed_by: str = "admin",
    cascade: bool = False,
) -> dict:
    """Delete a parameter, its options, and its defaults.

    Defaults go unconditionally: a default for a control that no longer exists
    can only ever seed a field that is not on the form.

    Rules and validations are different. They are work someone did, and one may
    test several controls, so removing the parameter without them leaves a
    condition naming something that does not exist -- which stops matching
    quietly rather than erroring. This refuses unless cascade is set, and says
    exactly what is in the way.
    """
    usage = parameter_usage(configurator_id, control_name)
    blocking = usage["rules"] + usage["validations"]
    if blocking and not cascade:
        rules = ", ".join(r["ruleCode"] for r in usage["rules"]) or "none"
        vals = ", ".join(v["ruleCode"] for v in usage["validations"]) or "none"
        raise ParameterInUse(
            "'%s' is used by rules: %s; validations: %s." % (control_name, rules, vals),
            usage,
        )

    engine = config_repo.get_config_engine()
    old_snap = None
    removed = {"rules": 0, "validations": 0, "defaults": 0}

    with engine.begin() as conn:
        cfg_id = _cfg_id(conn, configurator_id)
        if cfg_id is not None:
            old_snap = _read_param_full(conn, cfg_id, control_name)
            if old_snap:
                param_id = conn.execute(
                    text("SELECT ParamID FROM dbo.uCfgParameters WHERE CfgID=:c AND ControlName=:cn"),
                    {"c": cfg_id, "cn": control_name},
                ).scalar()

                if cascade:
                    for code in [r["ruleCode"] for r in usage["rules"]]:
                        conn.execute(text(
                            "DELETE rc FROM dbo.uCfgRuleConditions rc "
                            "JOIN dbo.uCfgRules r ON r.RuleID = rc.RuleID "
                            "WHERE r.CfgID = :c AND r.RuleCode = :code"
                        ), {"c": cfg_id, "code": code})
                        conn.execute(text(
                            "DELETE FROM dbo.uCfgRules WHERE CfgID = :c AND RuleCode = :code"
                        ), {"c": cfg_id, "code": code})
                        removed["rules"] += 1
                    for code in [v["ruleCode"] for v in usage["validations"]]:
                        conn.execute(text(
                            "DELETE vc FROM dbo.uCfgValidationConditions vc "
                            "JOIN dbo.uCfgValidationRules v ON v.ValidationID = vc.ValidationID "
                            "WHERE v.CfgID = :c AND v.RuleCode = :code"
                        ), {"c": cfg_id, "code": code})
                        conn.execute(text(
                            "DELETE FROM dbo.uCfgValidationRules WHERE CfgID = :c AND RuleCode = :code"
                        ), {"c": cfg_id, "code": code})
                        removed["validations"] += 1

                # Default conditions first: FK_uCfgDefCond_Default is NO_ACTION,
                # so deleting a default while a condition points at it fails.
                conn.execute(text(
                    "DELETE dc FROM dbo.uCfgDefaultConditions dc "
                    "JOIN dbo.uCfgDefaults d ON d.DefaultID = dc.DefaultID "
                    "WHERE d.CfgID = :c AND UPPER(d.ControlName) = UPPER(:cn)"
                ), {"c": cfg_id, "cn": control_name})
                removed["defaults"] = conn.execute(text(
                    "DELETE FROM dbo.uCfgDefaults "
                    "WHERE CfgID = :c AND UPPER(ControlName) = UPPER(:cn)"
                ), {"c": cfg_id, "cn": control_name}).rowcount or 0

                conn.execute(text("DELETE FROM dbo.uCfgParameterOptions WHERE ParamID=:pid"), {"pid": param_id})
                conn.execute(text("DELETE FROM dbo.uCfgParameters WHERE ParamID=:pid"), {"pid": param_id})

    if old_snap:
        _log_change(
            engine, "uCfgParameters", f"{configurator_id}/{control_name}",
            "DELETE", old_snap, None, changed_by,
        )
    return {"ok": True, "removed": removed}


# ---------------------------------------------------------------------------
# Bulk replace (CSV import)
# ---------------------------------------------------------------------------
def replace_parameters(configurator_id: str, params: list[dict], changed_by: str = "admin") -> dict:
    """Replace the parameter *set* for a configurator from an imported list.

    - Control names present in `params` are upserted. For existing ones only
      Label + Kind are changed (options / bounds / required are preserved), so
      an import of just Control Name / Label / Type never wipes richer settings.
    - Control names NOT in `params` are deleted.
    Returns counts + logs every change to uCfgChangeLog.
    """
    engine = config_repo.get_config_engine()
    created = updated = deleted = 0
    pending_logs: list[tuple] = []  # (record_key, action, old, new)

    with engine.begin() as conn:
        cfg_id = _cfg_id(conn, configurator_id)
        if cfg_id is None:
            raise ValueError(f"Configurator '{configurator_id}' not found")

        has_section = config_repo.column_exists(conn, "uCfgParameters", "Section")
        rows = conn.execute(
            text("SELECT ParamID, ControlName, Label, Kind FROM dbo.uCfgParameters WHERE CfgID=:c"),
            {"c": cfg_id},
        ).fetchall()
        existing = {
            r[1].upper(): {"id": r[0], "controlName": r[1], "label": r[2], "kind": r[3]}
            for r in rows
        }
        max_order = conn.execute(
            text("SELECT ISNULL(MAX(SortOrder),0) FROM dbo.uCfgParameters WHERE CfgID=:c"),
            {"c": cfg_id},
        ).scalar() or 0

        imported_keys = set()
        for p in params:
            control = p["controlName"]
            key = control.upper()
            imported_keys.add(key)
            label = p.get("label") or control
            kind = p.get("kind") or "text"

            options = p.get("options")  # None = leave options untouched
            section = p.get("section")
            if key in existing:
                ex = existing[key]
                set_sec = ", Section=:sec" if has_section else ""
                conn.execute(
                    text(f"UPDATE dbo.uCfgParameters SET Label=:l, Kind=:k{set_sec} WHERE ParamID=:id"),
                    {"l": label, "k": kind, "sec": section, "id": ex["id"]},
                )
                if options is not None:
                    _set_options(conn, ex["id"], options)
                updated += 1
                pending_logs.append((
                    f"{configurator_id}/{control}", "UPDATE",
                    {"label": ex["label"], "kind": ex["kind"]},
                    {"label": label, "kind": kind},
                ))
            else:
                max_order += 1
                sec_col = ", Section" if has_section else ""
                sec_val = ", :sec" if has_section else ""
                conn.execute(text(
                    "INSERT INTO dbo.uCfgParameters "
                    f"(CfgID, ControlName, Label, Kind, IsRequired, IsVisible, SortOrder{sec_col}) "
                    f"VALUES (:c, :cn, :l, :k, 0, 1, :o{sec_val})"
                ), {"c": cfg_id, "cn": control, "l": label, "k": kind, "o": max_order, "sec": section})
                if options is not None:
                    new_id = conn.execute(
                        text("SELECT ParamID FROM dbo.uCfgParameters WHERE CfgID=:c AND ControlName=:cn"),
                        {"c": cfg_id, "cn": control},
                    ).scalar()
                    _set_options(conn, new_id, options)
                created += 1
                pending_logs.append((
                    f"{configurator_id}/{control}", "INSERT", None,
                    {"label": label, "kind": kind},
                ))

        for key, ex in existing.items():
            if key not in imported_keys:
                conn.execute(text("DELETE FROM dbo.uCfgParameterOptions WHERE ParamID=:id"), {"id": ex["id"]})
                conn.execute(text("DELETE FROM dbo.uCfgParameters WHERE ParamID=:id"), {"id": ex["id"]})
                deleted += 1
                pending_logs.append((
                    f"{configurator_id}/{ex['controlName']}", "DELETE",
                    {"label": ex["label"], "kind": ex["kind"]}, None,
                ))

    for record_key, action, old, new in pending_logs:
        _log_change(engine, "uCfgParameters", record_key, action, old, new, changed_by)

    return {"created": created, "updated": updated, "deleted": deleted, "applied": created + updated}


def update_layout(configurator_id: str, items: list[dict], changed_by: str = "admin") -> dict:
    """Move parameters between sections and reorder them.

    Deliberately narrow: it writes Section and SortOrder and NOTHING else.
    upsert_parameter() replaces a parameter's options every time it runs, so
    reusing it for a drag-and-drop would silently wipe dropdowns.

    Unknown control names are reported back rather than created.
    """
    engine = config_repo.get_config_engine()
    moved = 0
    unknown: list[str] = []
    changes: list[dict] = []

    with engine.begin() as conn:
        cfg_id = _cfg_id(conn, configurator_id)
        if cfg_id is None:
            raise ValueError(f"Configurator '{configurator_id}' not found")
        if not config_repo.column_exists(conn, "uCfgParameters", "Section"):
            raise ValueError(
                "This database has no uCfgParameters.Section column — "
                "run db/uCfg_add_section.sql first."
            )

        existing = {
            r[0].upper(): {"id": r[1], "section": r[2], "order": r[3]}
            for r in conn.execute(text(
                "SELECT ControlName, ParamID, Section, SortOrder "
                "FROM dbo.uCfgParameters WHERE CfgID=:c"
            ), {"c": cfg_id}).fetchall()
        }

        for order, item in enumerate(items, start=1):
            control = (item.get("controlName") or "").strip()
            row = existing.get(control.upper())
            if not row:
                unknown.append(control)
                continue
            section = (item.get("section") or "").strip() or None
            if row["section"] == section and row["order"] == order:
                continue
            conn.execute(text(
                "UPDATE dbo.uCfgParameters SET Section=:s, SortOrder=:o WHERE ParamID=:p"
            ), {"s": section, "o": order, "p": row["id"]})
            moved += 1
            changes.append({
                "controlName": control,
                "from": row["section"],
                "to": section,
                "sortOrder": order,
            })

    if changes:
        _log_change(
            engine, "uCfgParameters", f"{configurator_id}/layout", "UPDATE",
            None, {"moved": len(changes), "changes": changes[:50]}, changed_by,
        )
    return {"ok": True, "moved": moved, "unknown": unknown}
