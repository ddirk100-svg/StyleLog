# 한글 커밋 메시지 (인코딩 안내)

Windows에서 Git 커밋 시 한글이 깨지는 문제를 방지하려면:

## 방법 1: UTF-8 스크립트 사용 (권장)

```powershell
pwsh -File scripts/git-commit-utf8.ps1 "커밋 메시지"
```

## 방법 2: 영어 사용

```bash
git commit -m "feat: add thumbnail feature"
```

## Git 전역 설정 (이미 적용됨)

- `i18n.commitEncoding = utf-8`
- `i18n.logOutputEncoding = utf-8`
