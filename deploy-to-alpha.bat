@echo off
chcp 65001
cd /d "%~dp0"
echo.
echo ============================================
echo   Alpha 서버 배포 (테스트용)
echo ============================================
echo.
git add .
git commit -m "update: 변경사항 Alpha 서버 배포"
git push origin alpha
echo.
echo ============================================
echo   배포 완료!
echo   URL: https://alpha.stylelog.vercel.app
echo ============================================
echo.
pause

