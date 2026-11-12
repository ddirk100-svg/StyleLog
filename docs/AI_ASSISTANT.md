# 5.0 AI 스타일 어시스턴트 (RAG) — 키·환경

ChatGPT API는 **서버(Vercel serverless)에서만** 사용한다. 브라우저·`scripts/config.js`·GitHub에 키를 두지 않는다.

## 로컬 (`npm run dev`)

프로젝트 루트 `.env.local` (이미 gitignore)에 추가:

```env
OPENAI_API_KEY=sk-...
```

`scripts/local-api-dev.js`가 `.env.local`을 `process.env`로 로드한다. API: `POST /api/style-assistant/chat` — UI: `assistant.html`.

## Vercel (Alpha · 리얼)

각 프로젝트 → **Settings → Environment Variables**

| 이름 | 값 | 환경 |
|------|-----|------|
| `OPENAI_API_KEY` | 본인 ChatGPT API 키 | Production, Preview(Alpha) |

저장 후 **Redeploy** 한 번.

## 모델 (권장 초기값)

환경 변수로 바꿀 수 있게 둘 예정:

```env
OPENAI_MODEL=gpt-4o-mini
```

미설정 시 코드 기본값 사용.

## RAG 방향 (5.0V)

- **컨텍스트:** 로그인 사용자의 `style_logs`(내 착장) + 옷장 요약. `log_kind=reference`는 앱에서 제외(4.1V).
- **흐름:** 클라이언트 → `POST /api/style-assistant/chat` (세션 쿠키/ Bearer) → Supabase에서 기록 조회 → OpenAI에 system+context+user 메시지.
- **폴백:** 기록이 없으면 규칙 기반 안내 + 홈 링크 (Notion 티켓과 동일).

## 개인정보

대화·프롬프트에 실제 사진 URL·본문이 포함될 수 있음. 5.0 약관 스냅샷 전에 처리 목적·위탁(OpenAI) 문구 반영 예정.
