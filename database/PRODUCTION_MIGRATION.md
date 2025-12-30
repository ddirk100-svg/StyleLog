# 프로덕션 데이터베이스 마이그레이션 가이드

## 문제
프로덕션 데이터베이스에 `weather_temp_max`와 `weather_temp_min` 컬럼이 없어서 일기 저장 시 오류가 발생합니다.

## 해결 방법

### 1. Supabase 대시보드 접속
1. https://supabase.com 접속
2. 프로덕션 프로젝트 선택 (zymszibiwojzrtxhiesc)
3. 좌측 메뉴에서 **SQL Editor** 클릭

### 2. 마이그레이션 SQL 실행
아래 SQL을 복사해서 실행하세요:

```sql
-- 최저 기온 컬럼 추가
ALTER TABLE style_logs 
ADD COLUMN IF NOT EXISTS weather_temp_min NUMERIC(5,2);

-- 최고 기온 컬럼 추가
ALTER TABLE style_logs 
ADD COLUMN IF NOT EXISTS weather_temp_max NUMERIC(5,2);

-- 컬럼 추가 확인
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'style_logs' 
AND column_name IN ('weather_temp_min', 'weather_temp_max');
```

### 3. 확인
마지막 SELECT 쿼리 결과에 `weather_temp_min`과 `weather_temp_max`가 표시되면 성공입니다.

## 참고
- `IF NOT EXISTS`를 사용했으므로 이미 컬럼이 있어도 오류가 발생하지 않습니다.
- 기존 데이터는 `NULL`로 설정됩니다.

