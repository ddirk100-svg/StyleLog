@echo off
chcp 65001 >nul 2>&1
cd /d "%~dp0"
echo.
echo ============================================
echo   Alpha server deploy (Test)
echo ============================================
echo.

REM 현재 변경사항을 main에 커밋
echo [1/4] 변경사항 커밋 중...
git add .
git commit -m "update: Alpha server deployment"

REM alpha 브랜치로 전환
echo [2/4] alpha 브랜치로 전환 중...
git checkout alpha

REM main 브랜치의 최신 내용을 alpha에 머지
echo [3/4] main 브랜치 내용을 alpha에 머지 중...
git merge main --no-edit

REM alpha 브랜치 푸시
echo [4/4] alpha 브랜치 푸시 중...
git push origin alpha

REM main 브랜치로 돌아가기
echo.
echo [완료] main 브랜치로 복귀 중...
git checkout main

echo.
echo ============================================
echo   Deploy complete!
echo   URL: https://stylelog-git-alpha-jongiks-projects.vercel.app
echo ============================================
echo.
echo Alpha에서 테스트 후 문제 없으면 deploy-to-real.bat 실행
echo.
pause
