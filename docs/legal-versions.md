# 약관·개인정보처리방침 버전 관리

## 구조

- `terms.html` / `privacy.html` — 헤더·버전 선택 UI만 포함. 본문은 `scripts/legal-history.js`가 로드함.
- `legal/versions.json` — 버전 목록(JSON). **항상 최신 판을 배열 맨 위**에 두면 드롭다운 첫 줄이 현행이 됩니다.
- `legal/terms/YYYY-MM-DD.html`, `legal/privacy/YYYY-MM-DD.html` — 해당 시행일의 **전체 본문 스냅샷**(HTML 조각, `<main>` 안에 넣을 내용만).

## 개정 절차 (체크리스트)

1. 이전 판 파일을 복사해 새 날짜 파일을 만듭니다.  
   예: `legal/terms/2026-05-26.html` → `legal/terms/2026-08-01.html`
2. 새 파일에서 시행일·부칙·본문을 수정합니다.
3. `legal/versions.json`의 `terms`(또는 `privacy`) 배열 **앞쪽**에 객체를 추가합니다.

```json
{
  "id": "2026-08-01",
  "label": "2026.8.1 시행 (현행)",
  "summary": "면책 조항 정리, 위탁 업체 명칭 변경 등",
  "path": "legal/terms/2026-08-01.html"
}
```

4. 배포 후 `terms.html?rev=2026-08-01` 로 특정 판 링크가 동작하는지 확인합니다.

## 참고

- 헤더 우측의 작은 `<select>`로 개정본을 바꿉니다. `summary` 필드는 JSON에 남겨도 UI에는 표시하지 않습니다(내부 메모용).
- 외부 링크·GA는 `terms.html` / `privacy.html` 셸에만 두고, 스냅샷에는 법적 본문 위주로 유지해도 됩니다.
