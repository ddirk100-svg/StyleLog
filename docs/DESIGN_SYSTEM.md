# StyleLog 디자인/퍼블리싱/개발 가이드

> 프로젝트 내 공통 컴포넌트, 레이아웃 패턴, 스타일 규칙을 정리한 가이드 문서입니다.

---

## 1. 프로젝트 구조

```
StyleLog_1.1V/
├── home.html          # 홈 (일별 리스트)
├── write.html          # 새 기록 작성
├── detail.html         # 기록 상세
├── mypage.html         # 마이페이지
├── edit-profile.html   # 내 정보 수정
├── inquiry.html        # 고객센터
├── inquiry-write.html  # 문의 작성
├── login.html          # 로그인
├── signup.html         # 회원가입
├── landing.html       # 랜딩
├── styles/
│   ├── variables.css   # 디자인 토큰 (색상, 간격, 폰트 등) - 단일 규칙 소스
│   ├── utils.css       # 공통 UI 유틸리티 (empty/error/loading/버튼/스피너)
│   ├── bottom-nav.css  # 하단 네비게이션
│   ├── write.css       # 작성 페이지 (헤더, 폼, 버튼)
│   ├── home.css        # 홈 페이지
│   ├── detail.css      # 상세 페이지
│   ├── mypage.css      # 마이페이지
│   ├── inquiry.css     # 고객센터
│   ├── auth.css        # 로그인/회원가입
│   ├── menu-popup.css  # 메뉴/필터 팝업 공통
│   └── ...
└── scripts/
```

---

## 2. 디자인 토큰 (Design Tokens)

**규칙: 모든 스타일은 `variables.css`의 CSS 변수(`var(--...)`)를 사용합니다.** 하드코딩된 색상/간격은 금지.

### 2.1 variables.css
- **색상**: `--color-primary`, `--color-text-primary`, `--color-bg-secondary`, `--chip-cold-bg` 등
- **간격**: `--spacing-sm`, `--spacing-md`, `--radius-sm` 등
- **폰트**: `--font-sans`, `--font-size-base`, `--font-weight-semibold` 등

### 2.2 utils.css (동적 생성 UI)
- `util-empty`, `util-error`, `util-loading`: 빈/에러/로딩 상태
- `util-btn-primary`: 주요 버튼
- `util-spinner-wrap`, `util-spinner`: 전역 로더 (config.js showLoading)
- `util-infinite-loader`, `util-end-message`: 무한스크롤용
- home.js 등에서 인라인 `style` 대신 위 클래스를 사용

---

## 3. 헤더 유형 (Page Header)

헤더는 용도별로 4가지 유형으로 그룹핑됩니다.

### 3.1 홈 헤더 (`.header`)
- **용도**: 메인 페이지, 로고 + 메뉴
- **구성**: 좌측 로고 | 우측 햄버거 메뉴
- **적용 페이지**: `home.html`

```html
<header class="header">
    <h1 class="logo"><img src="img/StyleLog_logo(Eng).png" alt="StyleLog" class="logo-img"></h1>
    <button class="icon-btn menu-btn">...</button>
</header>
```

### 3.2 작성형 헤더 (`.write-header`)
- **용도**: 폼 작성/수정, 뒤로가기 + 제목 + 액션 버튼
- **구성**: 좌측 뒤로가기 | 중앙 제목 | 우측 저장/완료
- **적용 페이지**: `write.html`, `inquiry.html`, `inquiry-write.html`, `edit-profile.html`

```html
<header class="write-header">
    <a href="이전페이지.html" class="icon-btn cancel-btn">
        <svg>...</svg><!-- 뒤로가기 아이콘 -->
    </a>
    <h1 class="header-title">페이지 제목</h1>
    <button type="submit" form="formId" class="text-btn save-btn">저장</button>
    <!-- 또는 우측 비어있으면: <div style="width: 40px;"></div> -->
</header>
```

### 3.3 상세형 헤더 (`.detail-header`)
- **용도**: 상세 페이지, 이미지 위 오버레이
- **구성**: 좌측 뒤로가기 | 우측 메뉴(⋮)
- **적용 페이지**: `detail.html`

```html
<header class="detail-header">
    <a href="home.html" class="icon-btn cancel-btn">...</a>
    <button class="icon-btn menu-btn">...</button>
</header>
```

### 3.4 마이페이지 헤더 (`.mypage-header`)
- **용도**: 제목만 있는 단순 헤더
- **구성**: 중앙 제목만
- **적용 페이지**: `mypage.html`

```html
<header class="mypage-header">
    <h1 class="header-title">마이페이지</h1>
</header>
```

---

## 4. 하단 네비게이션 (Bottom Nav)

모든 메인 페이지에서 동일한 구조를 사용합니다.

- **클래스**: `body.has-bottom-nav`, `nav.bottom-nav`
- **아이템**: 홈 | 작성 | 마이
- **현재 페이지**에 `.active` 부여

```html
<nav class="bottom-nav">
    <a href="home.html" class="bottom-nav-item [active]">
        <div class="bottom-nav-icon">...</div>
        <span class="bottom-nav-label">홈</span>
    </a>
    <a href="write.html" class="bottom-nav-item write-btn [active]">...</a>
    <a href="mypage.html" class="bottom-nav-item [active]">...</a>
</nav>
```

| 페이지 | active 적용 |
|--------|-------------|
| index, detail | 홈 |
| write | 작성 |
| mypage, edit-profile, inquiry, inquiry-write | 마이 |

---

## 5. 폼 컴포넌트

### 4.1 폼 그룹
- **`.form-section`**: 섹션 단위 (margin-bottom: 32px)
- **`.form-group`**: 레이블+입력 묶음 (auth, inquiry에서 사용)

### 4.2 레이블 & 입력
- **`.form-label`**: 라벨
- **`.form-input`**: 단일 라인 입력
- **`.form-textarea`**: 멀티라인
- **`.form-hint`**: 설명/도움말 텍스트

```html
<div class="form-section">
    <label class="form-label" for="id">레이블</label>
    <input type="text" id="id" class="form-input" placeholder="...">
    <p class="form-hint">선택 사항 안내 문구</p>
</div>
```

### 4.3 날씨적합도 버튼
- **`.weather-fit-btns`**: 버튼 그룹
- **`.weather-fit-btn`**: 개별 버튼, `.active`로 선택 상태

---

## 6. 버튼 유형

| 클래스 | 용도 | 예시 |
|--------|------|------|
| `.icon-btn` | 아이콘만 있는 버튼 | 뒤로가기, 메뉴 |
| `.text-btn` | 텍스트 버튼 (헤더 액션) | 저장, 완료 |
| `.cancel-btn` | 뒤로가기/취소 (icon-btn과 함께) | write-header 좌측 |
| `.save-btn` | 저장/완료 (text-btn과 함께) | write-header 우측 |
| `.auth-btn.primary` | 풀폭 주요 액션 | 로그인, 저장하기 |
| `.logout-btn` | 로그아웃 (마이페이지) | — |
| `.inquiry-write-btn` | 아웃라인 스타일 링크 | 문의 작성하기 |

---

## 7. 팝업/모달 패턴

### 6.1 메뉴 팝업 (`.menu-popup`)
- 오버레이 + 하단 슬라이드 업 컨텐츠
- `.active`로 표시

```html
<div class="menu-popup" id="menuPopup">
    <div class="menu-overlay"></div>
    <div class="menu-content">
        <button class="menu-item">...</button>
    </div>
</div>
```

### 6.2 메뉴 아이템 (`.menu-item`)
- 아이콘 + 라벨 + (선택) 화살표
- `.delete-menu-btn`: 삭제 액션 (빨간색)

---

## 8. 마이페이지 메뉴 아이템

링크 형태의 메뉴 (아이콘 + 라벨 + 화살표):

```html
<a href="edit-profile.html" class="menu-item">
    <span class="menu-icon">👤</span>
    <span class="menu-label">내 정보 수정</span>
    <span class="menu-arrow">›</span>
</a>
```

---

## 9. 칩/태그

- **날씨적합도 칩**: `day-weather-fit-chip`
- **필터 칩**: `filter-category-chip`, `filter-active-chip`

---

## 10. CSS 로딩 순서 (권장)

1. `variables.css` — 디자인 토큰
2. `bottom-nav.css` — 하단 네비 (has-bottom-nav 페이지)
3. 페이지별 스타일: `write.css`, `home.css`, `mypage.css` 등

> **주의**: `write.css`는 variables를 @import하고, 리셋/body/container를 포함합니다.  
> `home.css`, `auth.css` 등도 variables를 @import합니다.  
> `.cursor/rules/stylelog-design.mdc`, `stylelog-code.mdc` 참고.

---

## 11. 네이밍 규칙

- **BEM 유사**: `.block`, `.block-element`, `.block--modifier`
- **상태**: `.active`, `.disabled`, `.readonly`
- **역할**: `-btn`, `-header`, `-form`, `-section`

> **Cursor 규칙**: `.cursor/rules/stylelog-design.mdc`, `stylelog-code.mdc` 참고

---

## 12. 디자인 토큰 상세 (variables.css)

| 용도 | 변수 예시 |
|------|-----------|
| 색상 | `--color-primary`, `--color-accent`, `--color-text-primary` |
| 간격 | `--spacing-sm`, `--spacing-md`, `--spacing-xl` |
| 폰트 | `--font-size-md`, `--font-weight-semibold` |
| 반경 | `--radius-sm`, `--radius-md` |
| Z-index | `--z-index-sticky`, `--z-index-modal`, `--z-index-popup` |

---

## 13. 체크리스트 (신규 페이지 추가 시)

- [ ] 적절한 헤더 유형 선택 (write-header 권장: 폼 페이지)
- [ ] `body.has-bottom-nav` 적용 여부
- [ ] bottom-nav의 `.active` 설정
- [ ] variables.css, base.css(또는 write.css) 로드
- [ ] form-section / form-label / form-input 일관 사용
