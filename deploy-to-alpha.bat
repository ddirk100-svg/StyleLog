@echo off
cd /d "%~dp0"

echo.
echo ============================================
echo   Deploy to Alpha
echo ============================================
echo.

REM Check current branch
git branch --show-current

REM Add and commit changes
echo Adding changes...
git add .
git commit -m "update: Alpha deployment"

REM Push to alpha
echo Pushing to alpha...
git push origin alpha

echo.
echo ============================================
echo   Alpha Deploy Complete!
echo ============================================
echo.
echo Wait 1-2 minutes for Vercel to deploy
echo Test on: https://stylelog-git-alpha-jongiks-projects.vercel.app
echo.
pause
