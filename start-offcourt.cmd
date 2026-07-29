@echo off
rem Starts the OFFCOURT (carousel edition) local server and opens the browser.
start "" powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0server.ps1"
timeout /t 2 /nobreak >nul
start "" http://localhost:4175/
