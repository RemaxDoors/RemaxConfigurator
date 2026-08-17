@echo off
REM Starts the Python API (FastAPI) from the api\ folder using the config venv.
REM Double-click this, or run  .\run-api.cmd  from any terminal.
cd /d "%~dp0api"
"%~dp0config\Scripts\python.exe" -m uvicorn app.main:app --reload --port 8000
pause
