@echo off
chcp 65001 >nul 2>&1
cd /d "%~dp0"
echo.
echo ============================================
echo   Merge alpha to main
echo ============================================
echo.

REM Ensure we're on main branch
git checkout main

REM Pull latest changes
git pull origin main

REM Merge alpha branch
git merge alpha -m "merge: Alpha tested changes to main"

echo.
echo ============================================
echo   Merge complete!
echo   Ready to deploy to REAL server
echo ============================================
echo.
pause

