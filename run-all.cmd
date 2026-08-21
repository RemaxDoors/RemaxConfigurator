@echo off
REM Starts BOTH servers, each in its own window:
REM   API  -> http://localhost:8000   (FastAPI, from backend\)
REM   Web  -> http://localhost:3000   (Next.js, from frontend\)
REM Double-click this, or run  .\run-all.cmd  from any terminal.
REM Close either window to stop that server.

echo Starting Remax ConfigHub...
echo.

if not exist "%~dp0config\Scripts\python.exe" (
    echo [!] Python venv not found at config\Scripts\python.exe
    echo     Create it, or edit this script to point at your interpreter.
    pause
    exit /b 1
)

start "Remax API  (port 8000)" cmd /k "cd /d "%~dp0backend" && "%~dp0config\Scripts\python.exe" -m uvicorn app.main:app --reload --port 8000"

REM Give the API a moment to bind before the web app starts calling it.
timeout /t 3 /nobreak >nul

start "Remax Web  (port 3000)" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo API -^> http://localhost:8000/docs
echo Web -^> http://localhost:3000
echo.
echo Both servers are starting in separate windows.
echo This window can be closed.
timeout /t 5 /nobreak >nul
