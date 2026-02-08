@echo off
chcp 65001
cd /d "%~dp0"
echo.
echo ============================================
echo   Real 환경 배포 (Production)
echo ============================================
echo.
echo ⚠️  주의: Real 환경에 배포합니다!
echo.
set /p confirm="정말 Real에 배포하시겠습니까? (y/n): "

if /i not "%confirm%"=="y" (
    echo 배포가 취소되었습니다.
    pause
    exit /b
)

echo.
echo Real 환경에 배포합니다...
echo.

REM main 브랜치 확인
git checkout main

REM 최신 상태로 업데이트
git pull origin main

REM main 브랜치 푸시 (Vercel의 production 환경과 연결)
git push origin main

echo.
echo ============================================
echo   Real 배포 완료!
echo ============================================
echo.
echo Vercel에서 자동 배포됩니다.
echo Production URL을 확인하세요.
echo.

pause

