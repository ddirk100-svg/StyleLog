@echo off
chcp 65001
cd /d "%~dp0"
echo.
echo ============================================
echo   Alpha → Real 배포 (승격)
echo ============================================
echo.
echo Alpha에서 테스트된 코드를 Real로 승격합니다.
echo.
set /p confirm="Alpha를 Real로 승격하시겠습니까? (y/n): "

if /i not "%confirm%"=="y" (
    echo 배포가 취소되었습니다.
    pause
    exit /b
)

echo.
echo Alpha를 Real로 승격 중...
echo.

REM main 브랜치로 전환
git checkout main

REM alpha 브랜치의 변경사항을 main에 머지
git merge alpha -m "Release: Alpha to Production"

REM main 브랜치 푸시 (Real 환경 배포)
git push origin main

echo.
echo ============================================
echo   Real 배포 완료!
echo ============================================
echo.
echo Alpha의 코드가 Real 환경에 배포되었습니다.
echo Production URL을 확인하세요.
echo.

pause

