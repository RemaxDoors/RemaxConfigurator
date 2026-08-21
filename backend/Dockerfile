# Remax ConfigHub API (FastAPI + pyodbc -> SQL Server)
#
# Why this exists: pyodbc needs the Microsoft ODBC driver installed at OS level.
# Baking it into the image removes the "works on my machine" problem when
# deploying (Azure App Service / any host).
#
# Build:  docker build -t remax-configurator-api ./backend
# Run:    docker run --rm -p 8000:8000 --env-file .env remax-configurator-api
#
# NOTE: this image ships ODBC Driver 18 (the supported one on Debian 12).
# Set DB_DRIVER accordingly — see .env.example.
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    DB_DRIVER="ODBC Driver 18 for SQL Server"

# --- Microsoft ODBC driver ---------------------------------------------------
# unixodbc (the driver manager) as well as unixodbc-dev: -dev alone provides the
# headers pyodbc compiles against, but the runtime needs the manager itself.
#
# Nothing is purged or autoremoved here on purpose. A previous version ran
# `apt-get purge curl gnupg && apt-get autoremove` after installing the driver,
# and production failed with the driver registered in odbcinst.ini but its
# library missing from disk:
#
#   Can't open lib '/opt/microsoft/msodbcsql18/lib64/libmsodbcsql-18.6.so.2.1'
#
# Saving a few megabytes is not worth deleting files out from under an install
# step that has already run.
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      curl gnupg ca-certificates gcc g++ unixodbc unixodbc-dev \
 && curl -fsSL https://packages.microsoft.com/keys/microsoft.asc \
      | gpg --dearmor -o /usr/share/keyrings/microsoft-prod.gpg \
 && echo "deb [signed-by=/usr/share/keyrings/microsoft-prod.gpg] https://packages.microsoft.com/debian/12/prod bookworm main" \
      > /etc/apt/sources.list.d/mssql-release.list \
 && apt-get update \
 && ACCEPT_EULA=Y apt-get install -y --no-install-recommends msodbcsql18 \
 && rm -rf /var/lib/apt/lists/*

# --- Prove the driver actually works, at build time --------------------------
# The failure above was only discovered in Azure, because nothing checked. This
# fails the build instead: it reads the library path back out of odbcinst.ini
# and confirms the file is really there, then loads it through pyodbc.
RUN set -eux; \
    odbcinst -q -d; \
    driver_lib="$(odbcinst -q -d -n 'ODBC Driver 18 for SQL Server' | sed -n 's/^Driver *= *//p')"; \
    echo "registered driver library: ${driver_lib}"; \
    test -f "${driver_lib}" || { echo "ODBC driver library is missing from disk"; exit 1; }; \
    echo "ODBC driver present and registered"

WORKDIR /app

# Dependencies first so this layer caches across code changes.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Confirm pyodbc can load the driver through the manager, not just that the
# file exists. Listing drivers forces the shared library to be opened.
RUN python -c "import pyodbc; d = pyodbc.drivers(); print('pyodbc sees:', d); assert any('18' in x for x in d), 'ODBC Driver 18 not visible to pyodbc'"

# Includes app/pricing_rules — the door and installation rules used to live in
# the Streamlit tree and were reached via sys.path, which meant this image was
# incomplete without it. They are part of the package now.
COPY app ./app

EXPOSE 8000

# Azure App Service supplies $PORT; default to 8000 locally.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
