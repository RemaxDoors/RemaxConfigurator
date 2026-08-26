"""M1 SQL Server access. Mirrors the query in src/repositories/customer_repository.py.

pyodbc is imported lazily by SQLAlchemy at connect time, so this module imports
fine without a database; queries only run when M1 is configured.
"""
import urllib.parse

from sqlalchemy import create_engine, text

from . import settings

_engine = None


def get_engine():
    global _engine
    if _engine is None:
        params = urllib.parse.quote_plus(
            f"DRIVER={{{settings.DB_DRIVER}}};"
            f"SERVER={settings.DB_SERVER};"
            f"DATABASE={settings.DB_NAME};"
            f"UID={settings.DB_USER};"
            f"PWD={settings.DB_PASSWORD};"
            "TrustServerCertificate=yes;"
        )
        _engine = create_engine(f"mssql+pyodbc:///?odbc_connect={params}")
    return _engine


def list_locations(organization_id: str) -> list[dict]:
    """Ship-to locations for an M1 organization (OrganizationLocations)."""
    statement = text(
        """
        SELECT cmlLocationID, cmlName, cmlCity, cmlState
        FROM OrganizationLocations
        WHERE cmlOrganizationID = :org
        ORDER BY cmlLocationID
        """
    )
    with get_engine().connect() as conn:
        rows = conn.execute(statement, {"org": organization_id.strip()}).fetchall()
    out = []
    for lid, name, city, state in rows:
        label = str(name or "").strip()
        place = ", ".join(p for p in (str(city or "").strip(), str(state or "").strip()) if p)
        out.append(
            {
                "id": str(lid).strip(),
                "name": f"{label} ({place})" if label and place else label or place,
            }
        )
    return out


def search_customers(query: str) -> list[dict]:
    term = f"%{query.strip()}%"
    statement = text(
        """
        SELECT TOP 50
            cmoOrganizationID,
            cmoname
        FROM Organizations
        WHERE CAST(cmoname AS VARCHAR(200)) LIKE :term
           OR CAST(cmoOrganizationID AS VARCHAR(50)) LIKE :term
        ORDER BY cmoname ASC
        """
    )
    with get_engine().connect() as conn:
        rows = conn.execute(statement, {"term": term}).fetchall()
    return [{"id": str(row[0]).strip(), "name": str(row[1]).strip()} for row in rows]


def list_lead_sources() -> list[dict]:
    """Active marketing programmes — the Lead Source dropdown.

    Only the active ones are offered. Note that most historic quotes carry an
    INACTIVE programme, so a quote loaded from M1 may hold a code that is not
    in this list; the caller should keep an unknown value selectable rather
    than silently blanking it.
    """
    with get_engine().connect() as conn:
        rows = conn.execute(text(
            "SELECT looMarketingProgramID, looShortDescription "
            "FROM dbo.MarketingPrograms WHERE looInactive = 0 "
            "ORDER BY looShortDescription"
        )).fetchall()
    return [{"id": r[0], "name": r[1] or r[0]} for r in rows]


def list_quoters() -> list[dict]:
    """Salespeople who can quote — the Sales Person dropdown.

    lmeTerminationDate is the real leaver flag. Without it the list includes
    people who left in 2024 and carry "- INACTIVE" in their name, which is a
    convention rather than something to filter on.
    """
    with get_engine().connect() as conn:
        rows = conn.execute(text(
            "SELECT lmeEmployeeID, lmeEmployeeName FROM dbo.Employees "
            "WHERE lmeQuoterEmployee = 1 AND lmeContactTitleID = 'SALE' "
            "AND lmeTerminationDate IS NULL "
            "ORDER BY lmeEmployeeName"
        )).fetchall()
    return [{"id": r[0], "name": r[1] or r[0]} for r in rows]
