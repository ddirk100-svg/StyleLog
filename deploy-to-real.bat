@echo off
chcp 65001 >nul 2>&1
cd /d "%~dp0"
echo.
echo ============================================
echo   REAL server deploy (Production)
echo ============================================
echo.
echo WARNING: This is the actual production service!
echo.
set /p confirm="Do you want to deploy? (yes to continue): "
if not "%confirm%"=="yes" (
    echo Deploy cancelled.
    pause
    exit
)
echo.
git add .
git commit -m "deploy: REAL server deployment"
git push origin main
echo.
echo ============================================
echo   Deploy complete!
echo   URL: https://stylelog.vercel.app
echo ============================================
echo.
pause

