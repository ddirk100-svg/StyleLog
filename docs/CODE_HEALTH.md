# StyleLog 코드·보안·성능 체크리스트 (앱 UI)

> 관리자(`admin-*`) 페이지는 별도. 아래는 `home` / `write` / `detail` / `mypage` 중심.

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
| 이미지 URL | `safeStyleLogMediaUrl` — `http(s)`·상대 경로만, `javascript:`/`data:` 차단 |
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
