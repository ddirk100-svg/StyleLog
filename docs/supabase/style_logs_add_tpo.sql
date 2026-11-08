-- 2.2V 상황(TPO)
-- Alpha·리얼 DB 각각 Supabase SQL Editor에서 실행합니다.
-- 스키마 캐시가 바로 안 바뀌면 맨 아래 NOTIFY 한 줄을 다시 실행합니다.

ALTER TABLE style_logs
ADD COLUMN IF NOT EXISTS tpo TEXT[] DEFAULT '{}';

COMMENT ON COLUMN style_logs.tpo IS '상황 코드 배열: daily, work, date, plan, travel, workout, guest, interview';

NOTIFY pgrst, 'reload schema';
