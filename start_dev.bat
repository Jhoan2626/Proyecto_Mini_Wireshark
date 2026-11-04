@echo off
title Mini-Wireshark Launcher
echo ========================================================
echo   Iniciando Mini-Wireshark (Backend Flask + Frontend Vite)
echo ========================================================
echo.

start "Mini-Wireshark Backend (Flask)" cmd /k "cd /d %~dp0backend && .venv\Scripts\python.exe app.py"
start "Mini-Wireshark Frontend (Vite)" cmd /k "cd /d %~dp0frontend && npm.cmd run dev"

echo Servidores en ejecucion:
echo - Backend:  http://127.0.0.1:5000
echo - Frontend: http://localhost:5173
echo.
