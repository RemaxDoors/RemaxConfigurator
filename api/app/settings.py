import os

from dotenv import load_dotenv

load_dotenv()

# M1 SQL Server (same values as the Streamlit app's src/.env)
DB_SERVER = os.getenv("DB_SERVER")
DB_NAME = os.getenv("DB_NAME")
DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")
DB_DRIVER = os.getenv("DB_DRIVER", "ODBC Driver 17 for SQL Server")

# App-owned config DB (uCfg* tables).
#
# It defaults to the M1 server and credentials, which is right when both live on
# the same instance. Set the CONFIG_DB_* variables when they don't — an Azure
# SQL config database alongside an on-premises M1, for example. Nothing joins
# across the two, so they are free to be on different servers.
CONFIG_DB_NAME = os.getenv("CONFIG_DB_NAME", "RP_config")
CONFIG_DB_SERVER = os.getenv("CONFIG_DB_SERVER") or DB_SERVER
CONFIG_DB_USER = os.getenv("CONFIG_DB_USER") or DB_USER
CONFIG_DB_PASSWORD = os.getenv("CONFIG_DB_PASSWORD") or DB_PASSWORD
CONFIG_DB_DRIVER = os.getenv("CONFIG_DB_DRIVER") or DB_DRIVER

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
    """True when the config DB has everything it needs to connect."""
    return all([CONFIG_DB_SERVER, CONFIG_DB_NAME, CONFIG_DB_USER, CONFIG_DB_PASSWORD])
