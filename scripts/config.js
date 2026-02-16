// ===================================
// 환경 설정
// ===================================
// 개발 환경 체크
// - localhost, 127.0.0.1, 192.168.x.x (로컬)
// - alpha 포함 도메인 (Alpha 배포 환경)
const isDevelopment = window.location.hostname === 'localhost' || 
                      window.location.hostname === '127.0.0.1' ||
                      window.location.hostname.includes('192.168');

const isAlpha = window.location.hostname.includes('alpha') || 
                window.location.hostname.includes('-git-alpha-');

// 테스트 환경 여부 (dev 또는 alpha)
const isTestEnvironment = isDevelopment || isAlpha;

// ===================================
// Supabase 설정
// ===================================

// 개발(테스트) 서버 설정
const DEV_CONFIG = {
    SUPABASE_URL: 'https://roeurruguzxipevppnko.supabase.co',
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJvZXVycnVndXp4aXBldnBwbmtvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4MTY0MDcsImV4cCI6MjA4MjM5MjQwN30.JGkCsUGdiW4NKIcrM2dOVV0AqiFX4IwfVCsz3sC6sEM'
};

// 프로덕션(리얼) 서버 설정
const PROD_CONFIG = {
    SUPABASE_URL: 'https://zymszibiwojzrtxhiesc.supabase.co',
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp5bXN6aWJpd29qenJ0eGhpZXNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4MTY5MTksImV4cCI6MjA4MjM5MjkxOX0.9TLof1cyqSkZ33Y-stvBaqQ3iT9lpoMnljsk-XPMBHM'
};

// 현재 환경에 맞는 설정 선택
// dev 또는 alpha → 테스트 DB
// real → 리얼 DB
const CONFIG = isTestEnvironment ? DEV_CONFIG : PROD_CONFIG;

// Supabase 클라이언트 초기화
const SUPABASE_URL = CONFIG.SUPABASE_URL;
const SUPABASE_ANON_KEY = CONFIG.SUPABASE_ANON_KEY;

// Supabase 클라이언트 생성
const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 환경 정보 출력 (디버깅용)
let environmentName = '프로덕션(리얼)';
if (isDevelopment) {
    environmentName = '개발(로컬)';
} else if (isAlpha) {
    environmentName = '알파(테스트)';
}

if (isTestEnvironment) {
    console.log(`🚀 환경: ${environmentName}`, `DB: 테스트`);
}

// 날씨 API 설정 - Open-Meteo (완전 무료, API 키 불필요!)
// 출처: https://open-meteo.com/
const WEATHER_API_URL = 'https://api.open-meteo.com/v1/forecast';
// 90일 이전 과거 날씨용 Archive API (재분석 데이터, 1940년~)
const WEATHER_ARCHIVE_API_URL = 'https://archive-api.open-meteo.com/v1/archive';

// 날씨 코드 매핑 (WMO Weather codes → 우리 시스템)
const WEATHER_MAPPING = {
    0: 'clear',        // Clear sky
    1: 'sunny',        // Mainly clear
    2: 'cloudy',       // Partly cloudy
    3: 'cloudy',       // Overcast
    45: 'cloudy',      // Fog
    48: 'cloudy',      // Depositing rime fog
    51: 'rainy',       // Drizzle: Light
    53: 'rainy',       // Drizzle: Moderate
    55: 'rainy',       // Drizzle: Dense
    61: 'rainy',       // Rain: Slight
    63: 'rainy',       // Rain: Moderate
    65: 'rainy',       // Rain: Heavy
    71: 'snowy',       // Snow fall: Slight
    73: 'snowy',       // Snow fall: Moderate
    75: 'snowy',       // Snow fall: Heavy
    77: 'snowy',       // Snow grains
    80: 'rainy',       // Rain showers: Slight
    81: 'rainy',       // Rain showers: Moderate
    82: 'rainy',       // Rain showers: Violent
    85: 'snowy',       // Snow showers: Slight
    86: 'snowy',       // Snow showers: Heavy
    95: 'lightning',   // Thunderstorm: Slight or moderate
    96: 'lightning',   // Thunderstorm with slight hail
    99: 'lightning'    // Thunderstorm with heavy hail
};

// 날씨 정보 가져오기 (서울 기준)
async function getWeatherByCoords(lat, lon) {
    try {
        const response = await fetch(
            `${WEATHER_API_URL}?latitude=${lat}&longitude=${lon}&current=temperature_2m,weathercode&daily=temperature_2m_max,temperature_2m_min&timezone=Asia/Seoul&forecast_days=1`
        );
        
        if (!response.ok) {
            throw new Error('날씨 정보를 가져올 수 없습니다');
        }
        
        const data = await response.json();
        const weatherCode = data.current.weathercode;
        
        return {
            weather: WEATHER_MAPPING[weatherCode] || 'cloudy',
            temp: data.current.temperature_2m,
            tempMax: data.daily.temperature_2m_max[0],
            tempMin: data.daily.temperature_2m_min[0],
            description: getWeatherDescription(weatherCode),
            weatherCode: weatherCode
        };
    } catch (error) {
        console.error('날씨 API 오류:', error);
        return null;
    }
}

// 날씨 설명 가져오기
function getWeatherDescription(code) {
    const descriptions = {
        0: '맑음',
        1: '대체로 맑음',
        2: '구름 조금',
        3: '흐림',
        45: '안개',
        48: '짙은 안개',
        51: '약한 이슬비',
        53: '이슬비',
        55: '강한 이슬비',
        61: '약한 비',
        63: '비',
        65: '강한 비',
        71: '약한 눈',
        73: '눈',
        75: '강한 눈',
        77: '진눈깨비',
        80: '소나기',
        81: '강한 소나기',
        82: '폭우',
        85: '약한 눈',
        86: '강한 눈',
        95: '천둥번개',
        96: '우박을 동반한 천둥번개',
        99: '강한 우박을 동반한 천둥번개'
    };
    return descriptions[code] || '흐림';
}

// 특정 날짜의 날씨 정보 가져오기 (서울 기준)
// - 최근 ~90일: Forecast API (실시간/근접 데이터)
// - 90일 이전: Archive API (재분석 데이터, 1940년~)
async function getWeatherByDateAndCoords(lat, lon, date) {
    try {
        // 날짜 유효성 체크
        const requestDate = new Date(date);
        const today = new Date();
        today.setHours(0, 0, 0, 0); // 오늘 자정으로 설정
        
        // 미래 7일 이후 데이터는 API가 지원하지 않음 → UX용 안내 객체 반환
        const sevenDaysLater = new Date(today);
        sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);
        if (requestDate > sevenDaysLater) {
            console.log(`⏭️ ${date} - 7일 이후 미래 날짜, 날씨 API 미지원`);
            return {
                unavailable: true,
                reason: 'future',
                weather: 'cloudy',
                temp: null,
                tempMin: null,
                tempMax: null,
                description: null,
                weatherCode: null
            };
        }
        
        // Forecast API는 미래 예보용 → 과거 날짜는 무조건 Archive API 사용 (Forecast는 과거 date 시 null 반환)
        const useArchiveApi = requestDate < today;
        const apiUrl = useArchiveApi ? WEATHER_ARCHIVE_API_URL : WEATHER_API_URL;
        
        const response = await fetch(
            `${apiUrl}?latitude=${lat}&longitude=${lon}&start_date=${date}&end_date=${date}&daily=temperature_2m_max,temperature_2m_min,weathercode&timezone=Asia/Seoul`
        );
        
        if (!response.ok) {
            console.log(`⚠️ 날씨 API 응답 오류 (${response.status}): ${date}`);
            return null;
        }
        
        const data = await response.json();
        
        const weatherCode = data.daily?.weathercode?.[0];
        const tempMax = data.daily?.temperature_2m_max?.[0];
        const tempMin = data.daily?.temperature_2m_min?.[0];
        
        if (weatherCode == null || tempMax == null || tempMin == null) {
            console.log(`⚠️ 날씨 데이터 없음: ${date}`);
            return null;
        }
        
        return {
            weather: WEATHER_MAPPING[weatherCode] || 'cloudy',
            temp: Math.round((tempMax + tempMin) / 2),
            tempMax,
            tempMin,
            description: getWeatherDescription(weatherCode),
            weatherCode: weatherCode
        };
    } catch (error) {
        console.error(`❌ 날씨 API 오류 (${date}):`, error.message);
        return null;
    }
}

// 특정 날짜의 날씨 가져오기 (서울 고정)
async function getWeatherByDate(date) {
    console.log('📍 서울 날씨 조회:', date);
    return await getWeatherByDateAndCoords(37.5665, 126.9780, date);
}

// 현재 날씨 가져오기 (서울 고정)
async function getCurrentWeather() {
    console.log('📍 서울 현재 날씨 조회');
    return await getWeatherByCoords(37.5665, 126.9780);
}

// 유틸리티 함수들
const utils = {
    // 날짜 포맷팅
    formatDate(date) {
        const d = new Date(date);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    },
    
    // 날짜 표시 포맷
    formatDateDisplay(date) {
        const d = new Date(date);
        const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
        const months = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
                       'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];
        
        const dayName = days[d.getDay()];
        const monthName = months[d.getMonth()];
        const dayNum = d.getDate();
        const year = d.getFullYear();
        
        return `${dayName}. ${monthName} ${dayNum} / ${year}`;
    },
    
    // 로딩 표시
    showLoading() {
        const loader = document.createElement('div');
        loader.id = 'global-loader';
        loader.innerHTML = `
            <div style="
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(255, 255, 255, 0.9);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 9999;
            ">
                <div style="
                    width: 40px;
                    height: 40px;
                    border: 3px solid #f0f0f0;
                    border-top-color: #67d5f5;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                "></div>
            </div>
            <style>
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            </style>
        `;
        document.body.appendChild(loader);
    },
    
    // 로딩 숨김
    hideLoading() {
        const loader = document.getElementById('global-loader');
        if (loader) {
            loader.remove();
        }
    },
    
    // 에러 메시지 표시
    showError(message) {
        alert(`오류: ${message}`);
    }
};

