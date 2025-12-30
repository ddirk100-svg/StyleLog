-- ========================================
-- StyleLog RLS 디버깅 및 문제 해결 SQL
-- ========================================

-- 1. 현재 상태 확인
-- ========================================

-- 1-1. RLS가 활성화되어 있는지 확인
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables
WHERE tablename = 'style_logs';
-- rowsecurity가 true여야 합니다

-- 1-2. 정책이 제대로 생성되었는지 확인
SELECT 
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies
WHERE tablename = 'style_logs';
-- 4개의 정책이 보여야 합니다 (SELECT, INSERT, UPDATE, DELETE)

-- 1-3. user_id 컬럼이 있는지 확인
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'style_logs' AND column_name = 'user_id';
-- user_id가 보여야 합니다

-- 1-4. 현재 로그인한 사용자 ID 확인
SELECT auth.uid() as current_user_id;
-- NULL이면 로그인 안된 상태

-- 1-5. 모든 일기의 user_id 상태 확인
SELECT 
    id,
    date,
    title,
    user_id,
    CASE 
        WHEN user_id IS NULL THEN '❌ user_id 없음'
        WHEN user_id = auth.uid() THEN '✅ 내 일기'
        ELSE '❓ 다른 사용자 일기'
    END as 상태
FROM style_logs
ORDER BY date DESC;


-- 2. 문제 해결
-- ========================================

-- 2-1. RLS가 비활성화되어 있다면 활성화
ALTER TABLE style_logs ENABLE ROW LEVEL SECURITY;

-- 2-2. 기존 정책 모두 삭제 후 재생성
DROP POLICY IF EXISTS "Users can view their own logs" ON style_logs;
DROP POLICY IF EXISTS "Users can insert their own logs" ON style_logs;
DROP POLICY IF EXISTS "Users can update their own logs" ON style_logs;
DROP POLICY IF EXISTS "Users can delete their own logs" ON style_logs;

-- SELECT 정책
CREATE POLICY "Users can view their own logs"
ON style_logs
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- INSERT 정책
CREATE POLICY "Users can insert their own logs"
ON style_logs
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- UPDATE 정책
CREATE POLICY "Users can update their own logs"
ON style_logs
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- DELETE 정책
CREATE POLICY "Users can delete their own logs"
ON style_logs
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);


-- 3. 기존 데이터 처리
-- ========================================

-- 3-1. 가입된 모든 사용자 목록 확인
SELECT 
    id,
    email,
    created_at
FROM auth.users
ORDER BY created_at DESC;

-- 3-2. user_id가 NULL인 일기 개수 확인
SELECT COUNT(*) as null_user_id_count
FROM style_logs
WHERE user_id IS NULL;

-- 3-3-A. 기존 일기 모두 삭제 (테스트 서버 권장)
-- DELETE FROM style_logs WHERE user_id IS NULL;

-- 3-3-B. 또는 기존 일기를 특정 사용자에게 할당
-- 먼저 위의 3-1에서 본인의 user id를 확인한 후:
-- UPDATE style_logs 
-- SET user_id = '여기에-본인의-UUID-입력'
-- WHERE user_id IS NULL;


-- 4. 테스트
-- ========================================

-- 4-1. 현재 보이는 일기 목록 (RLS 적용된 상태)
SELECT 
    id,
    date,
    title,
    user_id
FROM style_logs
ORDER BY date DESC;
-- 본인의 일기만 보여야 합니다

-- 4-2. RLS 무시하고 모든 일기 확인 (관리자용)
-- 주의: 이 쿼리는 RLS를 우회합니다. 확인용으로만 사용하세요.
-- SELECT 
--     id,
--     date,
--     title,
--     user_id,
--     (SELECT email FROM auth.users WHERE id = style_logs.user_id) as user_email
-- FROM style_logs
-- ORDER BY date DESC;


-- 5. 완전 초기화 (문제가 계속되면 실행)
-- ========================================

-- 주의: 이 섹션은 모든 데이터를 삭제합니다!
-- 테스트 서버에서만 사용하세요!

-- 5-1. 모든 일기 삭제
-- DELETE FROM style_logs;

-- 5-2. RLS 비활성화
-- ALTER TABLE style_logs DISABLE ROW LEVEL SECURITY;

-- 5-3. 모든 정책 삭제
-- DROP POLICY IF EXISTS "Users can view their own logs" ON style_logs;
-- DROP POLICY IF EXISTS "Users can insert their own logs" ON style_logs;
-- DROP POLICY IF EXISTS "Users can update their own logs" ON style_logs;
-- DROP POLICY IF EXISTS "Users can delete their own logs" ON style_logs;

-- 5-4. user_id 컬럼 삭제
-- ALTER TABLE style_logs DROP COLUMN IF EXISTS user_id;

-- 5-5. 그 다음 setup_rls.sql을 다시 실행하세요


-- 완료!
-- 위의 쿼리들을 하나씩 실행하면서 어디에서 문제가 있는지 확인하세요.


