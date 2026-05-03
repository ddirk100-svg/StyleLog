# 관리자 서브도메인 (방법 A)

동일 레포·동일 Vercel 프로덕션에 **두 호스트**만 추가하면 됩니다. 빌드 출력은 루트(`.`) 그대로이며, `vercel.json` 이 호스트에 따라 어드민 HTML 만 `/admin/` 경로로 연결합니다.

| 호스트 | 용도 | Supabase (`config.js` 기준) |
|--------|------|-------------------------------|
| `admin.stylelog.co.kr` | 리얼 관리자 | 호스트에 `alpha` 없음 → **프로덕션 DB** |
| `admin.alpha.stylelog.co.kr` | 알파 관리자 | 호스트에 `alpha` 포함 → **테스트 DB** |

어드민 HTML 은 `/styles`, `/scripts`, `/img` 를 **사이트 루트 절대경로**로 불러오므로, 메인 앱과 같은 배포에서 정적 파일이 그대로 제공됩니다.

---

## 1. Vercel

1. **StyleLog** 프로덕션 프로젝트 → **Settings → Domains**
2. **Add** 에 다음을 등록 (이미 있다면 생략):
   - `admin.stylelog.co.kr`
   - `admin.alpha.stylelog.co.kr`
3. 안내에 따라 DNS 를 맞추면 **Valid** 될 때까지 대기 (보통 수 분~수 시간).

프리뷰(`*.vercel.app`)에는 어드민 전용 호스트 규칙이 없습니다. 로컬에서는 `http://localhost:포트/admin/index.html` 로 확인하면 됩니다.

---

## 2. DNS (도메인 등록업체)

Vercel 이 준 비교 화면 기준으로 예시:

- **CNAME** `admin` → `cname.vercel-dns.com` (또는 프로젝트용 타깃)
- **CNAME** `admin.alpha` → 동일 타깃

(실제 레코드 이름·값은 Vercel 도메인 추가 시 표시되는 것을 따를 것.)

---

## 3. 배포 후 확인

- `https://admin.alpha.stylelog.co.kr/` → 대시보드, 사이드바 배지 **ALPHA / LOCAL**
- `https://admin.stylelog.co.kr/` → 배지 **REAL**
- 각 페이지에서 스타일·폰트 깨짐 없는지, `/scripts/admin-shell.js` 가 로드되는지 개발자 도구 Network 로 확인

---

## 4. 새 어드민 페이지 추가 시

`vercel.json` 의 `rewrites` 에 해당 호스트 두 줄씩 다음 규칙을 추가합니다.

```json
{"source": "/새페이지.html", "has": [{"type": "host", "value": "admin.stylelog.co.kr"}], "destination": "/admin/새페이지.html"},
{"source": "/새페이지.html", "has": [{"type": "host", "value": "admin.alpha.stylelog.co.kr"}], "destination": "/admin/새페이지.html"}
```

또 나중에 Edge Middleware 로 일반화할 수 있습니다.

---

## 5. 관리자 TOTP(구글 OTP) · API 환경 변수

어드민 데이터는 **RLS로 일반 클라이언트(anon 키)가 전체 조회 불가**이므로, Vercel 서버리스(`/api/admin/*`)가 **Supabase 서비스 롤**로 조회합니다.  
또 **TOTP 비밀은 브라우저에 두면 안 되므로** 서버에서만 검증합니다.

### Vercel → Project → Settings → Environment Variables

| 변수명 | 설명 |
|--------|------|
| `ADMIN_TOTP_SECRET` | 프로덕션(리얼)용 **Base32** 시크릿. Google Authenticator에 수동 입력하거나 QR 생성 시 이 값 사용. |
| `ADMIN_SESSION_SECRET` | 세션 쿠키 HMAC용 임의 긴 문자열(예: `openssl rand -hex 32`). |
| `ADMIN_TOTP_SECRET_PREVIEW` | (선택) 프리뷰/알파용 별도 TOTP 시크릿. 없으면 `ADMIN_TOTP_SECRET` 재사용. |
| `ADMIN_SESSION_SECRET_PREVIEW` | (선택) 프리뷰용 세션 서명. 없으면 `ADMIN_SESSION_SECRET` 재사용. |
| `SUPABASE_URL_PROD` | 리얼 프로젝트 URL (`config.js` 의 프로덕션과 동일). |
| `SUPABASE_SERVICE_ROLE_KEY_PROD` | 리얼 **service_role** 키 (Dashboard → Settings → API). **절대 프론트/레포에 커밋 금지.** |
| `SUPABASE_URL_DEV` | 테스트/알파 프로젝트 URL. |
| `SUPABASE_SERVICE_ROLE_KEY_DEV` | 테스트 **service_role** 키. |

**이름 단축(선택):** `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`만 넣어도 동작합니다.  
호스트에 `alpha`가 있거나 Vercel 프리뷰 배포이면 `_DEV` → 없으면 `_PROD` → 둘 다 없으면 공통 변수로 폴백합니다.

### 휴대폰 앱에 등록

**시크릿 만들기 (Windows·openssl 불필요):** 저장소 루트에서

```bash
npm run admin:secrets
```

터미널에 나온 `ADMIN_TOTP_SECRET` / `ADMIN_SESSION_SECRET` 값을 복사합니다.

1. **Vercel**에 위 두 Key–Value 를 **Environment Variables** 로 저장 → **Redeploy**
2. **Google Authenticator** → 계정 추가 → **설정 키 입력** → 키에 `ADMIN_TOTP_SECRET` 과 **동일한** 문자열 → **시간 기준**

### 로컬

`file://` 로 연 HTML에는 API가 없습니다. 저장소 루트에서 `npx vercel dev` 로 띄운 뒤 `/admin/index.html` 경로로 접속하세요.

**OTP 없이 로컬만 어드민 UI 테스트:** 프로젝트 루트에 `.env.local` 을 만들고(저장소는 `.gitignore`에 포함됨):

```env
ADMIN_DEV_OTP_BYPASS=1
```

`vercel dev` 로 열고 브라우저가 **`localhost` 또는 `127.0.0.1`** 일 때만 OTP·세션 시크릿 없이 통과합니다. (`vercel dev`가 `VERCEL_ENV=preview`로 잡혀도 루프백이면 우회됩니다.)

**VS Code Live Server만 쓸 때:** 주소가 `localhost` / `127.0.0.1` 이면 `/api` 가 없어서 **자동으로 OTP 창을 건너뛰고** 레이아웃만 열립니다. (대시보드 숫자 등은 `vercel dev` 또는 배포 URL에서 확인.)

이 변수는 **Vercel 클라우드(Production/Preview)에는 넣지 마세요.** (`ADMIN_DEV_OTP_BYPASS`는 클라우드에서 Host가 실제 도메인이라 우회 조건이 성립하지 않습니다.)

### API 경로 (참고)

- `GET/POST/DELETE` `/api/admin/session` — OTP 검증·HttpOnly 쿠키
- `GET` `/api/admin/summary` — 대시보드 카운트
- `GET` `PATCH` `/api/admin/inquiries` — 문의 목록·답변 저장
- `GET` `/api/admin/feedback` — 피드백 목록
- `GET` `/api/admin/members` — Auth 사용자 목록(페이지네이션)·`style_logs` 건수
