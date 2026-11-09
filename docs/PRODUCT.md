# 스타일로그 4.0 — 지금 서비스가 하는 일

하루 코디를 남기고, 날씨와 상황으로 다시 찾는 기록 앱이다. **레퍼런스**는 같은 `style_logs` 한 테이블에 `log_kind` 로 구분한다. 버전 표기는 `scripts/config.js`의 `APP_VERSION`.

전략·Phase·Notion 티켓 연결은 [ROADMAP.md](ROADMAP.md).

## 사용자가 하는 일

1. **내 착장** — 사진을 3:4로 맞추고, 그날 날씨·체감·상황·착장 품목·메모를 남긴다.
2. **레퍼런스** — 링크·메모·착장 품목·스크랩 묶음 이름으로 붙여 둔 룩북·코디를 저장한다. 홈 기본 목록은 내 착장만 보여 주고, 필터 **종류**로 레퍼런스를 볼 수 있다.
3. 홈 **오늘 기온에 맞춰 보기**·**오늘 입을 만한 조합**은 **내 착장** 기록만 쓴다.
4. 상세에서 레퍼런스를 **내 코디로 옮기기**, 옷장 품목으로 **가진 옷으로 대체** 초안을 연다.
5. **스크랩 묶음** 화면에서 묶음별로 홈 필터를 연다.
6. 2.x·3.x — 옷장, 조합 회고, 즐겨찾기, 착장 필터 등은 그대로.

## 4.0 설계 (PRD v3)

- 별도 `reference` 테이블·공개 피드·5.0 AI 는 범위 밖.
- Notion 「별도 모델」 티켓은 단일 테이블 `log_kind` 로 **대체( superseded )** — [ROADMAP.md](ROADMAP.md) 참고.

## 같이 보는 문서

- 방향·로드맵: `docs/ROADMAP.md`
- 화면 규칙: `docs/DESIGN_SYSTEM.md`
- DB: `docs/supabase/style_logs_add_log_kind.sql`
- 배포: `docs/WORKFLOW_GUIDE.md`, `README.md`
