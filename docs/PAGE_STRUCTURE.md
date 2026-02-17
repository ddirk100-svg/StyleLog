# 🎯 StyleLog 페이지 구조

## 📄 페이지 플로우

```
🏠 landing.html (랜딩 페이지 - 로그인 불필요)
    │
    ├─ 회원가입 버튼
    │   └─→ signup.html (회원가입)
    │         └─→ login.html (가입 완료 후)
    │
    └─ 로그인 버튼
        └─→ login.html (로그인)
              └─→ home.html (메인 서비스)
                    │
                    ├─→ month-detail.html (월별 상세)
                    ├─→ calendar.html (캘린더 뷰)
                    ├─→ write.html (일기 작성/수정)
                    ├─→ detail.html (일기 상세)
                    └─→ favorite.html (즐겨찾기)
```

## 🔐 인증 로직

### **공개 페이지 (로그인 불필요)**
- `landing.html` - 랜딩 페이지
- `login.html` - 로그인
- `signup.html` - 회원가입
- `debug.html` - 디버그 (개발용)

### **비공개 페이지 (로그인 필요)**
- `home.html` - 메인 홈 (로그인 안됐으면 자동으로 landing.html로)
- `month-detail.html` - 월별 상세
- `calendar.html` - 캘린더
- `write.html` - 작성/수정
- `detail.html` - 상세
- `favorite.html` - 즐겨찾기

## 🚀 시작하기

1. **첫 방문자**
   ```
   landing.html 열기
   → "회원가입하기" 클릭
   → 회원가입 완료
   → 로그인
   → home.html (메인 서비스)
   ```

2. **재방문자**
   ```
   home.html 열기
   → 로그인 상태면: 바로 메인 서비스
   → 로그인 안됐으면: 자동으로 landing.html
   ```

## 📝 개발 모드 vs 프로덕션

### **로컬 개발 (localhost)**
- 자동으로 테스트 서버 연결
- Supabase: roeurruguzxipevppnko

### **프로덕션 (실제 도메인)**
- 자동으로 리얼 서버 연결
- Supabase: zymszibiwojzrtxhiesc

---

완성! 🎉


