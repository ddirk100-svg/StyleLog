-- 리스트/썸네일용 소형 이미지 URL (base64 썸네일, 약 30~80KB)
-- photos 컬럼 대용량 제거로 statement timeout 방지

ALTER TABLE style_logs 
ADD COLUMN IF NOT EXISTS thumb_url TEXT;

COMMENT ON COLUMN style_logs.thumb_url IS '리스트 표시용 썸네일 (첫 번째 사진 리사이즈, base64)';
