# StyleLog 코드·보안·성능 체크리스트 (앱 UI)

> 관리자(`admin-*`) 페이지는 별도. 아래는 `home` / `write` / `detail` / `mypage` 중심.

## UI 용어 (사용자-facing)

| 개념 | 통일 표기 | 비고 |
|------|-----------|------|
| 하루 기록 | **코디** | 착장(동사/마케팅)과 혼용 금지 |
| items[] 한 줄 | **착장 품목** | 「품목」만, 「착장」만 단독 라벨 지양 |
| category | **구분** | 아우터·상의 등 |
| wardrobe | **옷** / **내 옷장** | |
| 홈 필터 탭 | **착장** (칩) | `title`·칩 본문은 「착장 품목」 |

## UI 안내 문구 (줄바꿈)

| 규칙 | 적용 |
|------|------|
| 공통 클래스 | `write-ui-copy` + `write-ui-copy__line` (`utils.css`) |
| JS 동적 문구 | `setUiCopyLines()` (`common.js`) |
| 기준 폭 | 320px — 짧은 문장·2줄 분리, `word-break: keep-all` |
| 점검 화면 | write, wardrobe(옷 추가·정책), home(기온 맞춤·빈 목록), mypage, inquiry, edit-profile, 생년월일 모달 |

## UX · 중복 동선

| 항목 | 원칙 |
|------|------|
| 마이 옷장 | **통계 타일 1곳**만 (`wardrobe.html`) — 메뉴 중복 링크 제거 |
| 필터 | 활성 조건 없으면 **칩 행·초기화 숨김** — `getActiveFilterChips().length` 기준 |
| 오늘 기온 맞춤 | 칩 **`오늘 기온 맞춤` 1개** — 기온 칩과 이중 표기 방지 |
| 필터 모달 | 선택 없을 때 **「선택 초기화」** 숨김 (`.has-selection`) |

## 보안

| 항목 | 조치 |
|------|------|
| 사용자 텍스트 (제목·메모) | `escapeHtml` / `escapeHtmlForDayCard` |
| 필터 칩 라벨 | `escapeHtml` + `data-key` 이스케이프 |
| 이미지 URL | `safeStyleLogMediaUrl` — `http(s)`·상대·안전한 `data:image/*;base64`만 |
| API 키 | `config.js` — 클라이언트 anon key만 (RLS 전제) |

## 성능

| 항목 | 조치 |
|------|------|
| 마이 통계 | `getCurrentUser` **1회** · total/fav/today/옷장 **병렬** `Promise.all` |
| 홈 피드 | `DocumentFragment` · lazy 이미지 · 무한 스크롤 유지 |
| 날씨 (홈) | `updateTodayInfo` 비차단 |

## 레이어 · z-index

`DESIGN_SYSTEM.md` §18 — `--z-index-app-sheet` (9600) > 하단 탭 (1000).

## 회귀 확인 (수동)

1. 홈: 맞춤 토글 → 칩 1개 → × 또는 초기화  
2. 필터 모달: 선택 전에는 하단 「선택 초기화」 없음  
3. 마이: 「내 옷장」 타일만 → 옷장 이동  
4. 상세: ⋮ 수정/삭제 · 사진 URL 정상  
5. 홈: 필터 적용 → 상세 → 뒤로 → **필터·스크롤 유지**  
6. 작성: 옷장 시트 → 탭 추가/「추가됨」/재탭 제거  

## 정적 점검 (2026-11)

| 영역 | 상태 | 비고 |
|------|------|------|
| `scripts/*.js` 구문 | ✅ `node --check` | 2.2 배포 전 재실행 |
| `common.js` / `utils.css` 캐시 | ✅ 작성·홈·상세는 common v16, utils는 작성 v9 | `(선택)` 스타일은 `utils.css` |
| 디자인 토큰 | ✅ | 신규 UI는 `variables.css`·`utils.css` contract |
| `write-ui-copy` | ✅ | write·wardrobe·home·mypage·inquiry·생년월일 |
| 보안 (XSS·미디어 URL) | ✅ | `escapeHtml`·`safeStyleLogMediaUrl` |
| 홈 필터 복귀 | ✅ | `stylelog_home_filter_state` + `homeScrollY` |
| 썸네일 | ✅ | 목록은 `thumb_url`만 select · 저장 시 display URL |
| 상세 복귀 후 맞춤 토글 | ✅ | `bindRecommendModeToggle` — 필터 복원 시에도 클릭 핸들러 등록 |
| 옷장 신규 추가→선택 | ✅ | `forceAdd` — 기존 착장 품목과 겹쳐도 제거하지 않음 |
| 상황 다섯 개 | ✅ | 회사·일상/데이트·여행·운동·경조사. 예전 코드는 `normalizeTpoValues` |
| 상세 진입 스크롤 | ✅ | 상세는 맨 위. 홈 복귀 스크롤·필터는 유지. `scrollRestoration`은 바꾸지 않음 |
| 옷장 선택에서 이름 변경 | ✅ | `renameOutfitItemValueAcrossLogs` — 작성 줄·옷장·지난 기록 |
| 홈 카드 id | ✅ | 상세 URL은 `encodeURIComponent`, 복귀 카드 선택은 `CSS.escape` |
| Dead code | ✅ | `createThumbnail` 제거 (미사용) |

## 성능 · 한계 (의도적)

| 항목 | 동작 | 개선 여지 |
|------|------|-----------|
| 홈 착장 품목 필터 | 조건 있으면 **전량 로드** 후 필터 | 데이터 많을 때 대기; `ensureAllDataLoadedForFilter` |
| 옷장 시트 토글 | `requestAnimationFrame`으로 행+목록 **한 번에** repaint | |
| 마이 통계 | `Promise.all` 4-way | ✅ |
| 홈 피드 | pagination + `DocumentFragment` | ✅ |
| 날씨 | non-blocking `refreshCachedTodayTemps` | ✅ |

## 가이드 미적용·범위 밖

- **landing / login / signup**: Tailwind 별도 스택 (앱 `variables.css`와 분리)  
- **admin-\***: CODE_HEALTH 앱 UI 범위 제외  
- **FAQ 본문**: inquiry.html 정적 HTML (줄바꿈 CSS만 `faq-body p`)
