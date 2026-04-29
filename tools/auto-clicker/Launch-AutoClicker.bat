@echo off
setlocal
set "SCRIPT_DIR=%~dp0"
fltmc >nul 2>&1
if errorlevel 1 (
    powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -Command "Start-Process powershell.exe -Verb RunAs -ArgumentList '-NoLogo -NoProfile -Sta -ExecutionPolicy Bypass -WindowStyle Hidden -File ""%SCRIPT_DIR%AutoClicker.ps1""'"
    exit /b
)
start "" powershell.exe -NoLogo -NoProfile -Sta -ExecutionPolicy Bypass -WindowStyle Hidden -File "%SCRIPT_DIR%AutoClicker.ps1"
endlocal
