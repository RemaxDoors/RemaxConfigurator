#!/bin/bash
curl https://packages.microsoft.com/keys/microsoft.asc | apt-key add -
curl https://packages.microsoft.com/config/debian/12/prod.list > /etc/apt/sources.list.d/mssql-release.list
apt-get update -qq
ACCEPT_EULA=Y apt-get install -y msodbcsql18 unixodbc-dev
python -m streamlit run src/app.py --server.port 8000 --server.address 0.0.0.0