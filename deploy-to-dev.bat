@echo off
chcp 65001
cd /d "%~dp0"
git init
git add .
git commit -m "refactor: 코드 효율화 - 공통 컴포넌트 및 시멘틱 HTML 적용"
git checkout -b dev
git remote add origin https://github.com/ddirk100-svg/StyleLog.git
git push -u origin dev
pause

