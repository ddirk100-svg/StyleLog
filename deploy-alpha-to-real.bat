@echo off
cd /d "%~dp0"

echo.
echo ============================================
echo   Step 2: Deploy Alpha to Real
echo ============================================
echo.
echo WARNING: This will deploy to PRODUCTION!
echo.
set /p confirm="Continue? (y/n): "

if /i not "%confirm%"=="y" (
    echo Cancelled.
    pause
    exit /b
)

echo.
echo Deploying to Real...

REM Switch to main
git checkout main

REM Merge alpha to main
git merge alpha --no-edit

REM Push to main (Real deployment)
git push origin main

echo.
echo ============================================
echo   Real Deploy Complete!
echo ============================================
echo.
pause
