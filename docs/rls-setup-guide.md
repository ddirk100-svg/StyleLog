# 🔐 사용자별 데이터 분리 설정 가이드

## 📋 개요
각 사용자가 자신의 일기만 볼 수 있도록 Supabase RLS (Row Level Security)를 설정합니다.

---

## ⚠️ 중요: 설정 순서

### 1️⃣ Supabase SQL 실행 (필수)
`database/setup_rls.sql` 파일의 내용을 Supabase SQL Editor에서 실행하세요.

**테스트 서버와 리얼 서버 각각 실행 필요!**

---

## 🛠️ 실행 방법

### **Step 1: Supabase 대시보드 접속**
- 테스트 서버: https://supabase.com/dashboard/project/roeurruguzxipevppnko
- 리얼 서버: https://supabase.com/dashboard/project/zymszibiwojzrtxhiesc

### **Step 2: SQL Editor 열기**
좌측 메뉴 > `SQL Editor` 클릭

### **Step 3: 새 쿼리 작성**
`New query` 버튼 클릭

### **Step 4: SQL 복사/붙여넣기**
`database/setup_rls.sql` 파일의 전체 내용을 복사하여 붙여넣기

### **Step 5: 실행**
`Run` 버튼 클릭 (또는 Ctrl+Enter)

### **Step 6: 결과 확인**
아래와 같은 메시지가 나오면 성공:
```
Success. No rows returned
```

---

## 📊 변경 사항

### **1. user_id 컬럼 추가**
```sql
ALTER TABLE style_logs 
ADD COLUMN user_id UUID REFERENCES auth.users(id);
```
- 각 로그가 어느 사용자의 것인지 구분

### **2. RLS 활성화**
```sql
ALTER TABLE style_logs ENABLE ROW LEVEL SECURITY;
```

### **3. 정책 생성**
- **SELECT**: 사용자는 자신의 로그만 조회
- **INSERT**: 사용자는 자신의 로그만 생성
- **UPDATE**: 사용자는 자신의 로그만 수정
- **DELETE**: 사용자는 자신의 로그만 삭제

---

## 🔄 기존 데이터 처리

### **옵션 1: 기존 데이터 삭제 (권장 - 테스트 서버)**
```sql
DELETE FROM style_logs WHERE user_id IS NULL;
```

### **옵션 2: 기존 데이터 특정 사용자에게 할당**
```sql
-- 특정 사용자 ID 확인
SELECT id, email FROM auth.users;

-- 기존 데이터를 특정 사용자에게 할당
UPDATE style_logs 
SET user_id = '사용자UUID' 
WHERE user_id IS NULL;
```

---

## ✅ 테스트 방법

### **1. 사용자 A로 로그인**
- 새 일기 작성
- 일기 목록 확인

### **2. 로그아웃 후 사용자 B로 로그인**
- 사용자 A의 일기가 보이지 않는지 확인
- 새 일기 작성
- 자신의 일기만 보이는지 확인

### **3. 다시 사용자 A로 로그인**
- 사용자 B의 일기가 보이지 않는지 확인
- 자신의 일기만 보이는지 확인

---

## 🐛 문제 해결

### **Q: "permission denied for table style_logs" 오류**
**A:** RLS 정책이 제대로 생성되지 않았습니다. SQL을 다시 실행하세요.

### **Q: 기존 일기가 안 보여요**
**A:** 기존 일기에 `user_id`가 없어서 그럴 수 있습니다. 위의 "기존 데이터 처리" 참고

### **Q: 새 일기가 생성되지 않아요**
**A:** 로그인이 제대로 되었는지 확인하세요. 콘솔에 "로그인이 필요합니다" 메시지 확인

---

## 📝 참고

- RLS는 데이터베이스 레벨에서 보안을 적용합니다
- 프론트엔드 코드를 우회해도 다른 사용자의 데이터에 접근할 수 없습니다
- 각 쿼리마다 자동으로 `WHERE user_id = auth.uid()` 조건이 추가됩니다

---

## 🎯 완료 후 확인사항

- [x] `database/setup_rls.sql` 실행 완료
- [x] 테스트 서버에 RLS 적용
- [x] 리얼 서버에 RLS 적용
- [x] 여러 계정으로 테스트 완료
- [x] 기존 데이터 처리 완료

문제가 있으면 콘솔 로그를 확인하거나 Supabase 대시보드에서 정책을 확인하세요!


