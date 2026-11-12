# 스타일로그 — 지금 서비스가 하는 일

하루 코디를 남기고, 날씨와 상황으로 다시 찾는 기록 앱이다. 버전 표기는 `scripts/config.js`의 `APP_VERSION` (현재 **5.0V**).

전략·Phase·Notion 티켓 연결은 [ROADMAP.md](ROADMAP.md).

## 사용자가 하는 일

1. **내 착장** — 사진을 3:4로 맞추고, 그날 날씨·체감·상황·착장 품목·메모를 남긴다.
2. 홈 **오늘 기온에 맞춰 보기**·**오늘 입을 만한 조합**은 **내 착장** 기록만 쓴다.
3. **자주 입는 조합**·옷장·즐겨찾기·착장 필터 (2.x·3.x)는 그대로.

## 4.1V에서 빠진 것 (레퍼런스)

- 레퍼런스 작성, 스크랩 묶음, 홈 「종류」 필터, 「내 코디로 옮기기」 등 **4.0 레퍼런스 UX 전부 제거**.
- DB에 `log_kind=reference` 등 **남아 있는 예전 데이터는 홈·추천에서 숨김** (삭제/마이그레이션은 운영 선택).
- 같은 기획 의도(외부 영감)는 **추후 공개 피드 + 좋아요** 로 대체 예정 (백로그).

## 5.0V — 코디에게 물어보기

- 마이 → **코디에게 물어보기** (`assistant.html`)
- **내 착장 기록만** RAG로 넣어 ChatGPT가 답함 (`POST /api/style-assistant/chat`)
- 키·배포: [AI_ASSISTANT.md](AI_ASSISTANT.md)

## 같이 보는 문서

- 방향·로드맵: `docs/ROADMAP.md`
- 화면 규칙: `docs/DESIGN_SYSTEM.md`
- 배포: `docs/WORKFLOW_GUIDE.md`, `README.md`
