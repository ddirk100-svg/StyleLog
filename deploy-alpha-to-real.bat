@echo off
cd /d "%~dp0"

echo.
echo ============================================
echo   Deploy Alpha to Production
echo ============================================
echo.
echo WARNING: This deploys to PRODUCTION!
set /p confirm="Continue? (y/n): "

if /i not "%confirm%"=="y" (
    echo Cancelled.
    pause
    exit /b
)

echo.
echo [1/3] Switching to main...
git checkout main

echo [2/3] Merging alpha into main...
git merge alpha --no-edit

echo [3/3] Pushing to production...
git push origin main

echo.
echo ============================================
echo   Done! Production URL: https://www.stylelog.co.kr/
echo ============================================
echo.
pause
