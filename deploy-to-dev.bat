@echo off
chcp 65001
cd /d "%~dp0"
git add .
git commit -m "fix: Vercel dev 브랜치 환경에서 DEV DB 연결하도록 수정"
git push origin dev
pause

