# 스타일로그 — 방향·로드맵·기획 연결

한 줄: **거울샷 한 장 + 가벼운 태그로 기록을 쌓고, 날씨·상황·옷으로 다시 꺼낸 뒤, 나중에 추천·말로 고르기까지 간다.**

코드 버전은 `scripts/config.js`의 `APP_VERSION` (현재 **4.0V**). 배포·DB는 [WORKFLOW_GUIDE.md](WORKFLOW_GUIDE.md).

## 올바른 방향인가 (리뷰 요약)

**맞는 선택**

| 판단 | 이유 |
|------|------|
| 기록 → 회고 → 추천 → AI 순서 | 데이터가 없으면 추천이 공허하다. 지금은 2.x에서 **회고·필터**를 단단히 하고 있다. |
| 로그 우선 (옷장 빌더 아님) | 사업기획·시장조사와 같다. 거울샷 + 텍스트 품목이 입력 부담을 낮춘다. |
| 만족도 대신 즐겨찾기 | 제품·노션·법무가 같다. “성공 코디”는 별점이 아니라 즐겨찾기다. |
| 1.3V 기온 맞춤 유지, 3.0에서 확장 | 날씨 추천을 두 번 만들지 않는다. |
| 티켓이 “기존 필터·집계 재사용”을 명시 | 2.3 조합, 홈 착장 필터, 옷장 착용 수를 다시 만들 위험이 줄었다. |

**지켜야 할 리스크**

| 리스크 | 대응 |
|--------|------|
| 4.0 레퍼런스 **한 로그(type)** vs **별도 저장** 두 설계 | **결정: PRD v3** — `style_logs.log_kind` 단일 테이블. Notion 「별도 모델/테이블」 티켓은 **superseded**(문서만). |
| 5.0을 엔진 5개로 키우기 | 로드맵 Phase 5는 **말 한 번**이 본체, 나머지는 입력 처리 티켓으로만 쌓아 둠. |
| 로드맵 예시 문구에 “만족도” 잔존 | 서비스·티켓에는 없음. 노션 Vision 예시는 나중에 문구만 정리해도 됨. |
| TPO 컬럼 SQL | Alpha·리얼 각각 `docs/supabase/style_logs_add_tpo.sql` — 배포 체크리스트에 포함. |

**다음에 손대는 버전:** **5.0V** — AI·말로 고르기. 4.0V 레퍼런스·스크랩 **완료**(코드 기준).

## 기획 4단계 (Notion과 같음)

로컬에서도 같은 순서로 본다.

```
[1] 전략        사업기획안 — 왜, 누구, Pain, 차별화
[2] 로드맵      서비스 로드맵 — Phase, 버전 한 줄
[3] 프로젝트    버전별 프로젝트 — 목적, 성공 기준, 티켓 뷰
[4] 티켓        스타일로그 세부 프로젝트 DB — 구분·버전·기능명·상태·날짜
```

**Notion (JongIk 워크스페이스)**

| 단계 | 페이지 |
|------|--------|
| 허브 | [패션 스타일 로그](https://app.notion.com/p/2b7d7b16311780b4bdadf0c9953a0b59) |
| 구조 설명 | [StyleLog 작업 구조](https://app.notion.com/p/413d7b163117819889b3ed9655de1c28) |
| 로드맵 | [3. 서비스 로드맵](https://app.notion.com/p/364d7b1631178007a63ed0eb7f8cf283) |
| 버전 프로젝트 | [버전별 프로젝트](https://app.notion.com/p/413d7b16311781f0809be28ec9d623d5) |
| 티켓 DB | [스타일로그 세부 프로젝트](https://app.notion.com/p/364d7b163117803fb1b1eb80ec8f4800) |

참고만: [PRD](https://app.notion.com/p/2d0d7b16311780a8846aca20332d9b1d), 시장조사, 디자인 레퍼런스 — 티켓과 1:1이 아니다.

**작업 순서:** 로드맵 Phase 확인 → 해당 **N.NV 프로젝트** 페이지 → 티켓 `시작 전` → `진행 중` → `완료` → 코드·배포 → `APP_VERSION`·법무·SQL 반영.

## Phase ↔ 제품 (요약)

| Phase | 목표 | 현재 |
|-------|------|------|
| 1 기록 | 착장 데이터 축적 | 1.1V~1.3.1V, Admin 1.0V **완료** |
| 2 회고 | 과거 코디를 다시 꺼냄 | 2.0~2.3 **완료** (조합 회고 포함) |
| 3 추천 | 선택 시간 단축 | 3.0V **완료** (기온+상태·즐겨찾기·조합 제안·옷장 페어) |
| 4 탐색 | 레퍼런스·영감 연결 | 4.0V **완료** (`log_kind`, 스크랩 묶음) |
| 5 AI | 말로 의사결정 | 5.0 티켓 **시작 전** |

## 버전별 링크 (Notion 프로젝트)

| 버전 | 프로젝트 페이지 | 비고 |
|------|----------------|------|
| 2.3V | [2.3V 프로젝트](https://app.notion.com/p/413d7b16311781b5aac6e69e3026f5fe) | 조합 회고 **완료** |
| 3.0V | [3.0V 프로젝트](https://app.notion.com/p/413d7b163117813dbea4cd9a13133616) | 추천 4티켓 **완료** |
| 4.0V | [4.0V 프로젝트](https://app.notion.com/p/413d7b16311781ba81c5d715b27ad4e7) | PRD v3 단일 테이블 **완료** |
| 5.0V | [5.0V 프로젝트](https://app.notion.com/p/413d7b16311781ea92edded39df1bc36) | |

2.0V~2.2V 완료 내역은 티켓 DB에서 `버전` + `상태=완료`로 본다. 제품 설명은 [PRODUCT.md](PRODUCT.md).

## 버전 릴리스 체크리스트 (개발자)

1. Notion: 해당 버전 티켓 완료 처리, 로드맵 ✅는 의미 있을 때만 수동 반영  
2. `APP_VERSION` (`scripts/config.js`)  
3. 필요 시 Supabase SQL (문서 `docs/supabase/`) — Alpha와 리얼 **둘 다**  
4. 약관·개인정보 스냅샷 필요 시 `legal/` ([legal-versions.md](legal-versions.md))  
5. [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md), [CODE_HEALTH.md](CODE_HEALTH.md) 점검  
6. `alpha` 푸시 → 확인 → `main` 푸시 ([WORKFLOW_GUIDE.md](WORKFLOW_GUIDE.md))

## 지금 코드와 로드맵 정합

| 로드맵 의도 | 코드에 있는 것 |
|-------------|----------------|
| 날씨·기온 기록·필터 | Open-Meteo, 홈 슬라이더, `weather_fit` |
| 상황(TPO) | `tpo[]`, 홈 상황 필터, 다섯 칩 |
| 아이템·옷장·착장 필터 | `items`, wardrobe, 홈 outfit filter |
| 즐겨찾기 = 만족 대체 | `is_favorite` |
| 오늘 기온 맞춤 | 홈 recommend switch |
| 조합 분석 | `combinations.html`, 홈 착장 필터 AND 딥링크 |
| 3.0 추천 | `recommendation.js`, 홈 정렬·조합 제안, 옷장 페어 |
| 4.0 레퍼런스 | `log_kind`, 홈 종류 필터, `scrap.html`, 작성·상세 |

## 같이 보는 로컬 문서

- 지금 제품: [PRODUCT.md](PRODUCT.md)  
- 화면·토큰: [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md)  
- 배포·환경: [WORKFLOW_GUIDE.md](WORKFLOW_GUIDE.md)  
- 페이지 IA: [PAGE_STRUCTURE.md](PAGE_STRUCTURE.md)
