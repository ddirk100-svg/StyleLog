# 5.0 AI 스타일 어시스턴트 (RAG) — 키·환경

ChatGPT API는 **서버(Vercel serverless)에서만** 사용한다. 브라우저·`scripts/config.js`·GitHub에 키를 두지 않는다.

## 로컬 (`npm run dev`)

프로젝트 루트 `.env.local` (이미 gitignore)에 추가:

```env
OPENAI_API_KEY=sk-...
```

`scripts/local-api-dev.js`가 `.env.local`을 `process.env`로 로드한다. API: `POST /api/style-assistant/chat` — UI: `assistant.html`.

## Vercel (Alpha · 리얼)

[vercel.com](https://vercel.com) → **StyleLog** (GitHub 연동 프로젝트) → **Settings** → **Environment Variables**

| 이름 | 값 | 반드시 켤 환경 |
|------|-----|----------------|
| `OPENAI_API_KEY` | OpenAI 대시보드에서 발급한 `sk-…` 키 | **Production** (`www.stylelog.co.kr`) |
| 동일 | 동일 | **Preview** (`alpha.stylelog.co.kr`, PR 미리보기) |

- **Production만** 넣으면 리얼은 되고 alpha는 `openai_not_configured` (503).
- **Preview만** 넣으면 alpha만 되고 **www는 안 됨** (지금 보이는 메시지).
- 변수 추가·수정 후 **Deployments → 최신 배포 ⋮ → Redeploy** (환경 변수만 바꿔도 재배포 필요).

확인: 브라우저 개발자도구 → Network → `POST /api/style-assistant/chat`  
- `401` = 로그인  
- `503` + `openai_not_configured` = 키 없음  
- `200` = 정상

## 모델 (권장 초기값)

환경 변수로 바꿀 수 있게 둘 예정:

```env
OPENAI_MODEL=gpt-4o-mini
```

미설정 시 코드 기본값 사용.

## RAG 방향 (5.0V)

- **컨텍스트:** 로그인 사용자의 `style_logs`(내 착장) + 옷장 요약. `log_kind=reference`는 앱에서 제외(4.1V).
- **흐름:** 클라이언트 → `POST /api/style-assistant/chat` (세션 쿠키/ Bearer) → Supabase에서 기록 조회 → OpenAI에 system+context+user 메시지.
- **시스템 지침:** `api/style-assistant/chat.js`의 `SYSTEM_PROMPT`. 1순위는 RAG에 넣은 내 코디 기반 답변, 기록이 없거나 질문에 맞는 로그가 없으면 과거 코디를 지어내지 않고 친근한 일반 스타일리스트 톤으로 보완.
- **폴백(UI):** API 오류·미설정 등 클라이언트 메시지는 `style-assistant-client.js` 등에서 처리.

## 개인정보

대화·프롬프트에 실제 사진 URL·본문이 포함될 수 있음. 5.0 약관 스냅샷 전에 처리 목적·위탁(OpenAI) 문구 반영 예정.
