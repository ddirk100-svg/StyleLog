-- 기존 테이블에 최저/최고 기온 컬럼 추가
-- 이미 테이블이 생성되어 있는 경우 실행

-- 최저 기온 컬럼 추가
ALTER TABLE style_logs 
ADD COLUMN IF NOT EXISTS weather_temp_min NUMERIC(5,2);

-- 최고 기온 컬럼 추가
ALTER TABLE style_logs 
ADD COLUMN IF NOT EXISTS weather_temp_max NUMERIC(5,2);

-- 컬럼 추가 확인
COMMENT ON COLUMN style_logs.weather_temp IS '현재 기온 (섭씨)';
COMMENT ON COLUMN style_logs.weather_temp_min IS '최저 기온 (섭씨)';
COMMENT ON COLUMN style_logs.weather_temp_max IS '최고 기온 (섭씨)';



