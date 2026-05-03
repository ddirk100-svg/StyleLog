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
