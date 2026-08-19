from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from .. import config_repo, config_write, m1_pricing, settings

router = APIRouter(tags=["mapping"])


class MapEntry(BaseModel):
    entity: str
    appField: str
    m1Column: str | None = None
    constant: str | None = None


class SaveMapIn(BaseModel):
    entries: list[MapEntry]
    changedBy: str | None = None


@router.get("/m1/columns")
def m1_columns(table: str = Query(...)):
    """Column list for an allowlisted M1 table (SELECT * WHERE 1=0)."""
    if not settings.db_configured():
        raise HTTPException(status_code=503, detail="M1 database not configured.")
    try:
        return {"table": table, "columns": m1_pricing.table_columns(table)}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=502, detail=f"Column read failed: {exc}")


@router.get("/mapping")
def get_mapping():
    if not settings.config_db_configured():
        raise HTTPException(status_code=503, detail="Config DB not configured.")
    try:
        return {"mappings": config_repo.load_field_map()}
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=502, detail=f"Mapping read failed: {exc}")


@router.put("/mapping")
def put_mapping(body: SaveMapIn):
    if not settings.config_db_configured():
        raise HTTPException(status_code=503, detail="Config DB not configured.")
    try:
        return config_write.save_field_map(
            [e.model_dump() for e in body.entries], body.changedBy or "admin"
        )
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=502, detail=f"Mapping save failed: {exc}")
