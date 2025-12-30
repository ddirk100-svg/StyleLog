-- ========================================
-- 🔍 현재 상태 확인 (이것만 실행하세요)
-- ========================================

-- 1. 현재 로그인한 사용자 확인
SELECT auth.uid() as "내 user_id";
-- 결과가 NULL이면 로그인 안된 상태입니다

-- 2. 모든 일기와 owner 확인 (RLS 무시)
SELECT 
    id,
    date,
    title,
    user_id,
    created_at,
    CASE 
        WHEN user_id IS NULL THEN '❌ user_id 없음'
        WHEN user_id = auth.uid() THEN '✅ 내 일기'
        ELSE '❓ 다른 사용자'
    END as "상태"
FROM style_logs
ORDER BY created_at DESC
LIMIT 20;

-- 3. RLS 상태 확인
SELECT 
    tablename,
    rowsecurity as "RLS활성화여부"
FROM pg_tables
WHERE tablename = 'style_logs';
-- rowsecurity가 true여야 합니다

-- 4. 정책 개수 확인
SELECT COUNT(*) as "정책개수"
FROM pg_policies
WHERE tablename = 'style_logs';
-- 4개여야 합니다

-- 결과를 스크린샷으로 보내주세요!


