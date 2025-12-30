# 스타일로그 (StyleLog)

> "오늘 뭐입지?" - 1030 패션에 관심있는 사람들을 위한 착장 기록 서비스

## 📋 프로젝트 소개

스타일로그는 일상의 패션 선택을 기록하고, 날씨와 상황에 맞는 스타일을 찾아갈 수 있도록 돕는 서비스입니다.

### v1 (MVP) 기능
- ✅ 착장 기록 CRUD (사진, 날짜, 메모, 즐겨찾기)
- ✅ 월별/일별 캘린더 뷰
- ✅ 리스트 조회 (최신순)
- ✅ 날씨 정보 표시

## 🗂️ 프로젝트 구조

```
stylelog/
├── index.html              # 홈 화면 - 월별 카드뷰 (개요)
├── home-photo.html         # 홈 화면 - 월별 카드뷰 (사진)
├── month-detail.html       # 월별 상세 - 일별 리스트
├── calendar.html           # 캘린더 뷰
├── detail.html             # 콘텐츠 상세 (사진 포함) ✨
├── detail-no-photo.html    # 콘텐츠 상세 (텍스트만) ✨
├── prd.md                  # 제품 기획 문서
├── styles/
│   ├── home.css           # 홈 화면 스타일
│   ├── month-detail.css   # 월별 상세 스타일
│   ├── calendar.css       # 캘린더 스타일
│   └── detail.css         # 콘텐츠 상세 스타일 ✨
└── scripts/
    ├── home.js            # 홈 화면 스크립트
    ├── month-detail.js    # 월별 상세 스크립트
    ├── calendar.js        # 캘린더 스크립트
    └── detail.js          # 콘텐츠 상세 스크립트 ✨
```

## 🎨 화면 구성

### 1. 홈 화면 (index.html, home-photo.html)
- 검색/메뉴 버튼
- 연도 선택 드롭다운
- **Year/Month/Day 뷰 모드 전환 버튼** ✨
- 월별 카드 가로 스크롤 (12개월 전체)
- **마우스/터치 스와이프 드래그 기능** ✨
- **관성 스크롤 효과** ✨
- 날짜/날씨 정보 표시
- 작성/캘린더 플로팅 버튼
- Today 버튼 (현재 월로 자동 스크롤)

**두 가지 스타일:**
- `index.html` - 파란색 그라데이션 카드 (개요)
- `home-photo.html` - 대표 사진이 들어간 카드

### 2. 월별 상세 (month-detail.html)
- 일별 기록 리스트 (세로 스크롤)
- 사진 또는 메모 표시
- 날짜, 요일, 날씨 아이콘
- 수정/삭제 버튼

### 3. 캘린더 뷰 (calendar.html)
- 월별 캘린더
- 기록이 있는 날 강조 표시
- 날짜 선택하여 작성/조회

## 🚀 실행 방법

### 사전 준비

1. **Supabase 테이블 생성**
   - Supabase 대시보드 → SQL Editor
   - `database/setup.sql` 파일의 내용을 복사하여 실행
   - 샘플 데이터가 자동으로 삽입됨

2. **날씨 API 키 설정 (선택사항)**
   - OpenWeatherMap 가입: https://openweathermap.org/api
   - API 키 발급 (무료 - 하루 1,000번 호출)
   - `scripts/config.js`에서 `WEATHER_API_KEY` 입력
   - 자세한 가이드: `docs/weather-api-setup.md` 참고

### 실행하기

1. 프로젝트 폴더를 다운로드합니다
2. 로컬 서버를 실행합니다:

```bash
# Python 3
python -m http.server 8000

# Node.js (http-server)
npx http-server

# VS Code Live Server 확장 프로그램 사용
```

3. 브라우저에서 `http://localhost:8000` 접속

## 🎯 다음 단계 (v2 이후)

- [ ] v2: 의류 구분 입력 (상의/하의/아우터/신발)
- [ ] v3: 외부 레퍼런스 저장
- [ ] v4: AI 기반 착장 추천
- [ ] 백엔드 API 연동
- [ ] 사용자 인증/로그인
- [ ] 데이터 저장소 구현

## 📱 기술 스택

- **Frontend**: HTML5, CSS3, JavaScript (Vanilla)
- **Design**: 모바일 퍼스트, 반응형 디자인
- **Target**: iOS/Android 모바일 브라우저

## 💡 주요 기능

### 인터랙션
- **뷰 모드 전환**: Year/Month/Day 세 가지 보기 방식
- **스와이프 드래그**: 마우스/터치로 부드럽게 카드 스크롤
- **관성 스크롤**: 스와이프 속도에 따른 자연스러운 스크롤
- **스냅 스크롤**: 카드가 중앙에 정렬되는 스냅 효과
- **날씨 선택 모달**: 바텀 시트 스타일의 날씨 선택 UI
- 캘린더 스와이프 제스처
- Today 버튼으로 현재 월 빠른 이동
- 부드러운 애니메이션 및 전환 효과
- 페이지 간 상태 유지 (연도/월/날짜 정보)

### 디자인 특징
- 깔끔한 미니멀 디자인
- 파스텔 컬러 팔레트
- 카드 기반 레이아웃
- 직관적인 아이콘 사용
- **투명 헤더**: 사진 위에 그라데이션 헤더
- **바텀 시트 모달**: 자연스러운 슬라이드 업 애니메이션

## 📝 라이선스

MIT License

---

## 🔧 기술 스택

### Frontend
- **HTML5, CSS3, JavaScript (Vanilla)**
- 모바일 퍼스트, 반응형 디자인

### Backend & Database
- **Supabase** (PostgreSQL)
  - 실시간 데이터베이스
  - Row Level Security
  - RESTful API 자동 생성

### API
- **OpenWeatherMap API**
  - 실시간 날씨 정보
  - 위치 기반 자동 감지
  - 무료 플랜 (1,000회/일)

---

## 📊 데이터베이스 구조

### style_logs 테이블

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID | 고유 ID (자동 생성) |
| date | DATE | 착장 날짜 |
| title | TEXT | 제목 |
| content | TEXT | 본문 |
| weather | TEXT | 날씨 (sunny/cloudy/rainy/snowy/lightning) |
| weather_temp | NUMERIC | 기온 (°C) |
| weather_description | TEXT | 날씨 설명 |
| photos | TEXT[] | 사진 URL 배열 |
| tags | TEXT[] | 태그 배열 |
| is_favorite | BOOLEAN | 즐겨찾기 |
| created_at | TIMESTAMP | 생성 시간 |
| updated_at | TIMESTAMP | 수정 시간 |

---

## 🔑 환경 설정

### config.js
```javascript
// Supabase
const SUPABASE_URL = 'your-project-url';
const SUPABASE_ANON_KEY = 'your-anon-key';

// 날씨 API (선택사항)
const WEATHER_API_KEY = 'your-weather-api-key';
```

---

**만든 사람:** StyleLog Team  
**버전:** v1.0 (MVP) + Supabase 연동

