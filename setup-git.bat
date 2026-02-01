@echo off
chcp 65001
cd /d "%~dp0"
echo.
echo ============================================
echo   Git 초기 설정
echo ============================================
echo.

REM Git 저장소 초기화 (이미 있으면 무시)
if not exist .git (
    git init
    echo Git 저장소 초기화 완료
)

REM 기본 브랜치를 main으로 설정
git branch -M main

REM 모든 파일 추가 및 커밋
git add .
git commit -m "init: 프로젝트 초기 설정"

REM alpha 브랜치 생성
git branch alpha

REM GitHub 원격 저장소 연결 (이미 있으면 무시)
git remote get-url origin 2>nul
if errorlevel 1 (
    git remote add origin https://github.com/ddirk100-svg/StyleLog.git
    echo GitHub 원격 저장소 연결 완료
)

REM main 브랜치 푸시
git push -u origin main

REM alpha 브랜치 푸시
git push -u origin alpha

echo.
echo ============================================
echo   Git 설정 완료!
echo ============================================
echo.
echo 브랜치 목록:
git branch -a
echo.
pause

