-- 날씨적합도 컬럼 추가
-- cold: 조금 추웠음, good: 딱 좋음, hot: 조금 더웠음

ALTER TABLE style_logs 
ADD COLUMN IF NOT EXISTS weather_fit TEXT CHECK (weather_fit IN ('cold', 'good', 'hot'));

COMMENT ON COLUMN style_logs.weather_fit IS '날씨적합도: cold(조금 추웠음), good(딱 좋음), hot(조금 더웠음)';

-- 기존 null 기록을 good으로 변경 (선택 실행)
UPDATE style_logs SET weather_fit = 'good' WHERE weather_fit IS NULL;
