"""Health and status — what's up, what's reachable, and what the data looks like.

Used by the app's Status page so a complaint can be checked in one look.
"""
import time

from fastapi import APIRouter
from sqlalchemy import text

from .. import config_repo, m1_pricing, settings

router = APIRouter(tags=["status"])


def _check(name: str, fn) -> dict:
    """Run a probe, timing it, and never raise."""
    started = time.perf_counter()
    try:
        detail = fn()
        return {
            "name": name,
            "ok": True,
            "ms": round((time.perf_counter() - started) * 1000),
            "detail": detail,
        }
    except Exception as exc:
        return {
            "name": name,
            "ok": False,
            "ms": round((time.perf_counter() - started) * 1000),
            "error": str(exc)[:200],
        }


@router.get("/status")
def status():
    """Full health + data snapshot."""
    checks = []

    def m1_probe():
        with m1_pricing.get_m1_engine().connect() as c:
            n = c.execute(text("SELECT COUNT(*) FROM dbo.uSellPriceMatrixs")).scalar()
        return f"{settings.DB_NAME} · {n:,} price-matrix rows"

    def cfg_probe():
        with config_repo.get_config_engine().connect() as c:
            n = c.execute(text("SELECT COUNT(*) FROM dbo.uCfgConfigurators")).scalar()
        return f"{settings.CONFIG_DB_NAME} · {n} configurators"

    checks.append(_check("API", lambda: "running"))
    if settings.db_configured():
        checks.append(_check("M1 database", m1_probe))
    else:
        checks.append({"name": "M1 database", "ok": False, "ms": 0,
                       "error": "DB_* not configured in api/.env"})
    if settings.config_db_configured():
        checks.append(_check("Config database", cfg_probe))
    else:
        checks.append({"name": "Config database", "ok": False, "ms": 0,
                       "error": "CONFIG_DB_NAME not configured"})

    # --- per-configurator counts ---
    configurators = []
    warnings = []
    if settings.config_db_configured():
        try:
            with config_repo.get_config_engine().connect() as c:
                rows = c.execute(text("""
                    SELECT g.PartID, g.ConfiguratorName,
                      (SELECT COUNT(*) FROM dbo.uCfgParameters WHERE CfgID=g.CfgID),
                      (SELECT COUNT(*) FROM dbo.uCfgParameterOptions o
                         JOIN dbo.uCfgParameters p ON o.ParamID=p.ParamID WHERE p.CfgID=g.CfgID),
                      (SELECT COUNT(*) FROM dbo.uCfgRules WHERE CfgID=g.CfgID),
                      (SELECT COUNT(*) FROM dbo.uCfgDefaults WHERE CfgID=g.CfgID),
                      (SELECT COUNT(*) FROM dbo.uCfgValidationRules WHERE CfgID=g.CfgID)
                    FROM dbo.uCfgConfigurators g ORDER BY g.PartID""")).fetchall()
                configurators = [
                    {"id": r[0], "name": r[1], "parameters": r[2], "options": r[3],
                     "rules": r[4], "defaults": r[5], "validations": r[6]}
                    for r in rows
                ]
                # dropdowns with no options are a common, silent config bug
                empty = c.execute(text("""
                    SELECT g.PartID, p.ControlName FROM dbo.uCfgParameters p
                    JOIN dbo.uCfgConfigurators g ON p.CfgID=g.CfgID
                    WHERE p.Kind='dropdown'
                      AND NOT EXISTS (SELECT 1 FROM dbo.uCfgParameterOptions o WHERE o.ParamID=p.ParamID)
                    ORDER BY g.PartID, p.ControlName""")).fetchall()
                for cfg_id, control in empty:
                    warnings.append({
                        "kind": "empty-dropdown",
                        "message": f"{cfg_id}: {control} is a dropdown with no options",
                    })
                for cfg in configurators:
                    if cfg["rules"] == 0:
                        warnings.append({
                            "kind": "no-rules",
                            "message": f"{cfg['id']}: no pricing rules saved",
                        })
        except Exception as exc:
            warnings.append({"kind": "error", "message": str(exc)[:200]})

    return {
        "ok": all(c["ok"] for c in checks),
        "checks": checks,
        "configurators": configurators,
        "warnings": warnings,
    }


@router.get("/status/endpoints")
def endpoints():
    """Machine-readable list of the API's endpoints, for the reference page."""
    from ..main import app

    spec = app.openapi()
    out = []
    for path, methods in spec.get("paths", {}).items():
        for method, op in methods.items():
            out.append({
                "method": method.upper(),
                "path": path,
                "summary": (op.get("summary") or "").strip(),
                "description": (op.get("description") or "").strip().split("\n")[0],
                "tags": op.get("tags", []),
                "responses": sorted(op.get("responses", {}).keys()),
            })
    out.sort(key=lambda e: (e["tags"][0] if e["tags"] else "", e["path"], e["method"]))
    return {"endpoints": out, "count": len(out)}
