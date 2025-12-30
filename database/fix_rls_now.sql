-- ========================================
-- 🔧 RLS 완전 재설정 (이것만 실행!)
-- ========================================

-- 1. 모든 정책 완전 삭제
DROP POLICY IF EXISTS "Users can view their own logs" ON style_logs;
DROP POLICY IF EXISTS "Users can insert their own logs" ON style_logs;
DROP POLICY IF EXISTS "Users can update their own logs" ON style_logs;
DROP POLICY IF EXISTS "Users can delete their own logs" ON style_logs;

-- 2. RLS 비활성화 후 재활성화
ALTER TABLE style_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE style_logs ENABLE ROW LEVEL SECURITY;

-- 3. 정책 다시 생성 (강제 모드)
CREATE POLICY "Users can view their own logs"
ON style_logs
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own logs"
ON style_logs
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own logs"
ON style_logs
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own logs"
ON style_logs
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- 4. 확인
SELECT 
    policyname,
    cmd,
    qual
FROM pg_policies
WHERE tablename = 'style_logs';

-- 완료! 이제 페이지를 새로고침하고 debug.html에서 다시 확인하세요!


