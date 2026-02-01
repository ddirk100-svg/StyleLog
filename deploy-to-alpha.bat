@echo off
chcp 65001 >nul 2>&1
cd /d "%~dp0"
echo.
echo ============================================
echo   Alpha server deploy (Test)
echo ============================================
echo.
git add .
git commit -m "update: Alpha server deployment"
git push origin alpha
echo.
echo ============================================
echo   Deploy complete!
echo   URL: https://stylelog-git-alpha-jongiks-projects.vercel.app
echo ============================================
echo.
pause
