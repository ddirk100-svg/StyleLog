@echo off
cd /d "%~dp0"

echo.
echo ============================================
<<<<<<< HEAD
echo   Alpha server deploy (Test)
echo ============================================
echo.

echo [1/4] Committing changes...
git add .
git commit -m "update: Alpha server deployment"

echo [2/4] Switching to alpha branch...
git checkout alpha

echo [3/4] Merging main into alpha...
git merge main --no-edit

echo [4/4] Pushing alpha branch...
git push origin alpha

echo.
echo Switching back to main...
git checkout main

echo.
echo ============================================
echo   Deploy complete!
echo ============================================
echo.
echo Alpha URL: https://stylelog-git-alpha-jongiks-projects.vercel.app
echo.
echo Run deploy-real.bat after testing.
=======
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
>>>>>>> main
echo.
pause
