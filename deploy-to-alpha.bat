@echo off
cd /d "%~dp0"

echo.
echo ============================================
echo   Alpha Deploy
echo ============================================
echo.

echo [1/4] Committing changes to main...
git add .
git commit -m "update: Alpha deployment"

echo [2/4] Switching to alpha branch...
git checkout alpha

echo [3/4] Merging main into alpha...
git merge main --no-edit

echo [4/4] Pushing alpha...
git push origin alpha

echo.
echo Switching back to main...
git checkout main

echo.
echo ============================================
echo   Done! Wait 1-2 min for Vercel.
echo   URL: https://stylelog-git-alpha-jongiks-projects.vercel.app
echo ============================================
echo.
pause
