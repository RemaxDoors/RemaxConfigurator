# Remax Configurator API (FastAPI + pyodbc -> SQL Server)
#
# Why this exists: pyodbc needs the Microsoft ODBC driver installed at OS level.
# Baking it into the image removes the "works on my machine" problem when
# deploying (Azure App Service / any host).
#
# Build:  docker build -t remax-configurator-api ./api
# Run:    docker run --rm -p 8000:8000 --env-file api/.env remax-configurator-api
#
# NOTE: this image ships ODBC Driver 18 (the supported one on Debian 12).
# Set DB_DRIVER accordingly — see api/.env.example.
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    DB_DRIVER="ODBC Driver 18 for SQL Server"

# --- Microsoft ODBC driver + build deps -------------------------------------
RUN apt-get update \
 && apt-get install -y --no-install-recommends curl gnupg ca-certificates gcc g++ unixodbc-dev \
 && curl -fsSL https://packages.microsoft.com/keys/microsoft.asc \
      | gpg --dearmor -o /usr/share/keyrings/microsoft-prod.gpg \
 && echo "deb [signed-by=/usr/share/keyrings/microsoft-prod.gpg] https://packages.microsoft.com/debian/12/prod bookworm main" \
      > /etc/apt/sources.list.d/mssql-release.list \
 && apt-get update \
 && ACCEPT_EULA=Y apt-get install -y --no-install-recommends msodbcsql18 \
 && apt-get purge -y curl gnupg \
 && apt-get autoremove -y \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Dependencies first so this layer caches across code changes.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Includes app/pricing_rules — the door and installation rules used to live in
# the Streamlit tree and were reached via sys.path, which meant this image was
# incomplete without it. They are part of the package now.
COPY app ./app

EXPOSE 8000

# Azure App Service supplies $PORT; default to 8000 locally.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
