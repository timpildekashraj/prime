@echo off
echo.
echo  PrimeHealth - Non-Clinical Patient Engagement Demo
echo  ====================================================
echo.

REM Kill anything on port 8000
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8000 "') do (
    taskkill /F /PID %%a >nul 2>&1
)

echo  Starting server on http://localhost:8000
echo  Press Ctrl+C to stop.
echo.

cd /d "%~dp0"
python -m uvicorn main:app --port 8000 --reload
