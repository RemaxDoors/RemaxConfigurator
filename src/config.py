from pathlib import Path
import os
from dotenv import load_dotenv

# Load values from .env
load_dotenv()

# Base paths
BASE_DIR = Path(__file__).resolve().parent.parent
SRC_DIR = BASE_DIR / "src"

# Database settings
DB_SERVER = os.getenv("DB_SERVER")
DB_NAME = os.getenv("DB_NAME")
DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")
DB_DRIVER = os.getenv("DB_DRIVER", "ODBC Driver 17 for SQL Server")

# Optional app settings
APP_NAME = os.getenv("APP_NAME", "Rapid Door Estimator")
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")


def validate_config():
    missing = []

    required = {
        "DB_SERVER": DB_SERVER,
        "DB_NAME": DB_NAME,
        "DB_USER": DB_USER,
        "DB_PASSWORD": DB_PASSWORD,
    }

    for key, value in required.items():
        if not value:
            missing.append(key)

    if missing:
        raise ValueError(
            f"Missing required environment variables: {', '.join(missing)}"
        )
API_ID = os.getenv("API_ID")
API_KEY = os.getenv("API_KEY")
API_URL = os.getenv("API_URL")