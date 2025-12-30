-- ========================================
-- 🚀 리얼 서버 RLS 설정 (프로덕션용)
-- ========================================
-- ⚠️ 주의: 이것은 리얼 서버용입니다!
-- https://supabase.com/dashboard/project/zymszibiwojzrtxhiesc

-- 1단계: 잘못된 정책 삭제 (있다면)
DROP POLICY IF EXISTS "Enable read access for all users" ON style_logs;
DROP POLICY IF EXISTS "Enable insert access for all users" ON style_logs;
DROP POLICY IF EXISTS "Enable update access for all users" ON style_logs;
DROP POLICY IF EXISTS "Enable delete access for all users" ON style_logs;

-- 2단계: 기존 정책 삭제 (있다면)
DROP POLICY IF EXISTS "Users can view their own logs" ON style_logs;
DROP POLICY IF EXISTS "Users can insert their own logs" ON style_logs;
DROP POLICY IF EXISTS "Users can update their own logs" ON style_logs;
DROP POLICY IF EXISTS "Users can delete their own logs" ON style_logs;

-- 3단계: user_id 컬럼 추가 (없으면)
ALTER TABLE style_logs 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- 4단계: RLS 활성화
ALTER TABLE style_logs ENABLE ROW LEVEL SECURITY;

-- 5단계: 올바른 정책 생성
CREATE POLICY "Users can view their own logs"
ON style_logs FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own logs"
ON style_logs FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own logs"
ON style_logs FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own logs"
ON style_logs FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- 6단계: 확인
SELECT 
    policyname,
    cmd,
    qual
FROM pg_policies
WHERE tablename = 'style_logs'
ORDER BY cmd;

-- ========================================
-- 📊 기존 데이터 처리 (선택사항)
-- ========================================

-- 옵션 A: 기존 데이터 확인
SELECT 
    COUNT(*) as 총개수,
    COUNT(user_id) as user_id있는개수,
    COUNT(*) - COUNT(user_id) as user_id없는개수
FROM style_logs;

-- 옵션 B: user_id 없는 데이터를 특정 사용자에게 할당
-- (먼저 auth.users에서 본인 ID 확인 후)
-- UPDATE style_logs 
-- SET user_id = '본인의-UUID-여기에'
-- WHERE user_id IS NULL;

-- 옵션 C: user_id 없는 데이터 삭제 (신중히!)
-- DELETE FROM style_logs WHERE user_id IS NULL;

-- 완료!

