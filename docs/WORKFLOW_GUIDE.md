# 🚀 작업 및 배포 워크플로우 가이드

## 현재 구조

```
로컬 파일 (작업 중)
    ↓ git push
GitHub 저장소 (버전 관리)
    ↓ 자동 연동
Vercel (자동 배포)
    ↓
리얼 서버 (사용자들이 접속하는 곳)
```

## 환경 구분

### 1. 로컬 개발 환경 (localhost)
- **URL**: `http://localhost:8000`
- **Supabase**: 개발용 (테스트) 서버
  - URL: `https://roeurruguzxipevppnko.supabase.co`
  - 데이터: 테스트용 더미 데이터
- **용도**: 개발, 테스트, 실험

### 2. 프로덕션 환경 (리얼 서버)
- **URL**: `https://style-log.vercel.app` (또는 설정한 도메인)
- **Supabase**: 프로덕션 (리얼) 서버
  - URL: `https://zymszibiwojzrtxhiesc.supabase.co`
  - 데이터: 실제 사용자 데이터
- **용도**: 실제 서비스

## 자동 환경 전환

`scripts/config.js`에서 자동으로 환경을 감지합니다:

```javascript
// localhost면 → 개발 환경
// 실제 도메인이면 → 프로덕션 환경
const isDevelopment = window.location.hostname === 'localhost' || 
                      window.location.hostname === '127.0.0.1';
```

**코드 수정 불필요!** 환경에 따라 자동으로 DB가 전환됩니다.

## 📋 일반적인 작업 흐름

### 시나리오 1: 새로운 기능 개발

1. **로컬에서 개발**
   ```bash
   # 로컬 서버 실행
   python -m http.server 8000
   # 또는 VS Code Live Server 사용
   ```

2. **테스트**
   - `http://localhost:8000` 접속
   - 개발용 Supabase로 자동 연결
   - 마음껏 테스트, 삭제, 수정 가능

3. **완료 후 배포**
   ```bash
   git add .
   git commit -m "새 기능 추가"
   git push
   ```
   → Vercel이 자동으로 재배포 시작 (1-2분 소요)

4. **리얼 서버 확인**
   - `https://style-log.vercel.app` 접속
   - 프로덕션 Supabase로 자동 연결
   - 실제 사용자 데이터로 테스트

### 시나리오 2: 버그 수정

1. **로컬에서 버그 재현 및 수정**
   - 로컬에서 문제 재현
   - 코드 수정
   - 로컬에서 테스트

2. **배포**
   ```bash
   git add .
   git commit -m "버그 수정: 메뉴 버튼 이벤트 핸들러"
   git push
   ```

3. **리얼 서버 확인**
   - 배포 완료 후 리얼 서버에서 확인

### 시나리오 3: 긴급 수정 (리얼 서버에만 적용)

**주의**: 가능하면 로컬에서 먼저 테스트하세요!

1. **로컬에서 빠르게 수정**
   - 최소한의 수정만
   - 로컬에서 기본 동작 확인

2. **즉시 배포**
   ```bash
   git add .
   git commit -m "긴급 수정: [문제 설명]"
   git push
   ```

3. **리얼 서버에서 즉시 확인**
   - 배포 완료 대기 (1-2분)
   - 리얼 서버에서 동작 확인

## 🔄 배포 프로세스

### 자동 배포 (현재 설정)

1. **GitHub에 푸시**
   ```bash
   git push
   ```

2. **Vercel이 자동 감지**
   - GitHub webhook으로 변경사항 감지
   - 자동으로 빌드 시작
   - 배포 완료 (1-2분)

3. **배포 확인**
   - Vercel 대시보드: https://vercel.com/dashboard
   - 또는 배포된 URL 접속

### 수동 재배포 (필요시)

Vercel 대시보드에서:
1. 프로젝트 선택
2. "Deployments" 탭
3. 최신 배포의 "..." 메뉴
4. "Redeploy" 클릭

또는 빈 커밋으로 트리거:
```bash
git commit --allow-empty -m "Trigger redeploy"
git push
```

## ⚠️ 주의사항

### 1. 데이터베이스 마이그레이션

**프로덕션 DB에 변경사항이 필요한 경우:**

1. **Supabase 대시보드 접속**
   - 프로덕션 프로젝트: https://supabase.com/dashboard/project/zymszibiwojzrtxhiesc

2. **SQL Editor에서 실행**
   - `database/` 폴더의 SQL 파일 실행
   - 예: `database/add_temp_columns.sql`

3. **코드 배포**
   - 마이그레이션 후 코드 배포
   - 코드가 새로운 컬럼을 사용할 수 있도록

### 2. 환경 변수

현재는 `config.js`에 하드코딩되어 있지만, 나중에 환경 변수로 관리할 수 있습니다:

**Vercel 환경 변수 설정:**
1. Vercel 대시보드 → 프로젝트 → Settings → Environment Variables
2. 변수 추가:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`

**코드에서 사용:**
```javascript
const SUPABASE_URL = process.env.SUPABASE_URL || '기본값';
```

### 3. 테스트 서버에서 리얼로 배포할 때

**현재는 자동으로 처리됩니다!**

- 로컬 (`localhost`) → 개발용 Supabase
- 리얼 서버 (Vercel URL) → 프로덕션 Supabase

**추가 작업 불필요:**
- 코드 수정 불필요
- 설정 변경 불필요
- 그냥 `git push`만 하면 됨!

## 📝 체크리스트

### 배포 전 확인사항

- [ ] 로컬에서 테스트 완료
- [ ] 브라우저 콘솔에 에러 없음
- [ ] 주요 기능 동작 확인
- [ ] Git 커밋 메시지 명확하게 작성

### 배포 후 확인사항

- [ ] Vercel 배포 성공 확인
- [ ] 리얼 서버 접속 확인
- [ ] 콘솔에서 "프로덕션(리얼)" 환경 확인
- [ ] 주요 기능 동작 확인
- [ ] 실제 데이터로 테스트

## 🆘 문제 해결

### 배포가 안 될 때

1. **Vercel 대시보드 확인**
   - 배포 로그 확인
   - 에러 메시지 확인

2. **GitHub 확인**
   - 푸시가 제대로 되었는지 확인
   - `git log`로 최신 커밋 확인

3. **수동 재배포**
   - Vercel 대시보드에서 "Redeploy"

### 리얼 서버에서 개발 환경이 사용될 때

- `config.js`의 환경 감지 로직 확인
- 브라우저 콘솔에서 환경 확인:
  ```
  🚀 환경: 프로덕션(리얼)
  📍 Supabase URL: https://zymszibiwojzrtxhiesc.supabase.co
  ```

## 💡 팁

1. **작은 단위로 커밋**
   - 한 번에 많은 변경사항보다 작은 단위로
   - 문제 발생 시 롤백 쉬움

2. **의미 있는 커밋 메시지**
   ```
   좋은 예:
   - "Fix: 메뉴 버튼 이벤트 핸들러 수정"
   - "Add: 즐겨찾기 기능 추가"
   
   나쁜 예:
   - "수정"
   - "asdf"
   ```

3. **배포 전 로컬 테스트**
   - 가능하면 항상 로컬에서 먼저 테스트
   - 리얼 서버는 실제 사용자 데이터

4. **Vercel 대시보드 활용**
   - 배포 상태 실시간 확인
   - 배포 로그로 문제 파악

---

**요약**: 그냥 `git push`만 하면 자동으로 리얼 서버에 배포됩니다! 🚀

