@echo off
title Oil India Limited - PWA Deployment & Server Launcher
cls
echo ==============================================================================
echo       OIL INDIA LIMITED - FIELD TO SCHEDULE BRIDGE (SIH26122)
echo            Windows PWA Deployment & Operations Server
echo ==============================================================================
echo.
echo [1/3] Verifying environment runtime...
where python >nul 2>nul
if %ERRORLEVEL% equ 0 (
    set RUNNER=python -m http.server 8000
    echo       Found Python runtime. Using Python HTTP Server.
) else (
    where npx >nul 2>nul
    if %ERRORLEVEL% equ 0 (
        set RUNNER=npx serve . -p 8000
        echo       Found Node.js/npx runtime. Using npx serve.
    ) else (
        echo       [!] Python or Node.js not detected. Please install Python 3.x or Node.js.
        pause
        exit /b 1
    )
)

echo.
echo [2/3] Preparing Windows PWA installation origin...
echo       Origin URL: http://localhost:8000
echo.
echo [3/3] Launching Oil India Operations in default browser...
start http://localhost:8000/#/login
echo.
echo ==============================================================================
echo  WINDOWS NATIVE PWA INSTALLATION STEPS:
echo  1. In Microsoft Edge or Google Chrome, look at the right side of the address bar.
echo  2. Click the 'App Available / Install' icon (or click 'Install PWA' inside the app).
echo  3. Click 'Install' to create a standalone Windows window with Start Menu shortcut.
echo ==============================================================================
echo.
echo Server active on port 8000. Press Ctrl+C to terminate server.
echo.
%RUNNER%
