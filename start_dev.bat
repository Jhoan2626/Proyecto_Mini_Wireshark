@echo off
title Mini-Wireshark Launcher
echo ========================================================
echo   Iniciando Mini-Wireshark (Backend Scapy + Frontend Vite)
echo ========================================================
echo.
echo [*] Solicitando permisos de Administrador para el motor Scapy (Backend)...

powershell -NoProfile -Command "Start-Process cmd.exe -ArgumentList '/k title Mini-Wireshark Backend (Scapy Real) && cd /d \"%~dp0backend\" && .venv\Scripts\python.exe app.py' -Verb RunAs" 2>nul || (
    echo [!] Ejecutando Backend sin elevacion UAC...
    start "Mini-Wireshark Backend (Flask)" cmd /k "cd /d %~dp0backend && .venv\Scripts\python.exe app.py"
)

start "Mini-Wireshark Frontend (Vite)" cmd /k "cd /d %~dp0frontend && npm.cmd run dev"

echo.
echo Servidores en ejecucion:
echo - Backend (Scapy API): http://127.0.0.1:5000
echo - Frontend (UI):       http://localhost:5173
echo.
