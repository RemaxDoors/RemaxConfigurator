from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from .. import config_repo, config_write, defaults_engine, settings

router = APIRouter(tags=["configurators"])


class OptionIn(BaseModel):
    value: str = ""
    label: str = ""


class ParameterIn(BaseModel):
    controlName: str
    label: str
    kind: str
    required: bool = False
    isVisible: bool | None = None
    section: str | None = None
    min: float | None = None
    max: float | None = None
    step: float | None = None
    helpText: str | None = None
    options: list[OptionIn] = []


class ReplaceParamItem(BaseModel):
    controlName: str
    label: str
    kind: str
    section: str | None = None
    options: list[OptionIn] | None = None


class ReplaceParamsIn(BaseModel):
    parameters: list[ReplaceParamItem]
    changedBy: str | None = None


class DefaultItem(BaseModel):
    doorModel: str
    controlName: str
    value: str = ""


class ReplaceDefaultsIn(BaseModel):
    defaults: list[DefaultItem]
    changedBy: str | None = None


class RuleConditionIn(BaseModel):
    controlName: str
    operator: str
    value: str | None = None
    groupNo: int | None = 1


class RuleIn(BaseModel):
    id: str
    configuratorId: str | None = None
    name: str
    category: str
    resultPartId: str | None = None
    resultRevision: str | None = None
    resultRevisionFormula: str | None = None
    quantity: str = "1"
    quantityUnit: str | None = None
    ahFactor: int | None = None
    swiPairDoubles: bool | None = None
    quantityFormula: str | None = None
    conditionFormula: str | None = None
    notes: str | None = None
    isActive: bool = True
    conditions: list[RuleConditionIn] = []


class ReplaceRulesIn(BaseModel):
    rules: list[RuleIn]
    changedBy: str | None = None


class ConfiguratorIn(BaseModel):
    partId: str
    name: str
    doorType: str | None = None
    partRevision: str = "A"
    description: str | None = None
    changedBy: str | None = None


@router.get("/configurators")
def list_configurators():
    """Configurator definitions from the config DB.

    There is deliberately no fallback. Serving a stale or bundled definition
    when the database is unreachable lets a salesperson quote against the wrong
    parameters without anything looking broken — fail loudly instead.
    """
    if not settings.config_db_configured():
        raise HTTPException(
            status_code=503,
            detail="Config DB is not configured (set DB_* + CONFIG_DB_NAME).",
        )
    try:
        return {"configurators": config_repo.load_configurators(), "source": "db"}
    except Exception as exc:
        raise HTTPException(
            status_code=503, detail=f"Config DB unreachable: {exc}"
        )


class ResolveDefaultsIn(BaseModel):
    configuratorId: str
    values: dict = {}
    parentPartId: str | None = None


@router.post("/defaults/resolve")
def resolve_defaults(body: ResolveDefaultsIn):
    """Defaults that apply to the current selection (conditions + formulas)."""
    if not settings.config_db_configured():
        raise HTTPException(status_code=503, detail="Config DB not configured.")
    try:
        return defaults_engine.resolve_defaults(
            body.configuratorId, body.values or {}, body.parentPartId
        )
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=502, detail=f"Resolve failed: {exc}")


@router.get("/configurator-links")
def list_links():
    """Parent -> child configurator relationships (curtain / installation)."""
    if not settings.config_db_configured():
        return {"links": []}
    try:
        return {"links": config_repo.load_links()}
    except Exception:
        return {"links": []}


@router.get("/rules")
def list_rules(configuratorId: str | None = Query(default=None)):
    """Pricing rules from the config DB.

    No fallback, for the same reason as /configurators: quoting against a
    bundled copy of the rules is worse than not quoting at all. An empty list
    is a valid answer — a configurator with no rules yet — and is distinct
    from the database being unreachable, which raises.
    """
    if not settings.config_db_configured():
        raise HTTPException(
            status_code=503,
            detail="Config DB is not configured (set DB_* + CONFIG_DB_NAME).",
        )
    try:
        return {"rules": config_repo.load_rules(configuratorId), "source": "db"}
    except Exception as exc:
        raise HTTPException(
            status_code=503, detail=f"Config DB unreachable: {exc}"
        )


@router.post("/configurators/{configurator_id}/rules/replace")
def replace_rules(configurator_id: str, body: ReplaceRulesIn):
    """Save the rule set for a configurator (admin Save / CSV import)."""
    if not settings.config_db_configured():
        raise HTTPException(status_code=503, detail="Config DB not configured.")
    try:
        return config_write.replace_rules(
            configurator_id,
            [r.model_dump() for r in body.rules],
            body.changedBy or "admin",
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=502, detail=f"Save failed: {exc}")


class LayoutItem(BaseModel):
    controlName: str
    section: str | None = None


class LayoutIn(BaseModel):
    items: list[LayoutItem]
    changedBy: str | None = None


@router.post("/configurators/{configurator_id}/layout")
def update_layout(configurator_id: str, body: LayoutIn):
    """Move parameters between form sections and reorder them.

    Section + SortOrder only — options, labels and bounds are never touched.
    """
    if not settings.config_db_configured():
        raise HTTPException(status_code=503, detail="Config DB not configured.")
    try:
        return config_write.update_layout(
            configurator_id,
            [i.model_dump() for i in body.items],
            body.changedBy or "admin",
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=502, detail=f"Layout save failed: {exc}")


@router.post("/configurators")
def create_configurator(body: ConfiguratorIn):
    """Create a new configurator template (uCfgConfigurators row)."""
    if not settings.config_db_configured():
        raise HTTPException(status_code=503, detail="Config DB not configured.")
    try:
        return config_write.create_configurator(
            part_id=body.partId,
            name=body.name,
            door_type=body.doorType,
            part_revision=body.partRevision or "A",
            description=body.description,
            changed_by=body.changedBy or "admin",
        )
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=502, detail=f"Create failed: {exc}")


@router.post("/configurators/{configurator_id}/defaults/replace")
def replace_defaults(configurator_id: str, body: ReplaceDefaultsIn):
    """Bulk replace a configurator's defaults (DoorModel → ControlName = value)."""
    if not settings.config_db_configured():
        raise HTTPException(status_code=503, detail="Config DB not configured.")
    try:
        return config_write.replace_defaults(
            configurator_id,
            [d.model_dump() for d in body.defaults],
            body.changedBy or "admin",
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=502, detail=f"Import failed: {exc}")


@router.put("/configurators/{configurator_id}/parameters")
def upsert_parameter(configurator_id: str, param: ParameterIn):
    """Create or update a parameter definition (label, kind, options, etc.)
    in the config DB. This is what makes admin edits persist."""
    if not settings.config_db_configured():
        raise HTTPException(status_code=503, detail="Config DB not configured.")
    try:
        return config_write.upsert_parameter(configurator_id, param.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:  # pragma: no cover - surfaces DB errors to the UI
        raise HTTPException(status_code=502, detail=f"Save failed: {exc}")


@router.delete("/configurators/{configurator_id}/parameters/{control_name}")
def delete_parameter(configurator_id: str, control_name: str):
    if not settings.config_db_configured():
        raise HTTPException(status_code=503, detail="Config DB not configured.")
    try:
        return config_write.delete_parameter(configurator_id, control_name)
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=502, detail=f"Delete failed: {exc}")


@router.post("/configurators/{configurator_id}/parameters/replace")
def replace_parameters(configurator_id: str, body: ReplaceParamsIn):
    """Bulk replace a configurator's parameter set from a CSV import."""
    if not settings.config_db_configured():
        raise HTTPException(status_code=503, detail="Config DB not configured.")
    try:
        return config_write.replace_parameters(
            configurator_id,
            [p.model_dump() for p in body.parameters],
            body.changedBy or "admin",
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=502, detail=f"Import failed: {exc}")
