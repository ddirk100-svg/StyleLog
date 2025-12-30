-- 스타일로그 테이블 생성
CREATE TABLE style_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID,
    date DATE NOT NULL,
    title TEXT,
    content TEXT,
    weather TEXT CHECK (weather IN ('sunny', 'cloudy', 'rainy', 'snowy', 'lightning', 'clear')),
    weather_temp NUMERIC(5,2), -- 현재 기온 (섭씨)
    weather_temp_min NUMERIC(5,2), -- 최저 기온 (섭씨)
    weather_temp_max NUMERIC(5,2), -- 최고 기온 (섭씨)
    weather_description TEXT, -- 날씨 설명
    photos TEXT[], -- 사진 URL 배열
    tags TEXT[], -- 태그 배열
    is_favorite BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 인덱스 생성 (성능 최적화)
CREATE INDEX idx_style_logs_date ON style_logs(date DESC);
CREATE INDEX idx_style_logs_user_id ON style_logs(user_id);
CREATE INDEX idx_style_logs_created_at ON style_logs(created_at DESC);

-- Row Level Security (RLS) 활성화
ALTER TABLE style_logs ENABLE ROW LEVEL SECURITY;

-- 정책: 모든 사용자가 읽기 가능 (개발 단계용)
CREATE POLICY "Enable read access for all users" ON style_logs
    FOR SELECT USING (true);

-- 정책: 모든 사용자가 쓰기 가능 (개발 단계용)
CREATE POLICY "Enable insert access for all users" ON style_logs
    FOR INSERT WITH CHECK (true);

-- 정책: 모든 사용자가 수정 가능 (개발 단계용)
CREATE POLICY "Enable update access for all users" ON style_logs
    FOR UPDATE USING (true);

-- 정책: 모든 사용자가 삭제 가능 (개발 단계용)
CREATE POLICY "Enable delete access for all users" ON style_logs
    FOR DELETE USING (true);

-- updated_at 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_style_logs_updated_at BEFORE UPDATE ON style_logs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 샘플 데이터 삽입 (테스트용)
INSERT INTO style_logs (date, title, content, weather, weather_temp, tags) VALUES
('2018-07-13', 'Today is trip three days!', 'The weather was really good and I felt so good.

I eat my favorite pasta and pizza,
I chat with my friends.

It seemed that I had not had time to look back at myself, but I feel a little healed due to my vacation.

Better travel together with a loved one.
Tomorrow I''ll play again!', 'cloudy', 25.5, ARRAY['여행', '힐링']),

('2018-07-15', 'Beautiful day at the park', 'Spent the afternoon at the park. The weather was perfect for a picnic.', 'sunny', 28.0, ARRAY['outdoor', 'picnic']),

('2018-07-10', 'Coffee time', 'Relaxing at my favorite cafe. Perfect cozy outfit for the day.', 'rainy', 20.0, ARRAY['cafe', 'cozy']);

