@echo off
REM Starts the Next.js web app from the frontend\ folder.
REM Double-click this, or run  .\run-web.cmd  from any terminal.
cd /d "%~dp0frontend"
call npm run dev
pause
