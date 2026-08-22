@echo off
echo ============================================================
echo Starting Oil India Limited PWA Local Web Server...
echo ============================================================
echo.
echo Opening http://localhost:8000 in your default browser...
start http://localhost:8000
python -m http.server 8000
pause
