@echo off
chcp 65001 >nul 2>&1
cd /d "%~dp0"
echo.
echo ============================================
echo   Alpha server deploy (Test)
echo ============================================
echo.

REM main 브랜치에 커밋
git add .
<<<<<<< HEAD
git commit -m "update: 변경사항 Alpha 서버 배포"

REM alpha 브랜치로 전환
git checkout alpha

REM main 브랜치의 최신 내용을 alpha로 가져오기
git merge main

REM GitHub에 푸시 (Vercel 배포 트리거)
=======
git commit -m "update: Alpha server deployment"
>>>>>>> alpha
git push origin alpha

REM main 브랜치로 돌아가기
git checkout main

echo.
echo ============================================
<<<<<<< HEAD
echo   배포 완료!
echo   1-2분 후 Alpha 서버에서 확인하세요
=======
echo   Deploy complete!
>>>>>>> alpha
echo   URL: https://stylelog-git-alpha-jongiks-projects.vercel.app
echo ============================================
echo.
pause
