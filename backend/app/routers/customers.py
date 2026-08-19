from fastapi import APIRouter, HTTPException, Query

from .. import m1, settings

router = APIRouter(tags=["customers"])


@router.get("/customers")
def search_customers(q: str = Query(default="")):
    if not settings.db_configured():
        raise HTTPException(
            status_code=503,
            detail="M1 database is not configured on the API server (set DB_* in api/.env).",
        )
    if len(q.strip()) < 2:
        return {"query": q, "results": []}
    try:
        return {"query": q, "results": m1.search_customers(q)}
    except Exception as exc:  # noqa: BLE001 - surface the DB error to the caller
        raise HTTPException(status_code=502, detail=f"M1 query failed: {exc}")


@router.get("/locations")
def list_locations(organizationId: str = Query(default="")):
    """Ship-to locations for an M1 organization."""
    if not settings.db_configured():
        raise HTTPException(status_code=503, detail="M1 database is not configured.")
    if not organizationId.strip():
        return {"organizationId": organizationId, "results": []}
    try:
        return {
            "organizationId": organizationId,
            "results": m1.list_locations(organizationId),
        }
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"M1 query failed: {exc}")
