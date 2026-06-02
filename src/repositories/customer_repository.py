import pandas as pd
from sqlalchemy import text
from repositories.sql_service import get_engine

def search_customers(search_text: str) -> pd.DataFrame:
    wildcard_term = f"%{search_text.strip()}%"
    engine = get_engine()

    query = text("""
        SELECT
            cmoOrganizationID,
            cmoname
        FROM Organizations
        WHERE
            CAST(cmoname AS VARCHAR(100)) LIKE :term
            OR CAST(cmoOrganizationID AS VARCHAR(50)) LIKE :term
        ORDER BY cmoname ASC
    """)

    with engine.connect() as conn:
        df = pd.read_sql(query, conn, params={"term": wildcard_term})

    return df
def get_ship_locations(ship_organization_id: str) -> pd.DataFrame:
    engine = get_engine()

    query = text("""
        SELECT
            cmlOrganizationID,
            cmlLocationID,
            cmlName
        FROM OrganizationLocations
        WHERE
            CAST(cmlOrganizationID AS VARCHAR(50)) = :org_id
                 
        ORDER BY cmlName ASC
    """)

    with engine.connect() as conn:
        df = pd.read_sql(
            query,
            conn,
            params={
                "org_id": str(ship_organization_id).strip(),
            },
        )

    return df
