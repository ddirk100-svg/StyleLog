-- ========================================
-- 🚀 간단 실행: 이것만 복사해서 붙여넣기!
-- ========================================
-- Supabase SQL Editor에서 아래 전체를 복사해서 실행하세요

-- 1단계: 기존 일기 모두 삭제 (테스트니까 괜찮아요!)
DELETE FROM style_logs;

-- 2단계: user_id 컬럼 추가
ALTER TABLE style_logs 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- 3단계: RLS 활성화
ALTER TABLE style_logs ENABLE ROW LEVEL SECURITY;

-- 4단계: 기존 정책 삭제
DROP POLICY IF EXISTS "Users can view their own logs" ON style_logs;
DROP POLICY IF EXISTS "Users can insert their own logs" ON style_logs;
DROP POLICY IF EXISTS "Users can update their own logs" ON style_logs;
DROP POLICY IF EXISTS "Users can delete their own logs" ON style_logs;

-- 5단계: 새 정책 생성
CREATE POLICY "Users can view their own logs"
ON style_logs FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own logs"
ON style_logs FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own logs"
ON style_logs FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own logs"
ON style_logs FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- 완료! 이제 새로 일기를 작성하면 본인 것만 보입니다!


