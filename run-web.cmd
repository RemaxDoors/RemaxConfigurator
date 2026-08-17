@echo off
REM Starts the Next.js web app from the web\ folder.
REM Double-click this, or run  .\run-web.cmd  from any terminal.
cd /d "%~dp0web"
call npm run dev
pause
