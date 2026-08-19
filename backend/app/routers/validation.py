from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from .. import settings, validation_engine

router = APIRouter(tags=["validation"])


class ValidateRequest(BaseModel):
    configuratorId: str
    values: dict


@router.post("/validate")
def validate(req: ValidateRequest):
    """Run the data-driven validation rules for a configurator against the
    selected values. Returns {errors, warnings, is_valid}."""
    if not settings.config_db_configured():
        raise HTTPException(
            status_code=503,
            detail="Config DB is not configured (set DB_* + CONFIG_DB_NAME).",
        )
    try:
        return validation_engine.evaluate(req.configuratorId, req.values)
    except Exception as exc:  # noqa: BLE001 - surface the DB/engine error
        raise HTTPException(status_code=502, detail=f"Validation failed: {exc}")
