-- ========================================
-- StyleLog RLS (Row Level Security) 설정
-- ========================================
-- 이 SQL을 Supabase SQL Editor에서 실행하세요
-- 테스트 서버와 리얼 서버 각각 실행 필요

-- 1. style_logs 테이블에 user_id 컬럼 추가
ALTER TABLE style_logs 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2. 기존 데이터에 user_id 설정 (선택사항 - 테스트 데이터 정리용)
-- 주의: 기존 데이터가 있다면 이 부분은 주석 처리하거나 삭제하세요
-- DELETE FROM style_logs WHERE user_id IS NULL;

-- 3. RLS 활성화
ALTER TABLE style_logs ENABLE ROW LEVEL SECURITY;

-- 4. 정책 삭제 (기존 정책이 있다면)
DROP POLICY IF EXISTS "Users can view their own logs" ON style_logs;
DROP POLICY IF EXISTS "Users can insert their own logs" ON style_logs;
DROP POLICY IF EXISTS "Users can update their own logs" ON style_logs;
DROP POLICY IF EXISTS "Users can delete their own logs" ON style_logs;

-- 5. SELECT 정책: 사용자는 자신의 로그만 조회 가능
CREATE POLICY "Users can view their own logs"
ON style_logs
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- 6. INSERT 정책: 사용자는 자신의 로그만 생성 가능
CREATE POLICY "Users can insert their own logs"
ON style_logs
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- 7. UPDATE 정책: 사용자는 자신의 로그만 수정 가능
CREATE POLICY "Users can update their own logs"
ON style_logs
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 8. DELETE 정책: 사용자는 자신의 로그만 삭제 가능
CREATE POLICY "Users can delete their own logs"
ON style_logs
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- 9. user_id에 인덱스 추가 (성능 향상)
CREATE INDEX IF NOT EXISTS style_logs_user_id_idx ON style_logs(user_id);

-- 10. 확인 쿼리
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'style_logs';

-- 완료!
-- 이제 각 사용자는 자신의 로그만 보고 관리할 수 있습니다.


