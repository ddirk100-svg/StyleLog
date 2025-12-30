# Vercel 배포 가이드

## 1단계: GitHub 저장소 생성 및 푸시

### 1. GitHub에서 새 저장소 생성
1. GitHub (https://github.com)에 로그인
2. 우측 상단 "+" 버튼 → "New repository" 클릭
3. Repository name: `stylelog` (또는 원하는 이름)
4. Public 또는 Private 선택
5. "Create repository" 클릭

### 2. 로컬에서 Git 초기화 및 푸시

터미널에서 다음 명령어를 실행하세요:

```bash
# Git 초기화
git init

# 모든 파일 추가
git add .

# 첫 커밋
git commit -m "Initial commit: StyleLog MVP"

# GitHub 저장소 연결 (YOUR_USERNAME을 본인의 GitHub 사용자명으로 변경)
git remote add origin "https://github.com/ddirk100-svg/stylelog.git"

# 메인 브랜치로 이름 변경 (필요시)
git branch -M main

# GitHub에 푸시
git push -u origin main
```

## 2단계: Vercel 배포

### 1. Vercel 계정 생성
1. https://vercel.com 접속
2. "Sign Up" 클릭
3. "Continue with GitHub" 선택하여 GitHub 계정으로 로그인

### 2. 프로젝트 Import
1. Vercel 대시보드에서 "Add New..." → "Project" 클릭
2. "Import Git Repository"에서 방금 만든 GitHub 저장소 선택
3. "Import" 클릭

### 3. 프로젝트 설정
- **Framework Preset**: Other (또는 그대로 두기)
- **Root Directory**: `./` (기본값)
- **Build Command**: 비워두기 (정적 파일이므로 빌드 불필요)
- **Output Directory**: 비워두기
- **Install Command**: 비워두기

### 4. 환경 변수 설정 (선택사항)
현재 `config.js`에서 자동으로 개발/프로덕션 환경을 감지하므로 추가 설정이 필요 없습니다.
- Vercel에 배포되면 자동으로 프로덕션 설정을 사용합니다.

### 5. 배포
1. "Deploy" 버튼 클릭
2. 배포 완료까지 1-2분 소요
3. 배포 완료 후 제공되는 URL로 접속하여 확인

## 3단계: 배포 확인

### 확인 사항
1. ✅ 랜딩 페이지 (`landing.html`) 접속 가능
2. ✅ 로그인/회원가입 기능 작동
3. ✅ 프로덕션 Supabase 데이터베이스 연결 확인
4. ✅ 모든 페이지 정상 작동 확인

### 커스텀 도메인 설정 (선택사항)
1. Vercel 대시보드 → 프로젝트 선택
2. "Settings" → "Domains"
3. 원하는 도메인 입력 및 DNS 설정

## 문제 해결

### 배포 후 Supabase 연결 오류
- `config.js`의 프로덕션 설정이 올바른지 확인
- Supabase 프로젝트의 RLS 정책이 올바르게 설정되었는지 확인

### 빌드 오류
- `vercel.json` 파일이 올바르게 생성되었는지 확인
- 정적 파일만 있으므로 빌드 과정이 필요 없습니다

## 참고사항

- Vercel은 무료 플랜에서도 충분히 사용 가능합니다
- 자동 배포: GitHub에 푸시하면 자동으로 재배포됩니다
- 환경 변수는 필요시 Vercel 대시보드에서 설정할 수 있습니다

