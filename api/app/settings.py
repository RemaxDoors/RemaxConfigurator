import os

from dotenv import load_dotenv

load_dotenv()

# M1 SQL Server (same values as the Streamlit app's src/.env)
DB_SERVER = os.getenv("DB_SERVER")
DB_NAME = os.getenv("DB_NAME")
DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")
DB_DRIVER = os.getenv("DB_DRIVER", "ODBC Driver 17 for SQL Server")

# App-owned config DB (uCfg* tables) — same server as M1, different database.
CONFIG_DB_NAME = os.getenv("CONFIG_DB_NAME", "new")

# CORS — origins allowed to call this API directly (the Next dev server).
ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")
    if origin.strip()
]


def db_configured() -> bool:
    """True only when all M1 connection settings are present."""
    return all([DB_SERVER, DB_NAME, DB_USER, DB_PASSWORD])


def config_db_configured() -> bool:
    """True when the config DB (same server/creds) can be reached."""
    return all([DB_SERVER, CONFIG_DB_NAME, DB_USER, DB_PASSWORD])
