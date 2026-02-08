@echo off
chcp 65001
cd /d "%~dp0"
echo.
echo ============================================
echo   Alpha 환경 배포
echo ============================================
echo.

REM 현재 변경사항 확인
git status

echo.
echo 변경사항을 alpha 브랜치에 푸시합니다...
echo.

REM 모든 변경사항 추가
git add .

REM 커밋 메시지 입력 받기
set /p commit_msg="커밋 메시지를 입력하세요 (Enter = 기본 메시지): "
if "%commit_msg%"=="" set commit_msg=Update: 코드 수정

REM 커밋
git commit -m "%commit_msg%"

REM alpha 브랜치로 전환
git checkout alpha

REM main 브랜치의 변경사항 머지
git merge main -m "Merge: main to alpha"

REM alpha 브랜치 푸시
git push origin alpha

echo.
echo ============================================
echo   Alpha 배포 완료!
echo ============================================
echo.
echo Vercel에서 자동 배포됩니다.
echo Alpha URL을 확인하세요.
echo.

REM main 브랜치로 다시 돌아가기
git checkout main

pause

