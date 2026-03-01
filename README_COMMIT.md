# 한글 커밋 메시지 (인코딩 안내)

Windows에서 Git 커밋 시 한글이 깨지는 문제 방지:

## 방법 1: 파일 사용 (권장)

1. `scripts/_commit_msg.txt`에 커밋 메시지 작성 (UTF-8)
2. `git commit -F scripts/_commit_msg.txt` 실행

## 방법 2: 영어 사용

```bash
git commit -m "feat: add thumbnail feature"
```
