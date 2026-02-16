# 스타일로그 (StyleLog)

> "오늘 뭐입지?" - 1030 패션에 관심있는 사람들을 위한 착장 기록 서비스

## 📋 프로젝트 소개

스타일로그는 일상의 패션 선택을 기록하고, 날씨와 상황에 맞는 스타일을 찾아갈 수 있도록 돕는 서비스입니다.

### v1.2 기능
- ✅ 착장 기록 CRUD (사진, 날짜, 메모, 즐겨찾기)
- ✅ 홈 화면: 연도 선택 + 월별 카드 가로 스크롤 + 일별 리스트
- ✅ **날씨 필터**: 최저/최고 슬라이더 + 드롭다운(오늘/전체/커스텀)
- ✅ **과거 날씨 조회**: 90일 이전도 Archive API로 조회 가능 (1940년~)
- ✅ 즐겨찾기 기능 및 별도 목록
- ✅ Supabase 인증 (로그인/회원가입)
- ✅ 날씨 정보 표시 (실시간 + 과거)

## 🗂️ 프로젝트 구조

```
stylelog/
├── index.html              # 홈 화면
├── write.html              # 착장 작성/수정
├── detail.html             # 상세 보기
├── mypage.html             # 마이페이지
├── landing.html            # 랜딩 페이지
├── login.html              # 로그인
├── signup.html             # 회원가입
├── styles/
│   ├── home.css
│   ├── detail.css
│   ├── write.css
│   ├── month-detail.css
│   ├── landing.css
│   ├── auth.css
│   ├── bottom-nav.css
│   ├── menu-popup.css
│   ├── weather-compact.css
│   └── variables.css
└── scripts/
    ├── home.js
    ├── detail.js
    ├── write.js
    ├── mypage.js
    ├── config.js
    ├── api.js
    ├── common.js
    └── auth.js
```

## 🚀 배포 환경

| 환경 | URL | DB |
|------|-----|-----|
| **프로덕션** | https://stylelog.vercel.app | 리얼 DB |
| **Alpha** | https://stylelog-git-alpha-jongiks-projects.vercel.app | 테스트 DB |
| **로컬** | http://localhost:8000 | 테스트 DB |

### 배포 방법
- **Alpha 배포**: `deploy-to-alpha.bat` 실행
- **프로덕션 배포**: Alpha 테스트 후 `deploy-alpha-to-real.bat` 실행

## 🎨 주요 기능

### 홈 화면 (index.html)
- 연도 선택 드롭다운
- 월별 카드 가로 스크롤 (스와이프)
- 일별 리스트 (월 카드 선택 시)
- **날씨 필터**: 최저/최고 온도 슬라이더 + 드롭다운(오늘/전체/커스텀)
- 오늘 날씨 기반 자동 필터 ("오늘" 선택 시)
- Today 버튼으로 현재 월 스크롤

### 날씨
- **Open-Meteo API** (무료, API 키 불필요)
- 최근 날짜: Forecast API / 과거 날짜: Archive API
- **90일 이전 기록**도 Archive API로 날씨 조회 (1940년~)
- 서울 기준

### 즐겨찾기
- 상세 화면에서 하트 아이콘으로 등록
- 홈 필터에서 "즐겨찾기만 보기" 선택 또는 마이페이지 "즐겨찾기 보기" 링크로 조회

### 마이페이지 (mypage.html)
- 프로필(이메일) 및 기록/즐겨찾기 통계
- 즐겨찾기 보기(홈 필터 적용), 새 기록 작성 링크
- 로그아웃

## 🚀 실행 방법

### 사전 준비
1. **Supabase 테이블 생성**
   - `database/setup.sql` 실행
   - `database/add_temp_columns.sql` 실행 (weather_temp_min/max)

2. **config.js 설정**
   - Supabase URL, ANON_KEY 입력
   - 날씨는 Open-Meteo 사용으로 API 키 불필요

### 로컬 실행
```bash
python -m http.server 8000
# 또는
npx http-server
```
`http://localhost:8000/landing.html` 접속

## 📊 데이터베이스 (style_logs)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID | 고유 ID |
| date | DATE | 착장 날짜 |
| title | TEXT | 제목 |
| content | TEXT | 본문 |
| weather | TEXT | 날씨 |
| weather_temp | NUMERIC | 현재 기온 |
| weather_temp_min | NUMERIC | 최저 기온 |
| weather_temp_max | NUMERIC | 최고 기온 |
| photos | TEXT[] | 사진 URL 배열 |
| is_favorite | BOOLEAN | 즐겨찾기 |
| created_at, updated_at | TIMESTAMP | 생성/수정 시간 |

## 📱 기술 스택

- **Frontend**: HTML5, CSS3, JavaScript (Vanilla)
- **Backend/DB**: Supabase (PostgreSQL)
- **날씨 API**: Open-Meteo (Forecast + Archive)
- **배포**: Vercel

---

**버전:** v1.2
