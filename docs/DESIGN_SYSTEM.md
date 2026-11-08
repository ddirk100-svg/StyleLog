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

### 2.3 버튼·글자

글꼴은 Pretendard 하나다. 크기는 `--font-size-xs`부터 `--font-size-4xl`, 역할은 `--type-*`만 쓴다. 스타일시트에 px 글자 크기를 새로 적지 않는다.

- 화면을 확정하는 채움 버튼(필터 적용, 크롭 적용, 빈 화면의 주요 동작)은 `--color-btn-solid-bg`와 `--color-btn-solid-fg`다. 높이 `--btn-height-md`, 모서리 `--btn-radius`, 글자 `--font-size-base`에 semibold.
- 헤더의 저장·뒤로 옆 링크·포커스 링은 `--color-link-action`(파랑)이다. 채움 버튼을 파랑으로 칠하지 않는다.
- 아직 누를 수 없으면 `disabled`다. 배경은 `--color-bg-muted`, 글자는 `--color-text-tertiary`라서 눌러도 되는 검정 버튼과 구분된다.
- 스위치 트랙은 `--radius-pill`이다. `--radius-full`(50%)은 정사각형에만 쓴다. 가로로 긴 트랙에 50%를 주면 타원이 된다. 켜진 트랙은 `--switch-track-on`(본문색)이다.
- 필수 아님 표시 `(선택)`, `(추천)`은 `.form-label-optional`이다. 색은 `--color-text-tertiary`, 굵기는 보통, 크기는 `--font-size-sm`. 라벨 문장 안에 괄호만 붙여 쓰지 않는다.
- 상황 칩은 다섯 개다. 회사, 일상/데이트, 여행, 운동, 경조사. 예전 출근·면접은 회사로, 일상·데이트·약속은 일상/데이트로, 하객은 경조사로 묶여 보인다.
- 착장 품목 추가는 구분 시트를 거치지 않고 옷장 선택으로 바로 들어간다. 옷장 선택에는 전체 구분이 없다. 구분을 고른 뒤 그 안의 옷을 고른다. 연필로 이름을 바꾸면 작성 중인 줄, 옷장, 지난 기록에 같이 반영된다.
- 홈에서 상세로 들어가면 상세는 맨 위다. 상세에서 홈으로 돌아오면 보던 카드와 필터 위치를 유지한다.

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

| 클래스 | 용도 | radius |
|--------|------|--------|
| `.sl-btn-solid` / `.util-btn-primary` / `.auth-btn.primary` / `.btn-primary` | 풀폭·주요 액션 | `--btn-radius` |
| `.sl-btn-outline` / `.util-btn-secondary` / `.logout-btn` | 보조·아웃라인 | `--btn-radius` |
| `.text-btn` | 헤더 텍스트 액션 (저장) | 없음 (텍스트만) |
| `.icon-btn` | 아이콘만 | 없음 또는 원형 `--radius-full` |
| `.filter-category-chip` / `.weather-fit-btn` | pill 선택 | `--chip-radius` |
| `.stylelog-dialog-btn` | 확인·취소 | `--btn-radius` |

색상: filled → `--color-btn-solid-*`, 링크형 텍스트 → `--color-link-action`.  
상세 토큰은 `variables.css` 「버튼」·「필터·기온 칩」 블록 참고.

---

## 14. Border radius (모서리 — 통일 규칙)

**단일 소스:** `styles/variables.css`  
**전역 보강:** `styles/utils.css` 의 「Radius contract」 선택자

| 역할 | CSS 변수 | 값 | 적용 예 |
|------|-----------|-----|---------|
| 액션 버튼 | `--btn-radius` | 12px (`--radius-md`) | 로그인, 필터 적용, 작성 저장, 다이얼로그 |
| Pill 칩 | `--chip-radius` | 9999px | 홈 필터, 기온 칩, 체감, 옷장 카테고리 |
| 입력 | `--input-radius` | 8px | `.form-input`, `.form-textarea` |
| 표면 카드 | `--surface-radius` | 16px | 홈 날씨·기온 가이드 카드 |
| 사진 | `--photo-radius` | 12px | 피드·상세 코디 사진 |
| 뱃지 | `--badge-radius` | 6px | 상태 뱃지 (버튼 아님) |
| 바텀시트 상단 | `--modal-sheet-top-radius` | 20px | 필터 모달·메뉴 시트 |
| 원형만 | `--radius-full` | 50% | FAB, 즐겨찾기, 아바타 |

**금지:** 버튼·칩에 `border-radius: 8px` / `10px` / `999px` 등 **직접 숫자** — 반드시 위 변수 사용.

---

## 15. Spacing (패딩·마진 — 4px 그리드)

**단일 소스:** `variables.css` (`--spacing-*` + 시맨틱 alias)  
**보강:** `utils.css` (폼·헤더·칩·empty state)

| 변수 | 값 | 용도 |
|------|-----|------|
| `--page-inset-x` | 16px | 화면 좌우 기본 여백 (피드·폼·헤더) |
| `--section-gap-y` | 24px | 섹션 사이 (코디 모음 ↔ 필터 등) |
| `--block-gap-y` | 16px | 블록 내부 덩어리 (상세 날짜 ↔ 제목) |
| `--stack-gap-y` | 12px | 한 줄 요소 간격 |
| `--feed-item-gap` | 24px | 홈 코디 카드 간격 |
| `--surface-padding` | 20px | 카드 내부 |
| `--surface-padding-lg` | 24px | 날씨 등 큰 카드 |
| `--form-section-gap` | 32px | 작성 폼 섹션 간 |
| `--form-field-gap` | 12px | 레이블 ↔ 입력 |
| `--page-padding-bottom-nav` | calc | 하단 탭 + safe-area + 24px |
| `--chip-padding-y/x` | 8 / 12 | pill 칩 |

**금지:** `padding: 20px`, `margin-bottom: 32px` 등 임의 px — `--spacing-*` 또는 위 alias.

---

## 16. Typography (폰트)

| 역할 | 변수 | 크기 |
|------|------|------|
| 본문 | `--type-body-*` | 14px / line 1.5 |
| 캡션·날짜(피드) | `--type-caption-*` | 13px |
| 폼 레이블 | `--type-label-*` | 14px semibold |
| 입력 | `--type-input-size` | 15px |
| 섹션·페이지 제목 | `--type-section-title-*`, `--type-page-title-*` | 18px |
| 상세 제목 | `--type-detail-title-*` | 24px |
| 날씨 숫자 | `--type-weather-display-*` | 56px / weight 200 |

유틸 클래스: `.sl-section-title`, `.sl-type-caption`, `.sl-label`, `.sl-date` (`utils.css`)  
전역 `body`는 `--type-body-*` 적용.

---

## 17. Date & time (날짜·시간 표기)

**단일 함수:** `formatStyleLogDate(input, style)` — `scripts/common.js`  
**스타일 클래스:** `.sl-date`, `.sl-date--detail`, `.sl-date--datetime` — `utils.css`

| style | 형식 | 쓰는 곳 | 통일 여부 |
|-------|------|---------|-----------|
| `card` | 올해 `MM.DD 요일` / 그 외 `YYYY.MM.DD 요일` | 홈 코디 카드, **오늘 날씨** 보조 줄 | ✅ 코디·위젯 동일 |
| `detail` | `YYYY.MM.DD 요일` (짧은 요일 `월`~`일`) | 상세 `.date-label` | ✅ 항상 연도 |
| `datetime` | `YYYY.MM.DD HH:mm` (24시간, 요일 없음) | 고객센터 접수·답변 시각 | ✅ 이벤트 시각 전용 |
| `iso` | `YYYY-MM-DD` | DB·URL·`<input type="date">` value | 저장 전용 |

**의도적으로 다른 표기 (바꾸지 않음)**

| 맥락 | 예 | 이유 |
|------|-----|------|
| 피드 **연·월 스티키** | `2025년`, `3월` | 타임라인 뼈대 — 코디 “그날” 라벨과 역할 다름 |
| **필터 칩** | `2024년`, `3, 4월` | 선택 상태 요약 |
| **작성 `<input type="date">`** | OS/브라우저 로케일 | 네이티브 피커 — value만 `iso` |
| **약관 시행일** | `2026년 5월 26일` | 법무 문장형 |
| **관리자 콘솔** | `toLocaleString('ko-KR')` | 운영 도구 — 앱 UI와 분리 |

**금지:** 코디/피드/상세에서 `2월 17일 화요일`, `2026. 2. 13.`, `금요일` 전체 표기, `toLocaleDateString` 임의 사용.

---

## 18. Overlays · bottom sheets · dialogs

| 레이어 | z-index | 스타일 |
|--------|---------|--------|
| 하단 탭 | `--z-index-modal` (1000) | `bottom-nav.css` |
| **앱 시트** (필터, 상세 날씨, 햄버거 메뉴*) | `--z-index-app-sheet` (9600) | 상단 radius `--modal-sheet-top-radius`, dim `--modal-overlay` |
| 작성 착장 시트 / 크롭 | 9935–9945 | `write.css` |
| **다이얼로그** (alert·confirm·피드백) | 10000 | `dialog.css` · `--btn-radius` |
| 생년월일 필수 | 100002 | `require-birthdate.css` |

\*홈 햄버거는 `home.css`에서 **우측 드로어**로 재정의 — 토큰(여백·타이포)은 동일.

**공통 contract (`utils.css`):** `.sl-sheet-title`, `.sl-sheet-footer` — 시트 제목·푸터 safe-area.

**UX:** 시트 열릴 때 `body` 스크롤 잠금 · **Esc**로 필터·메뉴 닫기 · 푸터 `env(safe-area-inset-bottom)`.

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
