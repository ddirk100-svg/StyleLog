# 환경 설정 가이드

## 개요

StyleLog는 **개발(테스트) 환경**과 **프로덕션(리얼) 환경**을 자동으로 분리합니다.

## 환경 구분

### 개발 환경으로 인식되는 경우:
- `localhost`
- `127.0.0.1`
- `192.168.x.x` (로컬 네트워크)

### 프로덕션 환경으로 인식되는 경우:
- 실제 도메인 (예: `stylelog.com`)
- Vercel, Netlify 등 배포된 URL

## Supabase 설정

### 1. 개발용 Supabase 프로젝트 생성

1. [Supabase 대시보드](https://app.supabase.com)에 접속
2. **New Project** 클릭
3. 프로젝트 이름: `stylelog-dev` (또는 원하는 이름)
4. 데이터베이스 비밀번호 설정
5. Region: **Northeast Asia (Seoul)** 선택
6. 생성 완료 후 대기 (약 2분)

### 2. 개발용 데이터베이스 테이블 생성

1. Supabase 대시보드에서 **SQL Editor** 메뉴 선택
2. `database/setup.sql` 파일의 내용을 복사하여 실행
3. 테이블 생성 확인

### 3. 개발용 API 키 가져오기

1. Supabase 대시보드에서 **Settings > API** 메뉴 선택
2. 다음 정보를 복사:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon public key**: `eyJhbGc...` (긴 토큰)

### 4. `scripts/config.js` 파일 업데이트

```javascript
// 개발(테스트) 서버 설정
const DEV_CONFIG = {
    SUPABASE_URL: 'https://YOUR_DEV_PROJECT_ID.supabase.co',
    SUPABASE_ANON_KEY: 'YOUR_DEV_ANON_KEY_HERE'
};
```

위 부분을 복사한 개발용 정보로 교체하세요.

## 환경 확인

브라우저 개발자 도구(F12)의 콘솔에서 다음과 같은 메시지를 확인할 수 있습니다:

```
🚀 환경: 개발(테스트)
📍 Supabase URL: https://xxxxx.supabase.co
```

- `localhost`에서 실행: **개발(테스트)** 환경 사용
- 배포된 URL에서 실행: **프로덕션(리얼)** 환경 사용

## 장점

✅ **데이터 분리**: 개발 중 테스트 데이터와 실제 사용자 데이터가 섞이지 않음  
✅ **안전한 테스트**: 실수로 실제 데이터를 삭제하거나 수정할 위험 없음  
✅ **자동 전환**: 코드 수정 없이 환경에 따라 자동으로 DB 선택  
✅ **동일한 코드**: 배포 시 별도 설정 변경 불필요

## 개발 워크플로우

1. **개발 단계** (`localhost`):
   - 개발용 Supabase 사용
   - 마음껏 테스트, 삭제, 수정 가능
   - 더미 데이터로 실험

2. **테스트 완료 후**:
   - Git에 커밋
   - 배포 (Vercel, Netlify 등)

3. **프로덕션 환경** (배포된 URL):
   - 자동으로 프로덕션 Supabase 사용
   - 실제 사용자 데이터 저장

## 주의사항

⚠️ **API 키 보안**:
- `config.js` 파일을 `.gitignore`에 추가하거나
- 환경 변수로 관리하는 것을 권장합니다
- 현재는 anon (public) 키만 사용하므로 비교적 안전하지만, 중요한 서비스에서는 환경 변수 사용을 권장합니다

⚠️ **RLS (Row Level Security)**:
- 프로덕션 환경에서는 반드시 적절한 RLS 정책을 설정하세요
- 현재는 모든 사용자가 읽기/쓰기 가능한 개발용 설정입니다



