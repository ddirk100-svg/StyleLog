-- ========================================
-- 🔥 잘못된 정책 삭제 (이것만 실행!)
-- ========================================

-- 모든 사용자에게 접근 허용하는 잘못된 정책들 삭제
DROP POLICY IF EXISTS "Enable read access for all users" ON style_logs;
DROP POLICY IF EXISTS "Enable insert access for all users" ON style_logs;
DROP POLICY IF EXISTS "Enable update access for all users" ON style_logs;
DROP POLICY IF EXISTS "Enable delete access for all users" ON style_logs;

-- 올바른 정책만 남김 (이미 있으면 유지)
-- "Users can view their own logs"
-- "Users can insert their own logs"
-- "Users can update their own logs"
-- "Users can delete their own logs"

-- 확인: 이제 4개만 남아야 합니다
SELECT 
    policyname,
    cmd
FROM pg_policies
WHERE tablename = 'style_logs'
ORDER BY cmd;

-- 완료! 이제 브라우저에서 새로고침하고 debug.html 확인하세요!


