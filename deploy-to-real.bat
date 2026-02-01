@echo off
chcp 65001
cd /d "%~dp0"
echo.
echo ============================================
echo   REAL 서버 배포 (실제 서비스)
echo ============================================
echo.
echo 주의: 실제 사용자가 보는 서비스입니다!
echo.
set /p confirm="정말 배포하시겠습니까? (yes 입력): "
if not "%confirm%"=="yes" (
    echo 배포가 취소되었습니다.
    pause
    exit
)
echo.
git add .
git commit -m "deploy: REAL 서버 배포"
git push origin main
echo.
echo ============================================
echo   배포 완료!
echo   URL: https://stylelog.vercel.app
echo ============================================
echo.
pause

