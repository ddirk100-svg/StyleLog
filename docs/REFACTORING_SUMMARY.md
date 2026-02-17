# 코드 리팩토링 요약

## 개선 사항

### 1. 공통 기능 통합 (`scripts/common.js`)

모든 페이지에서 공통으로 사용되는 기능들을 `scripts/common.js`로 통합하여 유지보수성을 향상시켰습니다.

#### 통합된 기능들:

- **로고 클릭 이벤트**: 모든 페이지의 로고를 클릭하면 홈(home.html)으로 이동
- **메뉴 팝업 관리**: 메뉴 버튼, 오버레이, 닫기 버튼 이벤트 통합
- **사용자 정보 로드**: 메뉴 팝업에 사용자 정보 표시
- **뒤로가기 버튼**: referrer 파라미터에 따라 적절한 페이지로 이동

### 2. 중복 코드 제거

#### 제거된 중복 코드:

- `scripts/home.js`: 메뉴 관련 코드 제거 (common.js로 이동)
- `scripts/calendar.js`: 메뉴 관련 코드 제거 (common.js로 이동)
- `scripts/detail.js`: 뒤로가기 버튼 이벤트 중복 제거 (common.js로 이동)
- HTML 파일들: 로고 클릭 이벤트의 `onclick` 속성 제거 (common.js로 이동)

### 3. 스크립트 로드 순서

모든 페이지에서 공통 스크립트를 다음과 같은 순서로 로드합니다:

```html
<script src="scripts/config.js"></script>
<script src="scripts/api.js"></script>
<script src="scripts/auth.js"></script>  <!-- 필요한 경우 -->
<script src="scripts/common.js"></script>  <!-- 공통 기능 -->
<script src="scripts/[페이지별 스크립트].js"></script>
```

## 파일 구조

```
scripts/
├── common.js      # 공통 기능 (로고, 메뉴, 뒤로가기)
├── auth.js        # 인증 관련
├── api.js         # API 호출
├── config.js      # 설정
├── home.js        # 홈 페이지
├── calendar.js    # 캘린더 페이지
├── detail.js      # 상세 페이지
├── month-detail.js # 월별 상세 페이지
├── write.js       # 작성 페이지
└── favorite.js     # 즐겨찾기 페이지
```

## 사용 방법

### 로고 클릭 기능

모든 페이지에서 `.logo` 클래스를 가진 요소는 자동으로 홈으로 이동하는 기능이 추가됩니다.

```html
<h1 class="logo">
    <img src="img/StyleLog_logo(Eng).png" alt="StyleLog" class="logo-img">
</h1>
```

### 메뉴 팝업

메뉴 팝업은 `#menuPopup` ID를 가진 요소에 대해 자동으로 초기화됩니다.

```html
<div class="menu-popup" id="menuPopup">
    <div class="menu-overlay"></div>
    <div class="menu-content">
        <!-- 메뉴 내용 -->
    </div>
</div>
```

### 뒤로가기 버튼

`.back-btn` 클래스를 가진 버튼은 자동으로 뒤로가기 기능이 추가됩니다. URL에 `referrer=calendar` 파라미터가 있으면 calendar.html로 이동합니다.

## 향후 개선 사항

1. **헤더 컴포넌트화**: 헤더 HTML을 JavaScript로 동적 생성하여 완전히 통합
2. **Bottom Navigation 통합**: bottom-nav도 공통 스크립트로 관리
3. **에러 핸들링 통합**: 공통 에러 처리 로직 추가
4. **로딩 상태 관리**: 공통 로딩 인디케이터 추가




