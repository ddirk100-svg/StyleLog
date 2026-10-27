// ===================================
// 앱 버전 (마이페이지 푸터 등 표시용 — 배포 시 여기와 문서만 맞추면 됩니다)
// ===================================
const APP_VERSION = '2.1V';

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

/** 로컬·알파에서만 상세 로그 (프로덕션 콘솔·소폭 비용 절감) */
function debugLog(...args) {
    if (isTestEnvironment) console.log(...args);
}

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
    debugLog(`🚀 환경: ${environmentName}`, `DB: 테스트`);
}

// 날씨 API 설정 - Open-Meteo (완전 무료, API 키 불필요!)
// 출처: https://open-meteo.com/
const WEATHER_API_URL = 'https://api.open-meteo.com/v1/forecast';
// 90일 이전 과거 날씨용 Archive API (재분석 데이터, 1940년~)
const WEATHER_ARCHIVE_API_URL = 'https://archive-api.open-meteo.com/v1/archive';

/**
 * 브라우저·네트워크 순간 장애 대비 (502/연결 종료 등)
 * 참고: 엣지/게이트웨이 오류 시 응답에 ACAO 헤더가 없으면 크롬이 "CORS로 차단"처럼 보고할 수 있음(실상은 업스트림 5xx).
 */
const OPEN_METEO_MAX_ATTEMPTS = 6;
/** 시도당 상한 — 과거엔 너무 짧아 502·지연 구간에서 abort만 반복되는 경우가 있었음 */
const OPEN_METEO_FETCH_TIMEOUT_MS = 10000;
/** 연속 시도 간 백오프(기본값 + 랜덤) ms */
const OPEN_METEO_FETCH_BACKOFF_BASE_MS = 450;
/** 직전 성공 결과 — Open-Meteo 단절 시 UI가 완전 공백이 되지 않게 (탭 종료까지) */
const WEATHER_SNAPSHOT_SS_KEY = 'stylelog_openmeteo_current_v1';
/** 같은 좌표 — 브라우저 종료 후에도 잠깐이라도 표시 가능하도록 로컬(더 긴 TTL) */
const WEATHER_SNAPSHOT_LS_KEY = 'stylelog_openmeteo_current_v1_ls';
const WEATHER_SNAPSHOT_MAX_AGE_MS = 48 * 60 * 60 * 1000; // 48h session
const WEATHER_SNAPSHOT_LS_MAX_AGE_MS = 96 * 60 * 60 * 1000; // 96h localStorage

async function delayWeather(ms) {
    await new Promise((resolve) => {
        window.setTimeout(resolve, ms);
    });
}

/** 중간 프록시/디스크 캐시에 낡은 오류 응답이 붙는 경우 완화 */
function bustOpenMeteoUrl(fullUrl, attemptIndex) {
    if (attemptIndex < 2) return fullUrl;
    const sep = fullUrl.includes('?') ? '&' : '?';
    return `${fullUrl}${sep}_cb=${Date.now()}&try=${attemptIndex}`;
}

function fetchWithTimeoutMs(url, timeoutMs) {
    const controller = new AbortController();
    const id = window.setTimeout(() => controller.abort(new Error('timeout')), timeoutMs);
    return fetch(url, {
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
        cache: 'no-store',
        headers: { Accept: 'application/json' },
        signal: controller.signal
    }).finally(() => window.clearTimeout(id));
}

async function fetchOpenMeteoJsonWithRetry(fullUrl, { label = '', timeoutMs } = {}) {
    const t = typeof timeoutMs === 'number' ? timeoutMs : OPEN_METEO_FETCH_TIMEOUT_MS;
    let lastErr;
    for (let attempt = 0; attempt < OPEN_METEO_MAX_ATTEMPTS; attempt++) {
        try {
            if (attempt > 0) {
                const jitter = Math.floor(Math.random() * 280);
                const backoff = OPEN_METEO_FETCH_BACKOFF_BASE_MS * 2 ** (attempt - 1) + jitter;
                await delayWeather(backoff);
            }
            const tryUrl = bustOpenMeteoUrl(fullUrl, attempt);
            const response = await fetchWithTimeoutMs(tryUrl, t);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            return await response.json();
        } catch (e) {
            lastErr = e;
            if (isTestEnvironment) {
                console.warn(
                    `[날씨] 재시도 ${attempt + 1}/${OPEN_METEO_MAX_ATTEMPTS} 실패 (${label})`,
                    e && e.message ? e.message : e
                );
            }
        }
    }
    throw lastErr || new Error('날씨 요청 실패');
}

function parseWeatherSnapshot(raw, lat, lon, maxAgeMs) {
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== 'object') return null;
    const latK = typeof obj.lat === 'number' ? obj.lat.toFixed(2) : '';
    const lonK = typeof obj.lon === 'number' ? obj.lon.toFixed(2) : '';
    if (
        latK !== Number(lat).toFixed(2) ||
        lonK !== Number(lon).toFixed(2)
    ) {
        return null;
    }
    const ts = typeof obj.ts === 'number' ? obj.ts : 0;
    if (!ts || Date.now() - ts > maxAgeMs) return null;
    const payload = obj.payload && typeof obj.payload === 'object' ? obj.payload : null;
    if (!payload || payload.weather == null) return null;
    return payload;
}

function readCachedCurrentWeatherSnapshot(lat, lon) {
    try {
        const rawSs = sessionStorage.getItem(WEATHER_SNAPSHOT_SS_KEY);
        if (rawSs) {
            const fromSs = parseWeatherSnapshot(rawSs, lat, lon, WEATHER_SNAPSHOT_MAX_AGE_MS);
            if (fromSs) return fromSs;
        }
        const rawLs = localStorage.getItem(WEATHER_SNAPSHOT_LS_KEY);
        if (rawLs) {
            return parseWeatherSnapshot(rawLs, lat, lon, WEATHER_SNAPSHOT_LS_MAX_AGE_MS);
        }
        return null;
    } catch (_) {
        return null;
    }
}

function rememberCurrentWeatherSnapshot(lat, lon, payload) {
    try {
        const rec = {
            lat: typeof lat === 'number' ? lat : Number(lat),
            lon: typeof lon === 'number' ? lon : Number(lon),
            ts: Date.now(),
            payload
        };
        const json = JSON.stringify(rec);
        sessionStorage.setItem(WEATHER_SNAPSHOT_SS_KEY, json);
        localStorage.setItem(WEATHER_SNAPSHOT_LS_KEY, json);
    } catch (_) {
        /* private mode 등 */
    }
}

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

function normalizeOpenMeteoCurrentPayload(data) {
    if (
        !data ||
        !data.current ||
        data.current.weathercode == null ||
        data.current.temperature_2m == null ||
        !data.daily ||
        data.daily.temperature_2m_max == null ||
        data.daily.temperature_2m_min == null
    ) {
        throw new Error('날씨 응답 형식 오류');
    }
    const max0 = data.daily.temperature_2m_max[0];
    const min0 = data.daily.temperature_2m_min[0];
    if (max0 == null || min0 == null) throw new Error('날씨 응답에 일별 기온이 없음');
    const weatherCode = data.current.weathercode;
    return {
        weather: WEATHER_MAPPING[weatherCode] || 'cloudy',
        temp: data.current.temperature_2m,
        tempMax: max0,
        tempMin: min0,
        description: getWeatherDescription(weatherCode),
        weatherCode: weatherCode
    };
}

/** `current=` 엔드포인트 502 등으로 깨질 때 `hourly` 첫 시간으로 대체 (동일 원본·일별 min/max 유지) */
function normalizeOpenMeteoCurrentFromHourly(data) {
    if (!data || !data.daily || data.daily.temperature_2m_max == null || data.daily.temperature_2m_min == null) {
        throw new Error('날씨(hourly) 응답 형식 오류');
    }
    const max0 = data.daily.temperature_2m_max[0];
    const min0 = data.daily.temperature_2m_min[0];
    if (max0 == null || min0 == null) throw new Error('날씨 응답에 일별 기온이 없음');
    const temps = data.hourly && Array.isArray(data.hourly.temperature_2m) ? data.hourly.temperature_2m : null;
    const codes = data.hourly && Array.isArray(data.hourly.weathercode) ? data.hourly.weathercode : null;
    if (!temps || !codes || temps.length === 0 || codes.length === 0) {
        throw new Error('날씨 hourly 시간열이 비어 있음');
    }
    const weatherCode = codes[0];
    const temp = temps[0];
    if (weatherCode == null || temp == null) throw new Error('날씨 hourly 값 없음');
    return {
        weather: WEATHER_MAPPING[weatherCode] || 'cloudy',
        temp,
        tempMax: max0,
        tempMin: min0,
        description: getWeatherDescription(weatherCode),
        weatherCode
    };
}

// 날씨 정보 가져오기 (서울 기준)
async function getWeatherByCoords(lat, lon) {
    const baseDaily = `latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min&timezone=Asia%2FSeoul&forecast_days=1`;
    const urlCurrent = `${WEATHER_API_URL}?${baseDaily}&current=temperature_2m,weathercode`;
    /** 짧은 hourly만 받아 패킷·파싱 부담 최소화 (`current=` 경로 장애 시 대체) */
    const urlHourly = `${WEATHER_API_URL}?${baseDaily}&hourly=temperature_2m,weathercode&forecast_hours=48`;

    try {
        let data;
        try {
            data = await fetchOpenMeteoJsonWithRetry(urlCurrent, { label: 'forecast-current' });
        } catch (e1) {
            if (isTestEnvironment) {
                console.warn('[날씨] current 요청 일괄 실패 → hourly 폴백 시도', e1 && e1.message ? e1.message : e1);
            }
            data = await fetchOpenMeteoJsonWithRetry(urlHourly, { label: 'forecast-hourly-fallback' });
        }

        let out;
        try {
            out = normalizeOpenMeteoCurrentPayload(data);
        } catch (_) {
            out = normalizeOpenMeteoCurrentFromHourly(data);
        }
        rememberCurrentWeatherSnapshot(lat, lon, out);
        return out;
    } catch (error) {
        console.warn('날씨 API 오류:', error && error.message ? error.message : error);
        const snap = readCachedCurrentWeatherSnapshot(lat, lon);
        if (snap) {
            debugLog('[날씨] Open-Meteo 단절 — 직전 성공 결과(캐시) 사용');
            return snap;
        }
        return null;
    }
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
        
        const fullUrl = `${apiUrl}?latitude=${lat}&longitude=${lon}&start_date=${date}&end_date=${date}&daily=temperature_2m_max,temperature_2m_min,weathercode&timezone=Asia/Seoul`;

        const data = await fetchOpenMeteoJsonWithRetry(fullUrl, {
            label: useArchiveApi ? `archive:${date}` : `forecast-history:${date}`
        });

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

/** 같은 탭에서 getCurrentWeather 동시 호출 시 Open-Meteo 재요청 폭주 방지 */
let __pendingSeoulCurrentWeather = null;

// 현재 날씨 가져오기 (서울 고정)
async function getCurrentWeather() {
    if (__pendingSeoulCurrentWeather) return __pendingSeoulCurrentWeather;

    console.log('📍 서울 현재 날씨 조회');
    __pendingSeoulCurrentWeather = (async () => {
        try {
            return await getWeatherByCoords(37.5665, 126.9780);
        } finally {
            __pendingSeoulCurrentWeather = null;
        }
    })();
    return __pendingSeoulCurrentWeather;
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
        loader.className = 'util-spinner-wrap';
        loader.innerHTML = '<div class="util-spinner"></div>';
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
        console.error('오류:', message);
        if (typeof showAlert === 'function') showAlert(`오류: ${message}`);
    }
};

