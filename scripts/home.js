// 홈 화면 — 초기 목록은 loadAllDayList / 무한 스크롤만 사용

// 상수
const PAGE_SIZE = 10;
const TEMP_FILTER_MIN = -20;
const TEMP_FILTER_MAX = 40;
const PX_PER_DAY_ITEM = 320;
const SCROLL_RESTORE_MAX_BATCH = 50;
const SCROLL_TOLERANCE = 10;
const INFINITE_SCROLL_ROOT_MARGIN = 400;
const WEATHER_API_DELAY_MS = 250;
const HOME_STYLE_LOG_SELECT_BASE =
    'id,user_id,date,title,content,weather,weather_temp,weather_temp_min,weather_temp_max,weather_description,weather_fit,thumb_url,tags,is_favorite,created_at,updated_at';
const HOME_STYLE_LOG_CONTEXT_COLUMNS = 'tpo';
const HOME_STYLE_LOG_KIND_COLUMNS = 'log_kind';
const HOME_STYLE_LOG_SELECT_WITHOUT_ITEMS = HOME_STYLE_LOG_SELECT_BASE;
const HOME_STYLE_LOG_SELECT_WITH_ITEMS = `${HOME_STYLE_LOG_SELECT_BASE},items`;

/** 필터 모달 탭 id ↔ 패널 id (switchTab 중복 제거) */
const HOME_FILTER_PANEL_ID_BY_TAB = Object.freeze({
    year: 'filterPanelYear',
    month: 'filterPanelMonth',
    weatherFit: 'filterPanelWeatherFit',
    temp: 'filterPanelTemp',
    outfit: 'filterPanelOutfit',
    tpo: 'filterPanelTpo',
    favorites: 'filterPanelFavorites'
});

// URL 파라미터에서 연도 가져오기
const urlParams = new URLSearchParams(window.location.search);
let initialYear = parseInt(urlParams.get('year')) || new Date().getFullYear();
let yearsWithData = [];

// 페이지네이션 상태
let currentOffset = 0;
let isLoading = false;
let hasMoreData = true;
let allLoadedLogs = [];

// 필터 상태
let weatherFilterLow = TEMP_FILTER_MIN;
let weatherFilterHigh = TEMP_FILTER_MAX;
let filterYears = [];
let filterMonths = [];
let filterWeatherFit = [];
let filterTpo = [];
let filterFavoritesOnly = false;
/** tpo 컬럼이 없으면 목록 조회에서 빼고 상황 필터를 숨긴다 */
let homeListSelectIncludesContext = true;
/** log_kind 컬럼 — 있으면 reference 행은 목록에서 제외 */
let homeListSelectIncludesLogKind = true;
/** @deprecated 4.1V — UI 제거, 필터 잔여 코드 호환용 */
let filterLogKind = 'my_outfit';
let filterScrapGroup = '';
function persistLogKindFilter() {}
function readPersistedLogKindFilter() {
    return 'my_outfit';
}
function syncHomeLogKindFilterVisibility() {}
/** 착장 필터 선택 키 (`["구분","품목명"]` JSON 문자열 배열 — 기본 OR, 조합 딥링크는 AND) */
let filterOutfitSelectionKeys = [];
/** true면 선택한 착장 품목을 모두 포함한 코디만 (2.3V 조합 화면 → 홈) */
let filterOutfitMatchAll = false;
/** 목록 조회에 `items` 포함 (컬럼 없으면 API 오류 후 끔) */
let homeListSelectIncludesItems = true;

/** 로컬 저장: 홈에서 오늘 날씨 맞춤 보기 여부 (기본 on) */
const RECOMMEND_MODE_STORAGE_KEY = 'stylelog_home_recommend_mode';
/** 상세 → 홈 복귀 시 필터·맞춤 토글 복원 (homeScrollY 와 쌍) */
const HOME_FILTER_STATE_STORAGE_KEY = 'stylelog_home_filter_state';
const HOME_RETURN_LOG_KEY = 'homeReturnLogId';
/** 상세 첫 화면을 맨 위로. 홈 스크롤 복원 키와 따로 둔다. */
const DETAIL_PIN_TOP_KEY = 'stylelog_detail_pin_top';
let recommendationModeEnabled = localStorage.getItem(RECOMMEND_MODE_STORAGE_KEY) !== 'false';
/** 맞춤 켤 때 복원할 필터 스냅샷 */
let manualFilterSnapshot = null;

/** 오늘 예보 기온(최저·최고) — 필터 슬라이더와 맞춤 토글 일치 여부 판단용 */
let cachedTodayTempLow = null;
let cachedTodayTempHigh = null;
/** 오늘 날씨 상태(sunny/rainy 등) — 3.0V 정렬·구분용 */
let cachedTodayWeatherState = '';

function setCachedTodayTempsFromWeather(weather) {
    if (!weather || weather.tempMin == null || weather.tempMax == null) return;
    let low = Math.round(weather.tempMin);
    let high = Math.round(weather.tempMax);
    low = Math.max(TEMP_FILTER_MIN, Math.min(TEMP_FILTER_MAX, low));
    high = Math.max(TEMP_FILTER_MIN, Math.min(TEMP_FILTER_MAX, high));
    if (low > high) [low, high] = [high, low];
    cachedTodayTempLow = low;
    cachedTodayTempHigh = high;
    cachedTodayWeatherState = weather.weather ? String(weather.weather).trim().toLowerCase() : '';
}

async function refreshCachedTodayTemps() {
    try {
        const w = await getCurrentWeather();
        setCachedTodayTempsFromWeather(w);
    } catch (_) { /* ignore */ }
}

function tempsMatchCachedToday(low, high) {
    if (cachedTodayTempLow == null || cachedTodayTempHigh == null) return false;
    return parseInt(low, 10) === cachedTodayTempLow && parseInt(high, 10) === cachedTodayTempHigh;
}

/** 이미 적용된 기온 범위가 오늘과 다르면 맞춤 토글만 끔 */
function clearRecommendIfAppliedTempNotToday(low, high) {
    if (!recommendationModeEnabled) return;
    if (!tempsMatchCachedToday(low, high)) {
        recommendationModeEnabled = false;
        localStorage.setItem(RECOMMEND_MODE_STORAGE_KEY, 'false');
        manualFilterSnapshot = null;
        syncWeatherRecommendToggleUI();
    }
}

function syncWeatherRecommendToggleUI() {
    const toggle = document.getElementById('recommendModeToggle');
    const label = document.getElementById('recommendModeLabel');
    const hint = document.getElementById('recommendModeHint');
    if (!toggle) return;
    toggle.classList.toggle('is-on', recommendationModeEnabled);
    toggle.setAttribute('aria-checked', recommendationModeEnabled ? 'true' : 'false');
    if (label) {
        label.textContent = recommendationModeEnabled
            ? '오늘 기온 맞춤 목록'
            : '전체 코디';
    }
    if (hint) {
        hint.hidden = !recommendationModeEnabled;
    }
}

function getDayListContainer() {
    return document.getElementById('dayListContainer') || document.querySelector('.day-list-container');
}

function homeStyleLogSelectColumns() {
    const base = homeListSelectIncludesItems
        ? HOME_STYLE_LOG_SELECT_WITH_ITEMS
        : HOME_STYLE_LOG_SELECT_WITHOUT_ITEMS;
    let cols = base;
    if (homeListSelectIncludesContext) cols = `${cols},${HOME_STYLE_LOG_CONTEXT_COLUMNS}`;
    if (homeListSelectIncludesLogKind) cols = `${cols},${HOME_STYLE_LOG_KIND_COLUMNS}`;
    return cols;
}

function isStyleLogLogKindSelectUnavailable(error) {
    return typeof isLogKindColumnError === 'function' && isLogKindColumnError(error);
}

function normalizedLogKindFromRow(log) {
    return typeof normalizeLogKind === 'function' ? normalizeLogKind(log?.log_kind) : 'my_outfit';
}

function isLegacyReferenceLog(log) {
    return homeListSelectIncludesLogKind && normalizedLogKindFromRow(log) === 'reference';
}

function isStyleLogContextSelectUnavailable(error) {
    const flat = String(error?.message || error?.details || error?.hint || '').toLowerCase();
    if (!/\btpo\b/.test(flat)) return false;
    return /does not exist|schema cache|could not find|42703|pgrst204/.test(flat);
}

function syncHomeContextFilterVisibility() {
    document
        .querySelectorAll(
            '.filter-category-chip[data-tab="tpo"], .filter-tab[data-tab="tpo"], #filterPanelTpo'
        )
        .forEach((el) => {
            el.hidden = !homeListSelectIncludesContext;
        });
}

function syncHomeOutfitFilterTabVisibility() {
    document
        .querySelectorAll('.filter-category-chip[data-tab="outfit"], .filter-tab[data-tab="outfit"], #filterPanelOutfit')
        .forEach((el) => {
            el.hidden = !homeListSelectIncludesItems;
        });
}

function outfitFilterPairKey(cat, val) {
    const c = String(cat || '').trim();
    const v = String(val || '').trim();
    if (!c || !v) return '';
    return JSON.stringify([c, v]);
}

/** 칩 표시용 짧은 문자열 */
function outfitFilterKeyLabel(storageKey) {
    try {
        const a = JSON.parse(storageKey);
        if (Array.isArray(a) && a.length === 2) {
            const c = String(a[0] || '').trim();
            const v = String(a[1] || '').trim();
            if (c && v) return `${c}·${v}`;
        }
    } catch (_) {
        /* ignore */
    }
    return '';
}

/** 착장 활성 칩: 짧은 라벨 + 전체는 title 툴팁 */
function summarizeOutfitFilterKeysForChip(keys, matchAll) {
    const k = keys || [];
    const list = k.map(outfitFilterKeyLabel).filter(Boolean);
    const title = list.join(', ');
    const n = k.length;
    if (n === 0) return { label: '착장 품목', title: '' };
    if (matchAll && n === 2) {
        return { label: `조합 · ${list.join(' + ')}`, title };
    }
    if (n >= 2) return { label: `착장 품목 ${n}`, title };
    return { label: `착장 품목 · ${list[0] || ''}`, title };
}

function escapeFilterChipAttr(text) {
    return String(text).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

/** 홈 필터 활성 칩 HTML (착장은 말줄임·툴팁용 title) */
function buildHomeFilterActiveChipHtml(c) {
    const titleAttr = c.title ? ` title="${escapeFilterChipAttr(c.title)}"` : '';
    const outfitCls = c.key === 'outfit' ? ' filter-active-chip--outfit' : '';
    const keyAttr = escapeFilterChipAttr(c.key);
    return `<span class="filter-active-chip${outfitCls}" data-key="${keyAttr}"${titleAttr}><span class="filter-active-chip-body">${escapeHtml(c.label)}</span><button type="button" class="filter-active-chip-remove" data-key="${keyAttr}" aria-label="조건 제거">×</button></span>`;
}

/** 로그의 items 필드에서 `{ category, value }` 쌍 목록 */
function parseLogItemsPairs(itemsJson) {
    const api = globalThis.StyleLogOutfitCombinations;
    if (api?.parseLogItemsPairs) return api.parseLogItemsPairs(itemsJson);
    return [];
}

function logPassesOutfitFilterKeys(log, keys, matchAll) {
    if (!keys || keys.length === 0) return true;
    const pairs = parseLogItemsPairs(log.items);
    if (pairs.length === 0) return false;
    const set = new Set(keys);
    const logKeys = new Set(
        pairs
            .map(([c, v]) => outfitFilterPairKey(c, v))
            .filter(Boolean)
    );
    if (matchAll) {
        return keys.every((key) => logKeys.has(key));
    }
    return pairs.some(([c, v]) => {
        const k = outfitFilterPairKey(c, v);
        return k && set.has(k);
    });
}

function sortedOutfitCategoriesFromValueMap(map) {
    return [...map.keys()].sort((a, b) => {
        const ra = outfitCategorySortRank(a);
        const rb = outfitCategorySortRank(b);
        if (ra !== rb) return ra - rb;
        return a.localeCompare(b, 'ko');
    });
}

/** 모달 「착장 품목」패널 옵션 재구성 (불러온 로그 기준) */
function refreshHomeOutfitFilterPanelUI(containerEl) {
    if (!containerEl) return;
    if (!homeListSelectIncludesItems) {
        containerEl.innerHTML = '';
        return;
    }
    if (typeof mergeItemsJsonIntoCategoryValueMap !== 'function') {
        containerEl.innerHTML =
            '<p class="filter-outfit-empty">착장 품목 필터를 쓸 수 없습니다. 페이지를 새로고침 해 보세요.</p>';
        return;
    }
    const map = new Map();
    allLoadedLogs.forEach((log) => mergeItemsJsonIntoCategoryValueMap(log.items, map));
    const cats = sortedOutfitCategoriesFromValueMap(map);
    containerEl.innerHTML = '';
    if (cats.length === 0) {
        containerEl.innerHTML =
            '<p class="filter-outfit-empty">불러온 기록에 착장 품목이 없습니다. 목록을 더 불러오거나 작성 화면에서 착장 품목을 저장해 보세요.</p>';
        return;
    }
    cats.forEach((cat, idx) => {
        const vals = [...map.get(cat)].sort((a, b) => a.localeCompare(b, 'ko'));
        const details = document.createElement('details');
        details.className = 'filter-outfit-category';
        details.open = idx === 0;

        const sum = document.createElement('summary');
        sum.className = 'filter-outfit-category-summary';
        sum.textContent = `${cat} (${vals.length})`;

        const inner = document.createElement('div');
        inner.className = 'filter-outfit-values';

        vals.forEach((val) => {
            const key = outfitFilterPairKey(cat, val);
            const label = document.createElement('label');
            label.className = 'filter-option filter-outfit-value-option';
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.name = 'filterOutfitPair';
            cb.value = key;
            cb.checked = filterOutfitSelectionKeys.includes(key);
            const span = document.createElement('span');
            span.textContent = val;
            label.appendChild(cb);
            label.appendChild(span);
            inner.appendChild(label);
        });

        details.appendChild(sum);
        details.appendChild(inner);
        containerEl.appendChild(details);
    });
}

function snapshotCurrentFilters() {
    return {
        weatherFilterLow,
        weatherFilterHigh,
        filterYears: [...filterYears],
        filterMonths: [...filterMonths],
        filterWeatherFit: [...filterWeatherFit],
        filterTpo: [...filterTpo],
        filterFavoritesOnly,
        filterOutfitSelectionKeys: [...filterOutfitSelectionKeys],
        filterOutfitMatchAll: !!filterOutfitMatchAll
    };
}

function restoreFiltersFromSnapshot(s) {
    if (!s) return;
    weatherFilterLow = s.weatherFilterLow;
    weatherFilterHigh = s.weatherFilterHigh;
    filterYears = [...s.filterYears];
    filterMonths = [...s.filterMonths];
    filterWeatherFit = [...s.filterWeatherFit];
    filterTpo = typeof normalizeTpoValues === 'function'
        ? normalizeTpoValues(s.filterTpo)
        : (Array.isArray(s.filterTpo) ? [...s.filterTpo] : []);
    filterFavoritesOnly = s.filterFavoritesOnly;
    filterOutfitSelectionKeys = Array.isArray(s.filterOutfitSelectionKeys)
        ? [...s.filterOutfitSelectionKeys]
        : [];
    filterOutfitMatchAll = !!s.filterOutfitMatchAll;
}

function saveHomeFilterStateForDetailReturn() {
    try {
        const payload = {
            ...snapshotCurrentFilters(),
            recommendationModeEnabled: !!recommendationModeEnabled
        };
        sessionStorage.setItem(HOME_FILTER_STATE_STORAGE_KEY, JSON.stringify(payload));
    } catch (_) {
        /* quota 등 */
    }
}

/** homeScrollY 가 있으면 상세에서 돌아온 것 — 저장된 필터 1회 복원 */
function consumeHomeFilterStateIfReturningFromDetail() {
    if (sessionStorage.getItem('homeScrollY') == null) return false;
    const raw = sessionStorage.getItem(HOME_FILTER_STATE_STORAGE_KEY);
    sessionStorage.removeItem(HOME_FILTER_STATE_STORAGE_KEY);
    if (!raw) return false;
    try {
        const s = JSON.parse(raw);
        if (!s || typeof s !== 'object') return false;
        recommendationModeEnabled = !!s.recommendationModeEnabled;
        localStorage.setItem(
            RECOMMEND_MODE_STORAGE_KEY,
            recommendationModeEnabled ? 'true' : 'false'
        );
        restoreFiltersFromSnapshot(s);
        return true;
    } catch (_) {
        return false;
    }
}

async function applyTodayWeatherRecommendationFilters() {
    try {
        const weather = await getCurrentWeather();
        if (weather?.tempMin != null && weather?.tempMax != null) {
            setCachedTodayTempsFromWeather(weather);
            let low = Math.round(weather.tempMin);
            let high = Math.round(weather.tempMax);
            low = Math.max(TEMP_FILTER_MIN, Math.min(TEMP_FILTER_MAX, low));
            high = Math.max(TEMP_FILTER_MIN, Math.min(TEMP_FILTER_MAX, high));
            if (low > high) [low, high] = [high, low];
            weatherFilterLow = low;
            weatherFilterHigh = high;
            filterYears = [];
            filterMonths = [];
            filterWeatherFit = [];
            filterTpo = [];
            filterFavoritesOnly = false;
            filterOutfitSelectionKeys = [];
            filterOutfitMatchAll = false;
            if (window.__stylelogHomeApplyFilters) window.__stylelogHomeApplyFilters();
            else {
                const filtered = getFilteredLogs();
                renderFullDayList(filtered);
            }
        }
    } catch (e) {
        console.error(e);
    }
}

async function setRecommendationMode(on) {
    recommendationModeEnabled = on;
    localStorage.setItem(RECOMMEND_MODE_STORAGE_KEY, on ? 'true' : 'false');
    syncWeatherRecommendToggleUI();

    if (on) {
        manualFilterSnapshot = snapshotCurrentFilters();
        await applyTodayWeatherRecommendationFilters();
    } else {
        if (manualFilterSnapshot) {
            restoreFiltersFromSnapshot(manualFilterSnapshot);
            manualFilterSnapshot = null;
        } else {
            weatherFilterLow = TEMP_FILTER_MIN;
            weatherFilterHigh = TEMP_FILTER_MAX;
            filterYears = [];
            filterMonths = [];
            filterWeatherFit = [];
            filterTpo = [];
            filterFavoritesOnly = false;
            filterOutfitSelectionKeys = [];
            filterOutfitMatchAll = false;
            if (homeListSelectIncludesLogKind) {
                filterLogKind = 'my_outfit';
                filterScrapGroup = '';
                persistLogKindFilter();
            }
        }
        if (window.__stylelogHomeApplyFilters) window.__stylelogHomeApplyFilters();
    }
}

function bindRecommendModeToggle() {
    const toggle = document.getElementById('recommendModeToggle');
    if (!toggle || toggle.dataset.stylelogRecommendBound === '1') return;
    toggle.dataset.stylelogRecommendBound = '1';
    toggle.addEventListener('click', async () => {
        await setRecommendationMode(!recommendationModeEnabled);
    });
}

async function initRecommendModeOnLoad(options = {}) {
    bindRecommendModeToggle();
    if (!options.skipAutoApply && recommendationModeEnabled) {
        await applyTodayWeatherRecommendationFilters();
    }
}

// 페이지 초기화
function outfitFilterKeyFromUrl(params = new URLSearchParams(location.search)) {
    const cat = String(params.get('outfitCat') || '').trim();
    const val = String(params.get('outfitVal') || '').trim();
    if (!cat || !val) return '';
    return outfitFilterPairKey(cat, val);
}

function parseOutfitFilterFromUrl(params = new URLSearchParams(location.search)) {
    const match = String(params.get('outfitMatch') || '').trim().toLowerCase();
    const rawKeys = params.get('outfitKeys');
    if (rawKeys) {
        try {
            const arr = JSON.parse(rawKeys);
            if (Array.isArray(arr)) {
                const keys = arr.map((k) => String(k).trim()).filter(Boolean);
                return {
                    keys,
                    matchAll: match === 'all' && keys.length > 0
                };
            }
        } catch (_) {
            /* ignore */
        }
    }
    const single = outfitFilterKeyFromUrl(params);
    if (single) return { keys: [single], matchAll: false };
    return { keys: [], matchAll: false };
}

async function initPage() {
    if (typeof formatStyleLogDate === 'function') {
        const today = new Date();
        const heroDateEl = document.getElementById('homeHeroDate');
        if (heroDateEl) {
            heroDateEl.textContent = formatStyleLogDate(today, 'card');
            heroDateEl.setAttribute('datetime', today.toISOString().slice(0, 10));
        }
    }

    const params = new URLSearchParams(location.search);
    const restoredFiltersFromDetail = consumeHomeFilterStateIfReturningFromDetail();
    window.__stylelogHomeSkipUrlFilterParams = restoredFiltersFromDetail;

    if (!restoredFiltersFromDetail) {
        const outfitFromUrl = parseOutfitFilterFromUrl(params);
        if (params.get('filter') === 'fav' || outfitFromUrl.keys.length > 0) {
            recommendationModeEnabled = false;
        }
        if (outfitFromUrl.keys.length > 0) {
            filterOutfitSelectionKeys = [...outfitFromUrl.keys];
            filterOutfitMatchAll = outfitFromUrl.matchAll;
        }
    }
    /** Open-Meteo 지연 시 로그 목록까지 막히지 않도록 비차단 — 완료 후 토글만 동기화 */
    void refreshCachedTodayTemps().then(() => {
        syncWeatherRecommendToggleUI();
    });
    syncWeatherRecommendToggleUI();

    const yearsPromise = loadYearsWithData();
    
    // 일별 리스트 모드용 클래스 추가
    const container = document.getElementById('homeView');
    if (container) {
        container.classList.add('day-view-active');
    }
    
    // 목록을 먼저 그린 뒤 필터용 연도 목록은 백그라운드
    await loadAllDayList();
    void yearsPromise;
    
    // 스와이프 기능 초기화
    initSwipe();
    
    // 필터 모달 초기화
    initFilterModal();

    if (restoredFiltersFromDetail) {
        await initRecommendModeOnLoad({ skipAutoApply: true });
        /* 목록을 비우고 전체를 다시 받지 않는다. 칩만 맞춘다. */
        if (typeof window.__stylelogHomeSyncFilterChrome === 'function') {
            window.__stylelogHomeSyncFilterChrome();
        }
    } else {
        await initRecommendModeOnLoad();
    }

    window.__stylelogHomeSkipUrlFilterParams = false;

    // 상세에서 뒤로 왔을 때 스크롤 위치 복원 (완료될 때까지 await)
    await restoreHomeScrollPosition();

    updateMenuUserInfo();
}

function findHomeReturnCard(logId) {
    if (!logId) return null;
    const safeId = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(String(logId)) : String(logId);
    return document.querySelector(`.day-item[data-log-id="${safeId}"]`);
}

function scrollHomeReturnCardIntoView(card) {
    if (!card) return;
    card.scrollIntoView({ block: 'center', inline: 'nearest' });
}

/** 상세에서 돌아온 위치. 픽셀보다 카드 id가 맞다. 사진 높이가 나중에 잡혀도 그 카드에 둔다. */
async function restoreHomeScrollPosition() {
    const saved = sessionStorage.getItem('homeScrollY');
    const logId = sessionStorage.getItem(HOME_RETURN_LOG_KEY);
    if (saved == null && !logId) {
        document.body.classList.remove('scroll-restore-pending');
        return;
    }
    sessionStorage.removeItem('homeScrollY');
    sessionStorage.removeItem(HOME_RETURN_LOG_KEY);
    const targetY = parseInt(saved || '0', 10);

    let guard = 0;
    while (!findHomeReturnCard(logId) && hasMoreData && guard < 40) {
        guard += 1;
        if (!isLoading) await loadMoreDayList(PAGE_SIZE);
        else await new Promise((resolve) => setTimeout(resolve, 40));
    }

    const card = findHomeReturnCard(logId);
    if (card) scrollHomeReturnCardIntoView(card);
    else if (!Number.isNaN(targetY) && targetY > 0) window.scrollTo(0, targetY);

    document.body.classList.remove('scroll-restore-pending');
    requestAnimationFrame(() => scrollHomeReturnCardIntoView(findHomeReturnCard(logId)));
}

// 일기가 있는 연도 목록 로드
async function loadYearsWithData() {
    try {
        debugLog('📅 연도 목록 로딩 중...');
        
        // Supabase에서 연도만 가져오기 (distinct)
        // date 컬럼만 select하고 정렬하여 중복 제거
        const { data, error } = await supabaseClient
            .from('style_logs')
            .select('date')
            .order('date', { ascending: false })
            .limit(240);
        
        if (error) throw error;
        
        if (data && data.length > 0) {
            // 중복 제거하여 연도 목록 생성
            const years = [...new Set(data.map(log => new Date(log.date).getFullYear()))];
            yearsWithData = years.sort((a, b) => b - a); // 최신 연도가 위로
            debugLog('✅ 일기가 있는 연도:', yearsWithData);
        } else {
            yearsWithData = [new Date().getFullYear()]; // 데이터 없으면 현재 연도만
        }
    } catch (error) {
        console.error('❌ 연도 목록 로드 오류:', error);
        yearsWithData = [new Date().getFullYear()];
    }
}

// 레거시 월 카드·view-toggle·연도 단위 loadDayList 제거됨 (호출 경로 없음). 초기·추가 로드는 loadAllDayList / loadMoreDayList 만 사용.

function renderHomeListSkeleton(count = 3) {
    const n = Math.max(1, Math.min(count, 5));
    let cards = '';
    for (let i = 0; i < n; i++) {
        cards += '<div class="home-skeleton-card" aria-hidden="true"></div>';
    }
    return `<div class="home-feed-skeleton" aria-busy="true" aria-label="코디 불러오는 중">${cards}</div>`;
}

// 모든 연도의 일별 리스트 로드 (초기 로드)
async function loadAllDayList() {
    try {
        debugLog('📅 초기 데이터 로딩 중...');
        
        // 상태 초기화
        currentOffset = 0;
        hasMoreData = true;
        allLoadedLogs = [];
        
        const container = getDayListContainer();
        if (!container) {
            console.error('❌ .day-list-container 요소를 찾을 수 없습니다');
            return;
        }
        
        // day-list 스타일 적용
        container.classList.add('day-list-view');
        container.innerHTML = renderHomeListSkeleton(3);
        
        // 스크롤 복원 시 초기 로드량 확대 (API 호출 1회로 커버)
        const savedY = parseInt(sessionStorage.getItem('homeScrollY') || '0', 10);
        const initialLimit = (savedY > 0)
            ? Math.min(SCROLL_RESTORE_MAX_BATCH, Math.max(PAGE_SIZE, Math.ceil(savedY / PX_PER_DAY_ITEM)))
            : PAGE_SIZE;
        await loadMoreDayList(initialLimit);
        
        // 무한 스크롤 이벤트 리스너 등록
        initInfiniteScroll();
        
        debugLog('✅ 초기 데이터 로딩 완료');
        
    } catch (error) {
        console.error('❌ 데이터 로드 오류:', error);
        const container = getDayListContainer();
        if (container) {
            container.innerHTML = `
                <div class="util-error">
                    <p class="util-error-title">데이터를 불러오는데 실패했습니다.</p>
                    <p class="util-sub">${error.message || '알 수 없는 오류'}</p>
                    <button class="util-btn-primary" onclick="location.reload()">다시 시도</button>
                </div>
            `;
        }
    }
}

// 추가 데이터 로드 (페이지네이션)
// quiet: true면 로딩 UI 없이 백그라운드 로드 (필터 개수 산출 시 사용)
async function loadMoreDayList(limit = PAGE_SIZE, quiet = false) {
    if (isLoading || !hasMoreData) {
        debugLog('⏸️ 로딩 중이거나 더 이상 데이터 없음');
        return;
    }
    
    isLoading = true;
    if (!quiet) {
        showLoadingIndicator();
    }
    const loadStart = Date.now();
    const MIN_LOADER_DISPLAY_MS = 0;
    
    try {
        debugLog(`📊 데이터 로딩... offset: ${currentOffset}, limit: ${limit}`);
        
        // 페이지네이션 (thumb_url, items — 착장 필터용)
        let selectCols = homeStyleLogSelectColumns();
        let queryRes = await supabaseClient
            .from('style_logs')
            .select(selectCols)
            .order('date', { ascending: false })
            .range(currentOffset, currentOffset + limit - 1);
        let data = queryRes.data;
        let error = queryRes.error;

        if (
            error &&
            homeListSelectIncludesItems &&
            typeof isStyleLogItemsColumnUnavailable === 'function' &&
            isStyleLogItemsColumnUnavailable(error)
        ) {
            homeListSelectIncludesItems = false;
            filterOutfitSelectionKeys = [];
            filterOutfitMatchAll = false;
            syncHomeOutfitFilterTabVisibility();
            queryRes = await supabaseClient
                .from('style_logs')
                .select(HOME_STYLE_LOG_SELECT_WITHOUT_ITEMS)
                .order('date', { ascending: false })
                .range(currentOffset, currentOffset + limit - 1);
            data = queryRes.data;
            error = queryRes.error;
        }

        if (error && homeListSelectIncludesContext && isStyleLogContextSelectUnavailable(error)) {
            homeListSelectIncludesContext = false;
            filterTpo = [];
            syncHomeContextFilterVisibility();
            queryRes = await supabaseClient
                .from('style_logs')
                .select(homeStyleLogSelectColumns())
                .order('date', { ascending: false })
                .range(currentOffset, currentOffset + limit - 1);
            data = queryRes.data;
            error = queryRes.error;
        }

        if (error && homeListSelectIncludesLogKind && isStyleLogLogKindSelectUnavailable(error)) {
            homeListSelectIncludesLogKind = false;
            queryRes = await supabaseClient
                .from('style_logs')
                .select(homeStyleLogSelectColumns())
                .order('date', { ascending: false })
                .range(currentOffset, currentOffset + limit - 1);
            data = queryRes.data;
            error = queryRes.error;
        }

        if (error) throw error;
        
        debugLog(`✅ ${data ? data.length : 0}개 로드됨`);
        
        // 더 이상 데이터가 없으면
        if (!data || data.length === 0) {
            hasMoreData = false;
            isLoading = false;
            if (!quiet) hideLoadingIndicator();
            
            // 전체 데이터가 없으면 안내 메시지
            if (allLoadedLogs.length === 0) {
                const container = getDayListContainer();
                container.innerHTML = buildHomeFirstEmptyHtml();
            } else if (getFilteredLogs().length > 0) {
                showEndMessage();
            }
            return;
        }
        
        // 요청량보다 적게 받았으면 마지막 페이지
        if (data.length < limit) {
            hasMoreData = false;
        }
        
        // 로드된 데이터를 배열에 추가
        allLoadedLogs.push(...data);
        
        // 날씨 데이터 업데이트 (비동기로 백그라운드 처리)
        updateWeatherDataInBackground(data);
        
        if (currentOffset === 0) {
            getDayListContainer()?.querySelector('.home-feed-skeleton')?.remove();
        }

        // 날씨 필터 적용 후 렌더링
        const filtered = data.filter(passesWeatherFilter);
        await renderDayList(filtered);

        // 다음 페이지를 위해 offset 증가
        currentOffset += data.length;
        
        // 마지막 페이지면 완료 메시지 표시 (필터 부합 항목이 있을 때만)
        if (!hasMoreData && getFilteredLogs().length > 0) {
            showEndMessage();
        }
        
    } catch (error) {
        console.error('❌ 추가 데이터 로드 오류:', error);
        hasMoreData = false;
    } finally {
        isLoading = false;
        if (quiet) return;
        const elapsed = Date.now() - loadStart;
        if (elapsed < MIN_LOADER_DISPLAY_MS) {
            setTimeout(hideLoadingIndicator, MIN_LOADER_DISPLAY_MS - elapsed);
        } else {
            hideLoadingIndicator();
        }
    }
}

// 로딩 인디케이터 표시 (viewport 하단 고정 - 스크롤 위치와 무관하게 항상 노출)
function showLoadingIndicator() {
    hideLoadingIndicator();
    const loader = document.createElement('div');
    loader.id = 'infinite-scroll-loader';
    loader.className = 'infinite-scroll-loader-fixed';
    loader.innerHTML = `
        <div class="util-infinite-loader">
            <div class="util-spinner"></div>
            <p>로딩 중...</p>
        </div>
    `;
    document.body.appendChild(loader);
}

// 로딩 인디케이터 숨기기
function hideLoadingIndicator() {
    document.getElementById('infinite-scroll-loader')?.remove();
}

// 끝 메시지 표시
function showEndMessage() {
    // 이미 있으면 제거
    const existingMsg = document.getElementById('end-message');
    if (existingMsg) return;
    
    const container = getDayListContainer();
    if (!container) return;
    
    const endMsg = document.createElement('div');
    endMsg.id = 'end-message';
    endMsg.innerHTML = `
        <div class="util-end-message">
            <p>모든 기록을 불러왔습니다</p>
        </div>
    `;
    
    const sentinel = document.getElementById('infinite-scroll-sentinel');
    if (sentinel) container.insertBefore(endMsg, sentinel);
    else container.appendChild(endMsg);
}

// 날씨 데이터를 백그라운드에서 업데이트 (UI 렌더링을 차단하지 않음)
async function updateWeatherDataInBackground(logs) {
    const logsNeedingWeather = logs.filter(
        (log) =>
            (log.weather_temp_min === null || log.weather_temp_min === undefined) &&
            (log.weather_temp_max === null || log.weather_temp_max === undefined)
    );

    if (logsNeedingWeather.length === 0) return;

    (async () => {
        for (const log of logsNeedingWeather) {
            try {
                const weatherData = await getWeatherByDate(log.date);
                if (weatherData?.unavailable && weatherData?.reason === 'future') continue;
                if (weatherData?.tempMin != null && weatherData?.tempMax != null) {
                    await StyleLogAPI.update(log.id, {
                        weather_temp_min: weatherData.tempMin,
                        weather_temp_max: weatherData.tempMax,
                        weather_temp: weatherData.temp
                    });
                    log.weather_temp_min = weatherData.tempMin;
                    log.weather_temp_max = weatherData.tempMax;
                    log.weather_temp = weatherData.temp;
                    updateDayItemWeather(log.id, weatherData);
                }
                await new Promise((r) => setTimeout(r, WEATHER_API_DELAY_MS));
            } catch (error) {
                console.error(`❌ ${log.date} 날씨 업데이트 실패:`, error);
            }
        }
    })();
}

// 특정 아이템의 날씨 정보만 업데이트
function updateDayItemWeather(logId, weatherData) {
    const dayItem = document.querySelector(`.day-item[data-log-id="${logId}"]`);
    if (!dayItem) return;
    if (weatherData?.tempMin == null || weatherData?.tempMax == null) return;

    const tempsHtml = `
            <span class="temp-high">${Math.round(weatherData.tempMax)}°</span>
            <span class="temp-sep">/</span>
            <span class="temp-low">${Math.round(weatherData.tempMin)}°</span>`;

    const weatherInline = dayItem.querySelector('.day-card-weather-inline');
    if (weatherInline) {
        let tempsEl = weatherInline.querySelector('.day-card-temps');
        if (tempsEl) {
            tempsEl.innerHTML = tempsHtml;
        } else {
            const span = document.createElement('span');
            span.className = 'day-card-temps';
            span.setAttribute('aria-label', '최고 최저 기온');
            span.innerHTML = tempsHtml;
            const icon = weatherInline.querySelector('svg');
            if (icon?.parentNode) {
                icon.parentNode.insertBefore(span, icon.nextSibling);
            } else {
                weatherInline.prepend(span);
            }
        }
        return;
    }

    const weatherInfo = dayItem.querySelector('.weather-info-compact');
    if (!weatherInfo) return;

    const tempCompact = weatherInfo.querySelector('.temp-compact');
    if (tempCompact) {
        tempCompact.innerHTML = `
            <span class="temp-high">${Math.round(weatherData.tempMax)}°</span>
            <span class="temp-low">${Math.round(weatherData.tempMin)}°</span>
        `;
    }
}

// 데이터를 UI에 렌더링 (DocumentFragment로 배치 reflow 최소화)
async function renderDayList(logs) {
    const container = getDayListContainer();
    if (!container) return;

    const allYearLabels = container.querySelectorAll('.year-label-day-view');
    const allMonthLabels = container.querySelectorAll('.month-label-day-view');

    const fragment = document.createDocumentFragment();
    const continuation = {
        previousYear: null,
        previousMonth: null
    };
    if (allYearLabels.length > 0) {
        continuation.previousYear = parseInt(allYearLabels[allYearLabels.length - 1].textContent, 10);
    }
    if (allMonthLabels.length > 0) {
        continuation.previousMonth = parseInt(allMonthLabels[allMonthLabels.length - 1].textContent, 10);
    }
    appendDayListChunksToFragment(fragment, logs, continuation);
    
    const sentinel = document.getElementById('infinite-scroll-sentinel');
    if (sentinel) container.insertBefore(fragment, sentinel);
    else container.appendChild(fragment);
    attachDayListEventListeners();
}

// throttle 헬퍼 (스크롤 등 고빈도 이벤트 최적화)
function throttle(fn, delay) {
    let last = 0;
    let timer = null;
    return function(...args) {
        const now = Date.now();
        const remaining = delay - (now - last);
        if (remaining <= 0) {
            if (timer) clearTimeout(timer);
            last = now;
            fn.apply(this, args);
        } else if (!timer) {
            timer = setTimeout(() => {
                last = Date.now();
                timer = null;
                fn.apply(this, args);
            }, remaining);
        }
    };
}

// 무한 스크롤 초기화 (IntersectionObserver + scroll 폴백 - 빠른 스크롤 시 즉시 감지)
let infiniteScrollObserver = null;
let _scrollCheckScheduled = false;

function checkNearBottomAndLoad() {
    if (isLoading || !hasMoreData) return;
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollHeight = document.documentElement.scrollHeight;
    const clientHeight = window.innerHeight;
    const distanceFromBottom = scrollHeight - (scrollTop + clientHeight);
    if (distanceFromBottom < INFINITE_SCROLL_ROOT_MARGIN) {
        loadMoreDayList();
    }
}

function _onScrollForInfinite() {
    if (_scrollCheckScheduled) return;
    _scrollCheckScheduled = true;
    requestAnimationFrame(() => {
        checkNearBottomAndLoad();
        _scrollCheckScheduled = false;
    });
}

function initInfiniteScroll() {
    const container = getDayListContainer();
    if (!container) return;

    // 기존 관찰 해제
    if (infiniteScrollObserver) {
        infiniteScrollObserver.disconnect();
        infiniteScrollObserver = null;
    }
    window.removeEventListener('scroll', _onScrollForInfinite, { passive: true });

    // sentinel: 리스트 맨 아래에 두고 뷰포트에 들어오면 로드
    let sentinel = document.getElementById('infinite-scroll-sentinel');
    if (!sentinel) {
        sentinel = document.createElement('div');
        sentinel.id = 'infinite-scroll-sentinel';
        sentinel.style.cssText = 'height:1px;width:100%;pointer-events:none;';
        container.appendChild(sentinel);
    }

    // IntersectionObserver (정상 스크롤)
    infiniteScrollObserver = new IntersectionObserver(
        (entries) => {
            if (!entries[0]?.isIntersecting || isLoading || !hasMoreData) return;
            loadMoreDayList();
        },
        { root: null, rootMargin: `0px 0px ${INFINITE_SCROLL_ROOT_MARGIN}px 0px`, threshold: 0 }
    );
    infiniteScrollObserver.observe(sentinel);

    // scroll 폴백: 빠른 스크롤 시 observer가 놓칠 수 있어, 스크롤 위치로도 체크
    window.addEventListener('scroll', _onScrollForInfinite, { passive: true });
}

// 일별 아이템 생성 (home.js용)
function dayListFavoriteToggleHtml(isFavorite) {
    const fav = !!isFavorite;
    return `
                <button type="button" class="favorite-toggle-btn day-card-icon-btn ${fav ? 'active' : ''}" title="${fav ? '즐겨찾기 해제' : '즐겨찾기 추가'}">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="${fav ? 'var(--color-favorite)' : 'none'}" stroke="${fav ? 'var(--color-favorite)' : 'currentColor'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                    </svg>
                </button>`;
}

function escapeHtmlForDayCard(text) {
    if (typeof escapeHtml === 'function') return escapeHtml(text);
    return String(text ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/** 삭제 후 전체 새로고침 없이 목록·상태 동기화 */
function removeHomeLogFromUi(logId) {
    const idStr = String(logId);
    allLoadedLogs = allLoadedLogs.filter((l) => String(l.id) !== idStr);
    document.getElementById('end-message')?.remove();
    const filtered = getFilteredLogs();
    renderFullDayList(filtered);
    if (filtered.length > 0 && !hasMoreData) showEndMessage();
}

/** 카드에는 칩 대신 한 줄. 길면 앞 3개와 나머지만 보여 주고, 전체는 title에 둔다. */
function dayCardLogKindBadgeHtml(_log) {
    return '';
}

function dayCardTpoLineHtml(log) {
    const tpo = typeof normalizeTpoValues === 'function' ? normalizeTpoValues(log.tpo) : [];
    if (!tpo.length) return '';
    const labels = tpo.map(
        (value) => (typeof TPO_LABELS !== 'undefined' && TPO_LABELS[value]) || value
    );
    const shown = labels.slice(0, 3);
    const extra = labels.length - shown.length;
    const text = extra > 0 ? `${shown.join(' · ')} 외 ${extra}` : shown.join(' · ');
    const full = labels.join(' · ');
    return `<p class="day-card-tpo" title="${escapeHtmlForDayCard(full)}">${escapeHtmlForDayCard(text)}</p>`;
}

function dayCardWeatherFitText(log) {
    if (!log.weather_fit || !['cold', 'good', 'hot'].includes(log.weather_fit)) return '';
    const label =
        typeof WEATHER_FIT_LABELS !== 'undefined' && WEATHER_FIT_LABELS[log.weather_fit]
            ? WEATHER_FIT_LABELS[log.weather_fit]
            : '';
    if (!label) return '';
    return `<span class="day-card-fit">${escapeHtmlForDayCard(label)}</span>`;
}

function dayCardDateLabel(date) {
    if (typeof formatStyleLogDate === 'function') {
        return formatStyleLogDate(date, 'card');
    }
    const d = typeof parseStyleLogDate === 'function'
        ? parseStyleLogDate(date)
        : (date instanceof Date ? date : new Date(date));
    if (!d || Number.isNaN(d.getTime())) return '';
    const wd = typeof STYLELOG_WEEKDAY_KO !== 'undefined' ? STYLELOG_WEEKDAY_KO[d.getDay()] : '';
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const y = d.getFullYear();
    const core = wd ? `${m}.${day} ${wd}` : `${m}.${day}`;
    return y === new Date().getFullYear() ? core : `${y}.${core}`;
}

function dayCardWeatherInlineHtml(log) {
    const fit = dayCardWeatherFitText(log);
    const hasTemps =
        log.weather_temp_min !== null &&
        log.weather_temp_min !== undefined &&
        log.weather_temp_max !== null &&
        log.weather_temp_max !== undefined;
    const temps = hasTemps
        ? `<span class="day-card-temps" aria-label="최고 최저 기온">
            <span class="temp-high">${Math.round(log.weather_temp_max)}°</span>
            <span class="temp-sep">/</span>
            <span class="temp-low">${Math.round(log.weather_temp_min)}°</span>
           </span>`
        : '';
    return `
        <span class="day-card-weather-inline">
            ${getWeatherIconSVG(log.weather || 'cloudy', 18)}
            ${temps}
            ${fit}
        </span>`;
}

function dayCardActionsHtml(log) {
    return `<div class="day-card-actions">${dayListFavoriteToggleHtml(log.is_favorite)}</div>`;
}

/** 사진 카드: 코디 위 우측 플로팅 */
function dayCardOverlayActionsHtml(log) {
    return `<div class="day-card-overlay-actions">${dayCardActionsHtml(log)}</div>`;
}

/** 날짜 + 날씨 한 줄 (메모 카드 상단·사진 카드 하단) */
function dayCardSummaryHtml(date, log, options = {}) {
    const { actions = false, logForActions = null } = options;
    const actionsBlock =
        actions && logForActions ? dayCardActionsHtml(logForActions) : '';
    return `
        <div class="day-card-summary">
            <div class="day-card-summary-top">
                <span class="day-card-date-label sl-date">${dayCardDateLabel(date)}${dayCardLogKindBadgeHtml(log)}</span>
                ${dayCardWeatherInlineHtml(log)}
                ${actionsBlock}
            </div>
            ${dayCardTpoLineHtml(log)}
        </div>`;
}

/** photo: 제목만 · memo: 제목·메모(2줄 clamp는 CSS) */
function dayCardNoteHtml(titleRaw, bodyHtml, variant) {
    const hasTitle = Boolean(String(titleRaw || '').trim());
    const hasBody = Boolean(bodyHtml);
    if (variant === 'photo') {
        if (!hasTitle) return '';
        return `<div class="day-card-note"><span class="day-card-note-title">${escapeHtmlForDayCard(titleRaw)}</span></div>`;
    }
    if (!hasTitle && !hasBody) return '';
    const titlePart = hasTitle
        ? `<span class="day-card-note-title">${escapeHtmlForDayCard(titleRaw)}</span>`
        : '';
    const bodyPart = hasBody ? `<span class="day-card-note-body">${bodyHtml}</span>` : '';
    const inner = [titlePart, bodyPart].filter(Boolean).join('');
    if (!inner) return '';
    return `<div class="day-card-note">${inner}</div>`;
}

function syncFavoriteToggleBtnUI(btn, isFavorite) {
    if (!btn) return;
    const fav = !!isFavorite;
    btn.classList.toggle('active', fav);
    btn.setAttribute('data-is-favorite', fav.toString());
    btn.setAttribute('title', fav ? '즐겨찾기 해제' : '즐겨찾기 추가');
    const svg = btn.querySelector('svg');
    if (svg) {
        svg.setAttribute('fill', fav ? 'var(--color-favorite)' : 'none');
        svg.setAttribute('stroke', fav ? 'var(--color-favorite)' : 'var(--color-icon-default)');
    }
}

/** 홈 리스트 썸네일 — 목록 쿼리는 thumb_url 만 (photos 컬럼 제외로 페이로드·타임아웃 방지) */
function pickHomeListThumbRaw(log) {
    return String(log.thumb_url || '').trim();
}

function createDayItemForHome(log) {
    const date = parseStyleLogDate(log.date) || new Date(log.date);

    const dayItem = document.createElement('div');
    dayItem.className = 'day-item';

    const titleRaw = String(log.title || '').trim();
    const bodyHtml = log.content ? escapeHtmlForDayCard(String(log.content).trim()) : '';

    const thumbRaw = pickHomeListThumbRaw(log);
    if (thumbRaw) {
        dayItem.classList.add('day-item--photo');
        const noteBlock = dayCardNoteHtml(titleRaw, bodyHtml, 'photo');
        const thumbSrc =
            typeof safeStyleLogMediaUrl === 'function'
                ? safeStyleLogMediaUrl(thumbRaw)
                : thumbRaw;
        dayItem.innerHTML = `
            <div class="day-card-hero day-content photo">
                <img alt="착장" loading="lazy" decoding="async">
                ${dayCardOverlayActionsHtml(log)}
            </div>
            ${dayCardSummaryHtml(date, log)}
            ${noteBlock}
        `;
        const imgEl = dayItem.querySelector('.day-card-hero img');
        if (imgEl && thumbSrc) {
            imgEl.src = thumbSrc;
            imgEl.onerror = () => {
                imgEl.removeAttribute('src');
                imgEl.hidden = true;
            };
        } else if (imgEl) {
            imgEl.hidden = true;
        }
    } else {
        dayItem.classList.add('day-item--memo');
        dayItem.innerHTML = `
            ${dayCardSummaryHtml(date, log, { actions: true, logForActions: log })}
            ${dayCardNoteHtml(titleRaw, bodyHtml, 'memo')}
        `;
    }
    
    if (!log.id) return dayItem;
    
    dayItem.dataset.logId = log.id;
    dayItem.dataset.date = log.date;
    
    // 즐겨찾기 버튼 찾아서 data 속성 설정
    const favoriteBtn = dayItem.querySelector('.favorite-toggle-btn');
    if (favoriteBtn) {
        favoriteBtn.setAttribute('data-log-id', log.id);
        favoriteBtn.setAttribute('data-is-favorite', log.is_favorite ? 'true' : 'false');
    }
    
    return dayItem;
}

/**
 * 연·월 스티키 레이블과 day-item 을 fragment 에 추가합니다.
 * @param {{ previousYear: number|null, previousMonth: number|null }} continuation
 */
function appendDayListChunksToFragment(fragment, logs, continuation) {
    let previousYear = continuation.previousYear;
    let previousMonth = continuation.previousMonth;
    logs.forEach((log) => {
        const date = new Date(log.date);
        const currentYear = date.getFullYear();
        const currentMonth = date.getMonth() + 1;

        if (previousYear !== currentYear) {
            const yearLabel = document.createElement('div');
            yearLabel.className = 'year-label-day-view';
            yearLabel.textContent = `${currentYear}년`;
            fragment.appendChild(yearLabel);
            previousYear = currentYear;
            previousMonth = null;
        }

        if (previousMonth !== currentMonth) {
            const monthLabel = document.createElement('div');
            monthLabel.className = 'month-label-day-view';
            monthLabel.textContent = `${currentMonth}월`;
            fragment.appendChild(monthLabel);
            previousMonth = currentMonth;
        }

        fragment.appendChild(createDayItemForHome(log));
    });
    continuation.previousYear = previousYear;
    continuation.previousMonth = previousMonth;
}

// 일별 리스트 이벤트 위임 (단일 리스너로 모든 day-item 처리)
let dayListDelegationAttached = false;

function attachDayListEventListeners() {
    const container = getDayListContainer();
    if (!container || dayListDelegationAttached) return;
    dayListDelegationAttached = true;
    
    container.addEventListener('click', async function handleDayListClick(e) {
        const dayItem = e.target.closest('.day-item');
        if (!dayItem) return;
        
        // 즐겨찾기 버튼
        const favBtn = e.target.closest('.favorite-toggle-btn');
        if (favBtn) {
            e.stopPropagation();
            const logId = favBtn.getAttribute('data-log-id');
            const isFavorite = favBtn.getAttribute('data-is-favorite') === 'true';
            if (!logId) return;
            /* 인스타그램 스타일: 탭 즉시 애니메이션 + 낙관적 UI 업데이트 */
            favBtn.classList.add('heart-pop');
            favBtn.addEventListener('animationend', function removePop() {
                favBtn.classList.remove('heart-pop');
                favBtn.removeEventListener('animationend', removePop);
            }, { once: true });
            const newFavorite = !isFavorite;
            syncFavoriteToggleBtnUI(favBtn, newFavorite);
            try {
                await StyleLogAPI.update(logId, { is_favorite: newFavorite });
                const cached = allLoadedLogs.find((l) => String(l.id) === String(logId));
                if (cached) cached.is_favorite = newFavorite;
            } catch (err) {
                syncFavoriteToggleBtnUI(favBtn, isFavorite);
                showAlert('즐겨찾기 변경에 실패했습니다.');
            }
            return;
        }
        
        // day-item 클릭 (상세로 이동) - 즐겨찾기 제외
        if (e.target.closest('.menu-popup')) return;
        const logId = dayItem.dataset.logId;
        if (logId) {
            sessionStorage.setItem('homeScrollY', String(window.scrollY || document.documentElement.scrollTop));
            sessionStorage.setItem(HOME_RETURN_LOG_KEY, String(logId));
            sessionStorage.setItem('detailFrom', 'home');
            sessionStorage.setItem(DETAIL_PIN_TOP_KEY, '1');
            saveHomeFilterStateForDetailReturn();
            window.location.href = `detail.html?id=${encodeURIComponent(logId)}`;
        }
    });
}

/** 홈 목록 필터 (전역 상태·모달 미리보기 state 공통) */
function logPassesHomeFilters(log, c) {
    const years = c.years ?? [];
    const months = c.months ?? [];
    const weatherFit = c.weatherFit ?? [];
    const low = c.low ?? TEMP_FILTER_MIN;
    const high = c.high ?? TEMP_FILTER_MAX;
    const favOnly = !!c.favOnly;
    const outfitKeys = c.outfitKeys ?? [];
    const tpo = c.tpo ?? [];
    if (isLegacyReferenceLog(log)) return false;

    const isFullRange = low <= TEMP_FILTER_MIN && high >= TEMP_FILTER_MAX;
    if (!isFullRange) {
        if (log.weather_temp_min == null || log.weather_temp_max == null) return false;
        if (log.weather_temp_min < low || log.weather_temp_max > high) return false;
    }
    if (years.length > 0) {
        const y = new Date(log.date).getFullYear();
        if (!years.includes(y)) return false;
    }
    if (months.length > 0) {
        const m = new Date(log.date).getMonth() + 1;
        if (!months.includes(m)) return false;
    }
    if (weatherFit.length > 0) {
        const fit = log.weather_fit || 'good';
        if (!weatherFit.includes(fit)) return false;
    }
    if (tpo.length > 0) {
        const want = typeof normalizeTpoValues === 'function' ? normalizeTpoValues(tpo) : tpo;
        const have = new Set(typeof normalizeTpoValues === 'function' ? normalizeTpoValues(log.tpo) : []);
        if (want.length > 0 && !want.some((value) => have.has(value))) return false;
    }
    if (favOnly && !log.is_favorite) return false;
    const outfitMatchAll = !!c.outfitMatchAll;
    return logPassesOutfitFilterKeys(log, outfitKeys, outfitMatchAll);
}

// 날씨 필터: 해당 날의 최저 ≥ low 이고 최고 ≤ high 인 기록만
function passesWeatherFilter(log) {
    return logPassesHomeFilters(log, {
        years: filterYears,
        months: filterMonths,
        weatherFit: filterWeatherFit,
        low: weatherFilterLow,
        high: weatherFilterHigh,
        favOnly: filterFavoritesOnly,
        outfitKeys: filterOutfitSelectionKeys,
        outfitMatchAll: filterOutfitMatchAll,
        tpo: filterTpo
    });
}

// 필터 적용된 로그 목록
function getFilteredLogs() {
    return allLoadedLogs.filter(passesWeatherFilter);
}

function isHomeListFiltered() {
    return getActiveFilterChips().length > 0;
}

function isRecommendPrimaryListMode() {
    if (!recommendationModeEnabled) return false;
    return (
        filterYears.length === 0 &&
        filterMonths.length === 0 &&
        filterWeatherFit.length === 0 &&
        filterTpo.length === 0 &&
        filterOutfitSelectionKeys.length === 0 &&
        !filterFavoritesOnly
    );
}

function prepareLogsForHomeList(logs) {
    if (!isRecommendPrimaryListMode() || !globalThis.StyleLogRecommendation) return logs;
    return globalThis.StyleLogRecommendation.sortLogsForRecommendMode(logs, cachedTodayWeatherState);
}

function renderHomeRecommendCombos(filteredLogs) {
    const section = document.getElementById('homeRecommendCombos');
    const listEl = document.getElementById('homeRecommendCombosList');
    if (!section || !listEl) return;
    const rec = globalThis.StyleLogRecommendation;
    const combosApi = globalThis.StyleLogOutfitCombinations;
    if (!isRecommendPrimaryListMode() || !rec || !combosApi) {
        section.hidden = true;
        listEl.innerHTML = '';
        return;
    }
    const rows = rec.topComboSuggestions(filteredLogs, 3);
    if (!rows.length) {
        section.hidden = true;
        listEl.innerHTML = '';
        return;
    }
    section.hidden = false;
    listEl.innerHTML = '';
    rows.forEach((row) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'home-recommend-combo-row';
        const label =
            typeof escapeHtml === 'function' ? escapeHtml(row.label) : String(row.label);
        btn.innerHTML = `<span class="home-recommend-combo-label">${label}</span><span class="home-recommend-combo-count">${row.count}<span>회</span></span>`;
        btn.addEventListener('click', () => {
            window.location.href = combosApi.homeUrlForCombination(row.keys);
        });
        listEl.appendChild(btn);
    });
}

function appendRecommendSectionLabel(fragment, text) {
    const el = document.createElement('div');
    el.className = 'home-recommend-section-label';
    el.setAttribute('role', 'heading');
    el.setAttribute('aria-level', '3');
    el.textContent = text;
    fragment.appendChild(el);
}

function buildHomeFirstEmptyHtml() {
    return `
                    <div class="util-empty">
                        <p>아직 코디 기록이 없어요</p>
                        <p class="util-sub">사진·메모로 하루를 남겨 보세요.</p>
                        <p class="util-sub util-sub--spaced">쌓이면 날씨·기온으로 다시 찾을 수 있어요.</p>
                        <button type="button" class="util-btn-primary" onclick="window.location.href='write.html'">첫 코디 기록하기</button>
                    </div>`;
}

function buildHomeFilteredEmptyHtml() {
    let title = '조건에 맞는 코디가 없어요';
    let subs = ['필터를 바꿔 보세요.', '또는 「초기화」를 눌러 보세요.'];
    const favOnly =
        filterFavoritesOnly &&
        filterYears.length === 0 &&
        filterMonths.length === 0 &&
        filterWeatherFit.length === 0 &&
        filterTpo.length === 0 &&
        filterOutfitSelectionKeys.length === 0 &&
        weatherFilterLow <= TEMP_FILTER_MIN &&
        weatherFilterHigh >= TEMP_FILTER_MAX &&
        !recommendationModeEnabled;

    if (favOnly) {
        title = '즐겨찾기한 코디가 없어요';
        subs = ['마음에 드는 코디에 ♡를 눌러', '즐겨찾기로 모아 보세요.'];
    } else if (recommendationModeEnabled) {
        title = '오늘 기온과 맞는 코디가 없어요';
        subs = ['비슷한 날씨 코디를 남기면', '다음에 여기에 보여요.'];
    }

    const subsHtml = subs
        .map((line, i) => {
            const last = i === subs.length - 1;
            return `<p class="util-sub${last ? ' util-sub--spaced' : ''}">${line}</p>`;
        })
        .join('');

    const resetBtn = isHomeListFiltered()
        ? `<button type="button" class="util-btn-secondary" id="homeEmptyResetBtn">필터 초기화</button>`
        : '';
    const writeBtn = favOnly
        ? `<button type="button" class="util-btn-primary" onclick="window.location.href='write.html'">코디 기록하기</button>`
        : '';

    return `
        <div class="util-empty">
            <p>${title}</p>
            ${subsHtml}
            ${resetBtn}
            ${writeBtn}
        </div>`;
}

function bindHomeEmptyStateActions(container) {
    container?.querySelector('#homeEmptyResetBtn')?.addEventListener('click', () => {
        if (typeof window.__stylelogHomeResetFilters === 'function') {
            window.__stylelogHomeResetFilters();
        }
    });
}

// 적용된 필터 chip 목록 (표시용)
function getActiveFilterChips() {
    const chips = [];
    if (recommendationModeEnabled) {
        chips.push({ key: 'recommend', label: '오늘 기온 맞춤', value: 'recommend' });
    }
    if (filterYears.length > 0) {
        const sorted = [...filterYears].sort((a, b) => b - a);
        chips.push({ key: 'year', label: sorted.map(y => `${y}년`).join(', '), value: 'year' });
    }
    if (filterMonths.length > 0) {
        const sorted = [...filterMonths].sort((a, b) => a - b);
        chips.push({ key: 'months', label: sorted.map(m => `${m}월`).join(', '), value: 'months' });
    }
    if (filterWeatherFit.length > 0) {
        const labels = filterWeatherFit.map(v => WEATHER_FIT_LABELS[v]).filter(Boolean);
        chips.push({ key: 'weatherFit', label: labels.join(', '), value: 'weatherFit' });
    }
    const tpoValues = typeof normalizeTpoValues === 'function' ? normalizeTpoValues(filterTpo) : filterTpo;
    if (tpoValues.length > 0) {
        const labels = tpoValues.map((value) => (typeof TPO_LABELS !== 'undefined' && TPO_LABELS[value]) || value);
        chips.push({ key: 'tpo', label: labels.join(', '), value: 'tpo' });
    }
    const isFullRange = weatherFilterLow <= TEMP_FILTER_MIN && weatherFilterHigh >= TEMP_FILTER_MAX;
    if (!recommendationModeEnabled && !isFullRange) {
        chips.push({ key: 'temp', label: `${weatherFilterLow}°~${weatherFilterHigh}°`, value: 'temp' });
    }
    if (filterOutfitSelectionKeys.length > 0 && homeListSelectIncludesItems) {
        const s = summarizeOutfitFilterKeysForChip(filterOutfitSelectionKeys, filterOutfitMatchAll);
        chips.push({
            key: 'outfit',
            label: s.label,
            title: s.title,
            value: 'outfit'
        });
    }
    if (filterFavoritesOnly) chips.push({ key: 'fav', label: '즐겨찾기만', value: 'fav' });
    if (homeListSelectIncludesLogKind && filterLogKind && filterLogKind !== 'my_outfit') {
        const lkLabel =
            filterLogKind === 'all'
                ? '종류 · 전체'
                : typeof logKindLabel === 'function'
                  ? `종류 · ${logKindLabel(filterLogKind)}`
                  : `종류 · ${filterLogKind}`;
        chips.push({ key: 'logKind', label: lkLabel, value: 'logKind' });
    }
    if (filterScrapGroup) {
        chips.push({
            key: 'scrapGroup',
            label: `스크랩 · ${filterScrapGroup}`,
            title: filterScrapGroup,
            value: 'scrapGroup'
        });
    }
    return chips;
}

// 전체 리스트 클리어 후 재렌더링 (필터 변경 시, DocumentFragment 사용)
function renderFullDayList(logs) {
    const container = getDayListContainer();
    if (!container) return;
    
    container.innerHTML = '';
    
    if (logs.length === 0) {
        container.innerHTML =
            allLoadedLogs.length === 0 ? buildHomeFirstEmptyHtml() : buildHomeFilteredEmptyHtml();
        bindHomeEmptyStateActions(container);
        attachDayListEventListeners();
        return;
    }
    
    const fragment = document.createDocumentFragment();
    const continuation = { previousYear: null, previousMonth: null };
    const displayLogs = prepareLogsForHomeList(logs);
    const rec = globalThis.StyleLogRecommendation;
    const useWeatherSections =
        isRecommendPrimaryListMode() &&
        rec &&
        cachedTodayWeatherState &&
        displayLogs.length > 1;
    if (useWeatherSections) {
        const { stateBlock, tempOnlyBlock } = rec.splitLogsByWeatherState(
            displayLogs,
            cachedTodayWeatherState
        );
        if (stateBlock.length && tempOnlyBlock.length) {
            appendRecommendSectionLabel(fragment, '날씨도 비슷했던 코디');
            appendDayListChunksToFragment(fragment, stateBlock, continuation);
            appendRecommendSectionLabel(fragment, '기온만 맞는 코디');
            appendDayListChunksToFragment(fragment, tempOnlyBlock, continuation);
        } else {
            appendDayListChunksToFragment(fragment, displayLogs, continuation);
        }
    } else {
        appendDayListChunksToFragment(fragment, displayLogs, continuation);
    }

    container.appendChild(fragment);
    attachDayListEventListeners();
    if (container.classList.contains('day-list-view')) initInfiniteScroll();
}

// 필터 모달 초기화
function initFilterModal() {
    syncHomeContextFilterVisibility();
    syncHomeLogKindFilterVisibility();
    const modal = document.getElementById('filterModal');
    const closeBtn = document.getElementById('filterModalClose');
    const overlay = modal?.querySelector('.filter-modal-overlay');
    const applyBtn = document.getElementById('filterApplyBtn');
    const resetAllBtn = document.getElementById('filterResetAllBtn');
    const filterOpenBtn = document.getElementById('filterOpenBtn');
    const sliderLow = document.getElementById('filterSliderLow');
    const sliderHigh = document.getElementById('filterSliderHigh');
    const valueLow = document.getElementById('filterValueLow');
    const valueHigh = document.getElementById('filterValueHigh');
    const trackWrap = document.getElementById('filterTempTrackWrap');
    const trackOverlay = document.getElementById('filterTempTrackOverlay');

    function valueFromClientX(clientX) {
        if (!trackWrap) return TEMP_FILTER_MIN;
        const rect = trackWrap.getBoundingClientRect();
        const percent = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
        return Math.round(TEMP_FILTER_MIN + (percent / 100) * (TEMP_FILTER_MAX - TEMP_FILTER_MIN));
    }

    function whichThumbFromPercent(percent) {
        const low = parseInt(sliderLow?.value ?? TEMP_FILTER_MIN);
        const high = parseInt(sliderHigh?.value ?? TEMP_FILTER_MAX);
        const lowPercent = ((low - TEMP_FILTER_MIN) / (TEMP_FILTER_MAX - TEMP_FILTER_MIN)) * 100;
        const highPercent = ((high - TEMP_FILTER_MIN) / (TEMP_FILTER_MAX - TEMP_FILTER_MIN)) * 100;
        const distLow = Math.abs(percent - lowPercent);
        const distHigh = Math.abs(percent - highPercent);
        return distLow <= distHigh ? 'low' : 'high';
    }

    let activeTempThumb = null;

    const todayBtn = document.getElementById('filterTempTodayBtn');

    function clearTodayBtnActive() {
        todayBtn?.classList.remove('active');
    }

    function applyTempSliderChange(which, val, skipChipsUpdate = false, fromUserInteraction = false) {
        if (fromUserInteraction) clearTodayBtnActive();
        const low = parseInt(sliderLow?.value ?? TEMP_FILTER_MIN);
        const high = parseInt(sliderHigh?.value ?? TEMP_FILTER_MAX);
        if (which === 'low') {
            if (val > high) {
                val = high;
                showTempToast('최저 기온은 최고 기온(' + high + '°)보다 높을 수 없어요.');
            }
            if (sliderLow) sliderLow.value = val;
            if (valueLow) valueLow.textContent = `${val}° 이상`;
        } else {
            if (val < low) {
                val = low;
                showTempToast('최고 기온은 최저 기온(' + low + '°)보다 낮을 수 없어요.');
            }
            if (sliderHigh) sliderHigh.value = val;
            if (valueHigh) valueHigh.textContent = `${val}° 이하`;
        }
        updateFilterTempLabelPositions();
        if (!skipChipsUpdate) updateModalChipsFromUI();
        if (fromUserInteraction) checkModalTempSlidersAgainstToday();
    }

    function updateFilterTempLabelPositions() {
        const low = parseInt(sliderLow?.value ?? TEMP_FILTER_MIN);
        const high = parseInt(sliderHigh?.value ?? TEMP_FILTER_MAX);
        const lowPercent = ((low - TEMP_FILTER_MIN) / (TEMP_FILTER_MAX - TEMP_FILTER_MIN)) * 100;
        const highPercent = ((high - TEMP_FILTER_MIN) / (TEMP_FILTER_MAX - TEMP_FILTER_MIN)) * 100;
        if (valueLow) valueLow.style.setProperty('--pos-percent', lowPercent + '%');
        if (valueHigh) valueHigh.style.setProperty('--pos-percent', highPercent + '%');
    }
    const yearOptions = document.getElementById('filterYearOptions');
    const monthOptions = document.getElementById('filterMonthOptions');
    const activeChipsEl = document.getElementById('filterActiveChips');
    const tabs = modal?.querySelectorAll('.filter-tab');
    const panels = modal?.querySelectorAll('.filter-tab-panel');
    const categoryChips = document.querySelectorAll('.filter-category-chip');

    function switchTab(tabId) {
        const panelId = HOME_FILTER_PANEL_ID_BY_TAB[tabId];
        tabs?.forEach((t) => {
            t.classList.toggle('active', t.dataset.tab === tabId);
        });
        panels?.forEach((p) => {
            p.classList.toggle('active', panelId != null && p.id === panelId);
        });
        if (tabId === 'temp') {
            requestAnimationFrame(() => updateFilterTempLabelPositions());
        }
    }

    function openModal(activeTab = 'year') {
        modal?.classList.add('active');
        document.body.style.overflow = 'hidden';
        syncModalFromState();
        renderYearOptions();
        renderMonthOptions();
        switchTab(activeTab);
        updateModalChipsFromUI();
        requestAnimationFrame(() => refreshAllFilterFades());
    }

    function getFilterStateFromModalUI() {
        const years = [];
        document.querySelectorAll('#filterYearOptions input[type="checkbox"]:checked').forEach(cb => {
            const v = parseInt(cb.value);
            if (!isNaN(v)) years.push(v);
        });
        const months = [];
        document.querySelectorAll('#filterMonthOptions input:checked').forEach(cb => {
            const v = parseInt(cb.value);
            if (!isNaN(v)) months.push(v);
        });
        const weatherFit = [];
        document.querySelectorAll('#filterWeatherFitOptions input:checked').forEach(cb => {
            weatherFit.push(cb.value);
        });
        const tpo = [];
        document.querySelectorAll('#filterTpoOptions input:checked').forEach((cb) => {
            tpo.push(cb.value);
        });
        const low = parseInt(sliderLow?.value ?? TEMP_FILTER_MIN);
        const high = parseInt(sliderHigh?.value ?? TEMP_FILTER_MAX);
        const favChecked = document.querySelector('input[name="filterFavorites"]:checked');
        const favOnly = favChecked?.value === 'only';
        const outfitKeys = [];
        document.querySelectorAll('#filterOutfitOptions input[name="filterOutfitPair"]:checked').forEach((cb) => {
            if (cb.value) outfitKeys.push(cb.value);
        });
        const logKindRadio = document.querySelector('input[name="filterLogKind"]:checked');
        const logKind = logKindRadio?.value || 'my_outfit';
        return { years, months, weatherFit, low, high, favOnly, outfitKeys, tpo, logKind };
    }

    function passesFilterWithState(log, state) {
        return logPassesHomeFilters(log, {
            years: state.years,
            months: state.months,
            weatherFit: state.weatherFit,
            low: state.low,
            high: state.high,
            favOnly: state.favOnly,
            outfitKeys: state.outfitKeys ?? [],
            tpo: state.tpo ?? [],
            logKind: state.logKind ?? filterLogKind,
            scrapGroup: filterScrapGroup
        });
    }

    function getFilteredCountFromModalUI() {
        const state = getFilterStateFromModalUI();
        return allLoadedLogs.filter(log => passesFilterWithState(log, state)).length;
    }

    let _applyCountLoadAbort = null;
    let _applyCountDebounce = null;
    async function updateApplyButtonCount() {
        if (!applyBtn) return;
        const state = getFilterStateFromModalUI();
        const hasSelection = state.years.length > 0 || state.months.length > 0 || state.weatherFit.length > 0 ||
            state.low > TEMP_FILTER_MIN || state.high < TEMP_FILTER_MAX || state.favOnly ||
            (state.outfitKeys && state.outfitKeys.length > 0) ||
            (state.tpo && state.tpo.length > 0) ||
            (homeListSelectIncludesLogKind &&
                state.logKind &&
                state.logKind !== 'my_outfit') ||
            !!filterScrapGroup;

        const setApplyReady = (label) => {
            applyBtn.disabled = false;
            applyBtn.classList.remove('is-pending');
            applyBtn.removeAttribute('aria-busy');
            applyBtn.textContent = label;
        };
        const setApplyPending = () => {
            applyBtn.disabled = true;
            applyBtn.classList.add('is-pending');
            applyBtn.setAttribute('aria-busy', 'true');
            applyBtn.textContent = '세는 중';
        };

        if (!hasSelection) {
            clearTimeout(_applyCountDebounce);
            setApplyReady('적용하기');
            return;
        }

        const doUpdate = async () => {
            if (hasMoreData && !isLoading) {
                setApplyPending();
                if (_applyCountLoadAbort) _applyCountLoadAbort.abort = true;
                _applyCountLoadAbort = { abort: false };
                const token = _applyCountLoadAbort;
                try {
                    const BATCH_FOR_COUNT = 200;
                    while (hasMoreData && !token.abort) await loadMoreDayList(BATCH_FOR_COUNT, true);
                } catch (e) { /* ignore */ }
                if (token.abort) return;
            }
            const count = getFilteredCountFromModalUI();
            setApplyReady(`${count}개 보기`);
        };
        setApplyPending();

        clearTimeout(_applyCountDebounce);
        _applyCountDebounce = setTimeout(doUpdate, 150);
    }

    function getChipsFromModalUI() {
        const chips = [];
        const yearChecked = document.querySelectorAll('#filterYearOptions input[type="checkbox"]:checked');
        if (yearChecked.length > 0) {
            const years = Array.from(yearChecked).map(cb => parseInt(cb.value)).filter(n => !isNaN(n)).sort((a, b) => b - a);
            if (years.length) chips.push({ key: 'year', label: years.map(y => `${y}년`).join(', '), value: 'year' });
        }
        const monthChecked = document.querySelectorAll('#filterMonthOptions input:checked');
        if (monthChecked.length > 0) {
            const months = Array.from(monthChecked).map(cb => parseInt(cb.value)).filter(n => !isNaN(n)).sort((a, b) => a - b);
            if (months.length) chips.push({ key: 'months', label: months.map(m => `${m}월`).join(', '), value: 'months' });
        }
        const weatherFitChecked = document.querySelectorAll('#filterWeatherFitOptions input:checked');
        if (weatherFitChecked.length > 0) {
            const vals = Array.from(weatherFitChecked).map(cb => cb.value);
            const labels = vals.map(
                (v) => (typeof WEATHER_FIT_LABELS !== 'undefined' && WEATHER_FIT_LABELS[v]) || v
            );
            chips.push({ key: 'weatherFit', label: labels.join(', '), value: 'weatherFit' });
        }
        const tpoChecked = document.querySelectorAll('#filterTpoOptions input:checked');
        if (tpoChecked.length > 0) {
            const labels = Array.from(tpoChecked).map(
                (cb) => (typeof TPO_LABELS !== 'undefined' && TPO_LABELS[cb.value]) || cb.value
            );
            chips.push({ key: 'tpo', label: labels.join(', '), value: 'tpo' });
        }
        const low = parseInt(sliderLow?.value ?? TEMP_FILTER_MIN), high = parseInt(sliderHigh?.value ?? TEMP_FILTER_MAX);
        if (low > TEMP_FILTER_MIN || high < TEMP_FILTER_MAX) chips.push({ key: 'temp', label: `${low}°~${high}°`, value: 'temp' });
        const favChecked = document.querySelector('input[name="filterFavorites"]:checked');
        if (favChecked?.value === 'only') chips.push({ key: 'fav', label: '즐겨찾기만', value: 'fav' });
        const outfitChecked = document.querySelectorAll('#filterOutfitOptions input[name="filterOutfitPair"]:checked');
        if (outfitChecked.length > 0 && homeListSelectIncludesItems) {
            const keysList = Array.from(outfitChecked).map((cb) => cb.value).filter(Boolean);
            const s = summarizeOutfitFilterKeysForChip(keysList);
            chips.push({ key: 'outfit', label: s.label, title: s.title, value: 'outfit' });
        }
        const logKindChecked = document.querySelector('input[name="filterLogKind"]:checked');
        if (homeListSelectIncludesLogKind && logKindChecked && logKindChecked.value !== 'my_outfit') {
            const v = logKindChecked.value;
            const label =
                v === 'all'
                    ? '종류 · 전체'
                    : typeof logKindLabel === 'function'
                      ? `종류 · ${logKindLabel(v)}`
                      : `종류 · ${v}`;
            chips.push({ key: 'logKind', label, value: 'logKind' });
        }
        if (filterScrapGroup) {
            chips.push({
                key: 'scrapGroup',
                label: `스크랩 · ${filterScrapGroup}`,
                title: filterScrapGroup,
                value: 'scrapGroup'
            });
        }
        return chips;
    }

    function updateModalChipsFromUI() {
        if (!modalActiveChipsEl) return;
        const chips = getChipsFromModalUI();
        filterModalEl?.classList.toggle('has-selection', chips.length > 0);
        updateApplyButtonCount();
        const chipsHTML = chips.map(c => buildHomeFilterActiveChipHtml(c)).join('');
        modalActiveChipsEl.innerHTML = chipsHTML;
        modalActiveChipsEl.querySelectorAll('.filter-active-chip, .filter-active-chip-remove').forEach(el => {
            el.addEventListener('click', (e) => {
            e.stopPropagation();
                const key = el.dataset.key || el.closest('.filter-active-chip')?.dataset.key;
                clearModalFilterByKey(key);
                updateModalChipsFromUI();
            });
        });
        requestAnimationFrame(() => refreshAllFilterFades());
    }

    function clearModalFilterByKey(key) {
        if (key === 'year') {
            document.querySelectorAll('#filterYearOptions input').forEach(cb => { cb.checked = false; });
        } else if (key === 'months') {
            document.querySelectorAll('#filterMonthOptions input').forEach(cb => { cb.checked = false; });
        } else if (key === 'weatherFit') {
            document.querySelectorAll('#filterWeatherFitOptions input').forEach(cb => { cb.checked = false; });
        } else if (key === 'tpo') {
            document.querySelectorAll('#filterTpoOptions input').forEach((cb) => { cb.checked = false; });
        } else if (key === 'temp') {
            if (sliderLow) sliderLow.value = TEMP_FILTER_MIN;
            if (sliderHigh) sliderHigh.value = TEMP_FILTER_MAX;
            if (valueLow) valueLow.textContent = `${TEMP_FILTER_MIN}° 이상`;
            if (valueHigh) valueHigh.textContent = `${TEMP_FILTER_MAX}° 이하`;
            updateFilterTempLabelPositions();
            checkModalTempSlidersAgainstToday();
        } else if (key === 'outfit') {
            document.querySelectorAll('#filterOutfitOptions input[name="filterOutfitPair"]').forEach((cb) => {
                cb.checked = false;
            });
        } else if (key === 'fav') {
            const allRadio = document.querySelector('input[name="filterFavorites"][value=""]');
            if (allRadio) allRadio.checked = true;
        } else if (key === 'logKind') {
            const def = document.querySelector('input[name="filterLogKind"][value="my_outfit"]');
            if (def) def.checked = true;
        } else if (key === 'scrapGroup') {
            filterScrapGroup = '';
            const urlClean = new URLSearchParams(location.search);
            urlClean.delete('scrapGroup');
            const qs = urlClean.toString();
            history.replaceState(null, '', `${location.pathname}${qs ? `?${qs}` : ''}${location.hash}`);
        }
    }

    function closeModal() {
        modal?.classList.remove('active');
        document.body.style.overflow = '';
    }

    function syncModalFromState() {
        if (sliderLow) sliderLow.value = weatherFilterLow;
        if (sliderHigh) sliderHigh.value = weatherFilterHigh;
        if (valueLow) valueLow.textContent = `${weatherFilterLow}° 이상`;
        if (valueHigh) valueHigh.textContent = `${weatherFilterHigh}° 이하`;
        updateFilterTempLabelPositions();
        clearTodayBtnActive();
        const yearChecks = document.querySelectorAll('#filterYearOptions input[type="checkbox"]');
        yearChecks.forEach(cb => { cb.checked = filterYears.includes(parseInt(cb.value)); });
        const monthChecks = document.querySelectorAll('#filterMonthOptions input');
        monthChecks.forEach(cb => { cb.checked = filterMonths.includes(parseInt(cb.value)); });
        document.querySelectorAll('#filterWeatherFitOptions input').forEach(cb => {
            cb.checked = filterWeatherFit.includes(cb.value);
        });
        document.querySelectorAll('#filterTpoOptions input').forEach((cb) => {
            cb.checked = filterTpo.includes(cb.value);
        });
        document.querySelectorAll('input[name="filterFavorites"]').forEach(r => {
            r.checked = (r.value === 'only' && filterFavoritesOnly) || (r.value === '' && !filterFavoritesOnly);
        });
        document.querySelectorAll('input[name="filterLogKind"]').forEach((r) => {
            r.checked = r.value === (filterLogKind || 'my_outfit');
        });
        refreshHomeOutfitFilterPanelUI(document.getElementById('filterOutfitOptions'));
    }

    function syncStateFromModal() {
        weatherFilterLow = parseInt(sliderLow?.value ?? TEMP_FILTER_MIN);
        weatherFilterHigh = parseInt(sliderHigh?.value ?? TEMP_FILTER_MAX);
        filterYears = [];
        document.querySelectorAll('#filterYearOptions input[type="checkbox"]:checked').forEach(cb => {
            if (cb.value !== '') filterYears.push(parseInt(cb.value));
        });
        filterMonths = [];
        document.querySelectorAll('#filterMonthOptions input:checked').forEach(cb => {
            filterMonths.push(parseInt(cb.value));
        });
        filterWeatherFit = [];
        document.querySelectorAll('#filterWeatherFitOptions input:checked').forEach(cb => {
            filterWeatherFit.push(cb.value);
        });
        filterTpo = [];
        document.querySelectorAll('#filterTpoOptions input:checked').forEach((cb) => {
            filterTpo.push(cb.value);
        });
        const favChecked = document.querySelector('input[name="filterFavorites"]:checked');
        filterFavoritesOnly = favChecked?.value === 'only';
        filterOutfitSelectionKeys = [];
        filterOutfitMatchAll = false;
        document.querySelectorAll('#filterOutfitOptions input[name="filterOutfitPair"]:checked').forEach((cb) => {
            if (cb.value) filterOutfitSelectionKeys.push(cb.value);
        });
        const logKindChecked = document.querySelector('input[name="filterLogKind"]:checked');
        filterLogKind = homeListSelectIncludesLogKind
            ? logKindChecked?.value || 'my_outfit'
            : 'all';
        persistLogKindFilter();
    }

    function renderYearOptions() {
        if (!yearOptions) return;
        yearOptions.innerHTML = '';
        const years = yearsWithData.length > 0 ? yearsWithData : [new Date().getFullYear()];
        years.forEach(year => {
            const label = document.createElement('label');
            label.className = 'filter-option';
            label.innerHTML = `<input type="checkbox" name="filterYear" value="${year}"><span>${year}년</span>`;
            yearOptions.appendChild(label);
        });
        syncModalFromState();
    }

    function renderMonthOptions() {
        if (!monthOptions) return;
        monthOptions.innerHTML = '';
        for (let m = 1; m <= 12; m++) {
            const label = document.createElement('label');
            label.className = 'filter-option';
            label.innerHTML = `<input type="checkbox" name="filterMonth" value="${m}"><span>${m}월</span>`;
            monthOptions.appendChild(label);
        }
        syncModalFromState();
    }

    const modalActiveChipsEl = document.getElementById('filterModalActiveChips');
    const filterBar = document.getElementById('filterBar');
    const filterModalEl = document.getElementById('filterModal');

    function renderActiveChips() {
        const chips = getActiveFilterChips();
        const chipsHTML = chips.map(c => buildHomeFilterActiveChipHtml(c)).join('');
        [activeChipsEl, modalActiveChipsEl].forEach(container => {
            if (!container) return;
            container.innerHTML = chipsHTML;
        });
        const hasFilters = isHomeListFiltered();
        filterBar?.classList.toggle('has-active-filters', hasFilters);
        filterModalEl?.classList.toggle('has-active-filters', hasFilters);
        filterOpenBtn?.classList.toggle('has-active', hasFilters);
        const activeKeys = chips.map(c => c.key);
        categoryChips?.forEach(chip => {
            const tab = chip.dataset.tab;
            const keyMap = {
                year: 'year',
                month: 'months',
                weatherFit: 'weatherFit',
                temp: 'temp',
                outfit: 'outfit',
                tpo: 'tpo',
                logKind: 'logKind',
                favorites: 'fav'
            };
            chip.classList.toggle('has-filter', keyMap[tab] && activeKeys.includes(keyMap[tab]));
        });
    }

    function removeFilterByKey(key) {
        if (key === 'recommend') {
            void setRecommendationMode(false);
            return;
        }
        if (key === 'year') filterYears = [];
        else if (key === 'months') filterMonths = [];
        else if (key === 'weatherFit') filterWeatherFit = [];
        else if (key === 'tpo') filterTpo = [];
        else if (key === 'temp') {
            weatherFilterLow = TEMP_FILTER_MIN;
            weatherFilterHigh = TEMP_FILTER_MAX;
            if (sliderLow) sliderLow.value = TEMP_FILTER_MIN;
            if (sliderHigh) sliderHigh.value = TEMP_FILTER_MAX;
        }
        else if (key === 'outfit') {
            filterOutfitSelectionKeys = [];
            filterOutfitMatchAll = false;
        }
        else if (key === 'fav') filterFavoritesOnly = false;
        else if (key === 'logKind') {
            filterLogKind = 'my_outfit';
            persistLogKindFilter();
        } else if (key === 'scrapGroup') {
            filterScrapGroup = '';
            const urlClean = new URLSearchParams(location.search);
            urlClean.delete('scrapGroup');
            const qs = urlClean.toString();
            history.replaceState(null, '', `${location.pathname}${qs ? `?${qs}` : ''}${location.hash}`);
        }
        syncModalFromState();
        renderActiveChips();
        clearRecommendIfAppliedTempNotToday(weatherFilterLow, weatherFilterHigh);
        applyFilterAndRender();
    }

    async function ensureAllDataLoadedForFilter(skipLoadingUI = false) {
        const hasFilters = getActiveFilterChips().length > 0;
        if (!hasFilters || !hasMoreData) return;
        const container = getDayListContainer();
        if (!container) return;
        let loadingEl = null;
        if (!skipLoadingUI && !container.querySelector('.util-filter-loading')) {
            loadingEl = document.createElement('div');
            loadingEl.id = 'filter-load-more-indicator';
            loadingEl.className = 'util-filter-loading';
            loadingEl.textContent = '기록을 모두 불러오는 중…';
            container.appendChild(loadingEl);
        }
        try {
            while (hasMoreData) {
                await loadMoreDayList();
            }
        } finally {
            loadingEl?.remove();
        }
    }

    function applyFilterAndRender() {
        const hasFilters = getActiveFilterChips().length > 0;
        if (hasFilters && hasMoreData) {
            /* 아직 더 로드할 데이터가 있음 - "없습니다" 말고 로딩 먼저 표시 후 판단 */
            const container = getDayListContainer();
            if (container) {
                container.innerHTML = '<div class="util-filter-loading">기록을 모두 불러오는 중…</div>';
            }
            ensureAllDataLoadedForFilter(true).then(() => {
                const updated = getFilteredLogs();
                renderFullDayList(updated);
                renderHomeRecommendCombos(updated);
                if (updated.length > 0 && !hasMoreData) showEndMessage();
            });
        } else {
            const filtered = getFilteredLogs();
            renderFullDayList(filtered);
            renderHomeRecommendCombos(filtered);
            if (filtered.length > 0 && !hasMoreData) showEndMessage();
        }
    }

    /** 모달에서 기온 슬라이더가 오늘 예보 구간과 달라지면 맞춤 토글 해제 + 목록 반영 */
    function checkModalTempSlidersAgainstToday() {
        const low = parseInt(sliderLow?.value ?? TEMP_FILTER_MIN, 10);
        const high = parseInt(sliderHigh?.value ?? TEMP_FILTER_MAX, 10);
        if (!recommendationModeEnabled) return;
        if (cachedTodayTempLow == null || cachedTodayTempHigh == null) return;
        if (tempsMatchCachedToday(low, high)) return;
        recommendationModeEnabled = false;
        localStorage.setItem(RECOMMEND_MODE_STORAGE_KEY, 'false');
        manualFilterSnapshot = null;
        syncWeatherRecommendToggleUI();
        weatherFilterLow = low;
        weatherFilterHigh = high;
        renderActiveChips();
        applyFilterAndRender();
    }

    function doApply() {
        if (applyBtn?.disabled) return;
        syncStateFromModal();
        clearRecommendIfAppliedTempNotToday(weatherFilterLow, weatherFilterHigh);
        closeModal();
        renderActiveChips();
        applyFilterAndRender();
    }

    function doResetModalOnly() {
        document.querySelectorAll('#filterYearOptions input').forEach(cb => { cb.checked = false; });
        document.querySelectorAll('#filterMonthOptions input').forEach(cb => { cb.checked = false; });
        document.querySelectorAll('#filterWeatherFitOptions input').forEach(cb => { cb.checked = false; });
        document.querySelectorAll('#filterTpoOptions input').forEach((cb) => { cb.checked = false; });
        if (sliderLow) sliderLow.value = TEMP_FILTER_MIN;
        if (sliderHigh) sliderHigh.value = TEMP_FILTER_MAX;
        if (valueLow) valueLow.textContent = `${TEMP_FILTER_MIN}° 이상`;
        if (valueHigh) valueHigh.textContent = `${TEMP_FILTER_MAX}° 이하`;
        updateFilterTempLabelPositions();
        const allRadio = document.querySelector('input[name="filterFavorites"][value=""]');
        if (allRadio) allRadio.checked = true;
        document.querySelectorAll('#filterOutfitOptions input[name="filterOutfitPair"]').forEach((cb) => {
            cb.checked = false;
        });
        const defKind = document.querySelector('input[name="filterLogKind"][value="my_outfit"]');
        if (defKind) defKind.checked = true;
        updateModalChipsFromUI();
        checkModalTempSlidersAgainstToday();
    }

    function doReset() {
        recommendationModeEnabled = false;
        localStorage.setItem(RECOMMEND_MODE_STORAGE_KEY, 'false');
        manualFilterSnapshot = null;
        syncWeatherRecommendToggleUI();
        filterYears = [];
        filterMonths = [];
        filterWeatherFit = [];
        filterTpo = [];
        weatherFilterLow = TEMP_FILTER_MIN;
        weatherFilterHigh = TEMP_FILTER_MAX;
        filterFavoritesOnly = false;
        filterOutfitSelectionKeys = [];
        filterOutfitMatchAll = false;
        if (homeListSelectIncludesLogKind) {
            filterLogKind = 'my_outfit';
            filterScrapGroup = '';
            persistLogKindFilter();
        }
        if (sliderLow) sliderLow.value = TEMP_FILTER_MIN;
        if (sliderHigh) sliderHigh.value = TEMP_FILTER_MAX;
        syncModalFromState();
        renderActiveChips();
        applyFilterAndRender();
        closeModal();
        const urlAfterReset = new URLSearchParams(location.search);
        if (
            urlAfterReset.get('filter') === 'fav' ||
            urlAfterReset.get('outfitCat') ||
            urlAfterReset.get('outfitKeys') ||
            urlAfterReset.get('scrapGroup')
        ) {
            urlAfterReset.delete('filter');
            urlAfterReset.delete('outfitCat');
            urlAfterReset.delete('outfitVal');
            urlAfterReset.delete('outfitMatch');
            urlAfterReset.delete('outfitKeys');
            urlAfterReset.delete('scrapGroup');
            const qs = urlAfterReset.toString();
            const next = `${location.pathname}${qs ? `?${qs}` : ''}${location.hash}`;
            history.replaceState(null, '', next);
        }
    }

    window.__stylelogHomeResetFilters = doReset;

    filterOpenBtn?.addEventListener('click', () => openModal('year'));
    categoryChips?.forEach(chip => {
        chip.addEventListener('click', () => openModal(chip.dataset.tab || 'year'));
    });
    tabs?.forEach(tabBtn => {
        tabBtn.addEventListener('click', () => switchTab(tabBtn.dataset.tab));
    });
    closeBtn?.addEventListener('click', closeModal);
    overlay?.addEventListener('click', closeModal);
    applyBtn?.addEventListener('click', doApply);
    resetAllBtn?.addEventListener('click', doReset);
    document.getElementById('filterModalResetBtn')?.addEventListener('click', doResetModalOnly);
    document.getElementById('filterBarResetBtn')?.addEventListener('click', doReset);

    document.querySelector('.filter-list-section')?.addEventListener('click', (e) => {
        const host = e.target.closest('#filterActiveChips, #filterModalActiveChips');
        if (!host) return;
        const chip = e.target.closest('.filter-active-chip');
        const removeBtn = e.target.closest('.filter-active-chip-remove');
        const key = removeBtn?.dataset.key || chip?.dataset.key;
        if (key) removeFilterByKey(key);
    });

    function showTempToast(msg) {
        const existing = document.getElementById('filter-temp-toast');
        if (existing) existing.remove();
        const toast = document.createElement('div');
        toast.id = 'filter-temp-toast';
        toast.className = 'filter-temp-toast';
        toast.textContent = msg;
        document.body.appendChild(toast);
        requestAnimationFrame(() => toast.classList.add('show'));
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 200);
        }, 2000);
    }

    sliderLow?.addEventListener('input', () => {
        let v = parseInt(sliderLow.value);
        const high = parseInt(sliderHigh?.value ?? TEMP_FILTER_MAX);
        if (v > high) {
            v = high;
            sliderLow.value = v;
            showTempToast('최저 기온은 최고 기온(' + high + '°)보다 높을 수 없어요.');
        }
        if (valueLow) valueLow.textContent = `${v}° 이상`;
        updateFilterTempLabelPositions();
        updateModalChipsFromUI();
        checkModalTempSlidersAgainstToday();
    });
    sliderHigh?.addEventListener('input', () => {
        let v = parseInt(sliderHigh.value);
        const low = parseInt(sliderLow?.value ?? TEMP_FILTER_MIN);
        if (v < low) {
            v = low;
            sliderHigh.value = v;
            showTempToast('최고 기온은 최저 기온(' + low + '°)보다 낮을 수 없어요.');
        }
        if (valueHigh) valueHigh.textContent = `${v}° 이하`;
        updateFilterTempLabelPositions();
        updateModalChipsFromUI();
        checkModalTempSlidersAgainstToday();
    });

    function onTempPointerEnd() {
        if (activeTempThumb !== null) {
            activeTempThumb = null;
            updateModalChipsFromUI();
            checkModalTempSlidersAgainstToday();
        }
    }
    todayBtn?.addEventListener('click', async () => {
        try {
            const weather = await getCurrentWeather();
            if (weather?.tempMin != null && weather?.tempMax != null) {
                setCachedTodayTempsFromWeather(weather);
                let low = Math.round(weather.tempMin);
                let high = Math.round(weather.tempMax);
                low = Math.max(TEMP_FILTER_MIN, Math.min(TEMP_FILTER_MAX, low));
                high = Math.max(TEMP_FILTER_MIN, Math.min(TEMP_FILTER_MAX, high));
                if (low > high) [low, high] = [high, low];
                if (sliderLow) sliderLow.value = low;
                if (sliderHigh) sliderHigh.value = high;
                if (valueLow) valueLow.textContent = `${low}° 이상`;
                if (valueHigh) valueHigh.textContent = `${high}° 이하`;
                updateFilterTempLabelPositions();
                updateModalChipsFromUI();
                todayBtn?.classList.add('active');
            } else {
                showTempToast('오늘 날씨 정보를 불러올 수 없어요.');
            }
        } catch (err) {
            console.error(err);
            showTempToast('오늘 날씨 정보를 불러올 수 없어요.');
        }
    });

    document.getElementById('filterTempDirectBtn')?.addEventListener('click', async () => {
        const low = parseInt(sliderLow?.value ?? TEMP_FILTER_MIN);
        const high = parseInt(sliderHigh?.value ?? TEMP_FILTER_MAX);
        const result = await showTempInputDialog(low, high, { minVal: TEMP_FILTER_MIN, maxVal: TEMP_FILTER_MAX });
        if (result) {
            clearTodayBtnActive();
            if (sliderLow) sliderLow.value = result.low;
            if (sliderHigh) sliderHigh.value = result.high;
            if (valueLow) valueLow.textContent = `${result.low}° 이상`;
            if (valueHigh) valueHigh.textContent = `${result.high}° 이하`;
            updateFilterTempLabelPositions();
            updateModalChipsFromUI();
            checkModalTempSlidersAgainstToday();
        }
    });

    trackOverlay?.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        const rect = trackWrap?.getBoundingClientRect();
        if (!rect) return;
        const percent = ((e.clientX - rect.left) / rect.width) * 100;
        activeTempThumb = whichThumbFromPercent(percent);
        const val = valueFromClientX(e.clientX);
        applyTempSliderChange(activeTempThumb, val, false, true);
        try {
            document.body.setPointerCapture(e.pointerId);
        } catch (_) { /* ignore */ }
    });
    document.addEventListener('pointermove', (e) => {
        if (activeTempThumb === null) return;
        const val = valueFromClientX(e.clientX);
        applyTempSliderChange(activeTempThumb, val, true, true);
    });
    document.addEventListener('pointerup', (e) => {
        if (activeTempThumb !== null) {
            try { document.body.releasePointerCapture(e.pointerId); } catch (_) { /* ignore */ }
            onTempPointerEnd();
        }
    });
    document.addEventListener('pointercancel', (e) => {
        if (activeTempThumb !== null) {
            try { document.body.releasePointerCapture(e.pointerId); } catch (_) { /* ignore */ }
            onTempPointerEnd();
        }
    });

    modal?.addEventListener('change', (e) => {
        if (
            e.target.matches(
                '#filterYearOptions input, #filterMonthOptions input, #filterWeatherFitOptions input, #filterTpoOptions input, input[name="filterFavorites"], #filterOutfitOptions input[name="filterOutfitPair"]'
            )
        ) {
            updateModalChipsFromUI();
        }
    });

    // 스크롤 overflow 시 좌/우 페이드 표시 (항목이 한 줄 초과할 때만)
    // 좌/우 모두 row에 적용해 화면 맨 좌/우에 고정 (콘텐츠와 겹치지 않음)
    function updateScrollFade(wrap) {
        if (!wrap || wrap.offsetParent === null) return;
        const overflow = wrap.scrollWidth > wrap.clientWidth;
        const atLeft = wrap.scrollLeft <= 2;
        const atRight = wrap.scrollLeft >= wrap.scrollWidth - wrap.clientWidth - 2;
        const row = wrap.closest('.filter-row-category, .filter-row-active, .filter-modal-active-row');
        if (row) {
            row.classList.toggle('fade-left', overflow && !atLeft);
            row.classList.toggle('fade-right', overflow && !atRight);
        }
    }
    function refreshAllFilterFades() {
        document.querySelectorAll('.filter-category-chips-wrap, .filter-active-chips-wrap, .filter-modal-active-wrap').forEach(updateScrollFade);
    }

    document.querySelectorAll('.filter-category-chips-wrap, .filter-active-chips-wrap, .filter-modal-active-wrap').forEach(wrap => {
        wrap.addEventListener('scroll', () => updateScrollFade(wrap));
    });
    window.addEventListener('resize', refreshAllFilterFades);

    const origRenderActiveChips = renderActiveChips;
    renderActiveChips = function() {
        origRenderActiveChips();
        requestAnimationFrame(refreshAllFilterFades);
    };

    renderActiveChips();
    refreshAllFilterFades();

    syncHomeOutfitFilterTabVisibility();

    if (!window.__stylelogHomeOverlayEscapeBound) {
        window.__stylelogHomeOverlayEscapeBound = true;
        document.addEventListener('keydown', (e) => {
            if (e.key !== 'Escape') return;
            if (modal?.classList.contains('active')) {
                closeModal();
                return;
            }
            const menuPopup = document.getElementById('menuPopup');
            if (menuPopup?.classList.contains('active')) {
                menuPopup.classList.remove('active');
                document.body.style.overflow = '';
            }
        });
    }

    // URL 파라미터 ?filter=fav → 즐겨찾기, 착장 품목(단일·조합) (상세 복귀 시 스킵)
    if (!window.__stylelogHomeSkipUrlFilterParams) {
        const homeUrlParams = new URLSearchParams(location.search);
        const outfitUrl = parseOutfitFilterFromUrl(homeUrlParams);
        if (homeUrlParams.get('filter') === 'fav') {
            filterFavoritesOnly = true;
            syncModalFromState();
            renderActiveChips();
            applyFilterAndRender();
        } else if (outfitUrl.keys.length > 0) {
            filterOutfitSelectionKeys = [...outfitUrl.keys];
            filterOutfitMatchAll = outfitUrl.matchAll;
            syncModalFromState();
            renderActiveChips();
            applyFilterAndRender();
            requestAnimationFrame(() => {
                document.getElementById('coordiCollectionHeading')?.scrollIntoView({ block: 'start' });
            });
        }
    }

    window.__stylelogHomeSyncFilterChrome = () => {
        syncModalFromState();
        renderActiveChips();
    };

    window.__stylelogHomeApplyFilters = () => {
        syncModalFromState();
        renderActiveChips();
        applyFilterAndRender();
    };
}

// 스와이프 기능 초기화
function initSwipe() {
    const container = getDayListContainer();
    if (!container) return;
    
    // 일별 리스트 모드에서는 스와이프 비활성화
    if (container.classList.contains('day-list-view')) {
        return;
    }
    
    let isDragging = false;
    let startX = 0;
    let scrollLeft = 0;
    let velocity = 0;
    let lastX = 0;
    let lastTime = 0;
    
    // 마우스/터치 다운
    container.addEventListener('mousedown', startDrag);
    container.addEventListener('touchstart', startDrag);
    
    // 마우스/터치 무브
    container.addEventListener('mousemove', drag);
    container.addEventListener('touchmove', drag);
    
    // 마우스/터치 업
    container.addEventListener('mouseup', endDrag);
    container.addEventListener('mouseleave', endDrag);
    container.addEventListener('touchend', endDrag);
    
    function startDrag(e) {
        isDragging = true;
        container.classList.add('dragging');
        
        const touch = e.type === 'touchstart' ? e.touches[0] : e;
        startX = touch.pageX - container.offsetLeft;
        scrollLeft = container.scrollLeft;
        lastX = touch.pageX;
        lastTime = Date.now();
        velocity = 0;
    }
    
    function drag(e) {
        if (!isDragging) return;
        e.preventDefault();
        
        const touch = e.type === 'touchmove' ? e.touches[0] : e;
        const x = touch.pageX - container.offsetLeft;
        const walk = (x - startX) * 1.5; // 스크롤 속도 조절
        
        container.scrollLeft = scrollLeft - walk;
        
        // 속도 계산
        const now = Date.now();
        const dt = now - lastTime;
        const dx = touch.pageX - lastX;
        velocity = dx / dt;
        
        lastX = touch.pageX;
        lastTime = now;
    }
    
    function endDrag(e) {
        if (!isDragging) return;
        isDragging = false;
        container.classList.remove('dragging');
        
        // 관성 스크롤
        if (Math.abs(velocity) > 0.5) {
            const momentum = velocity * 100;
            container.scrollBy({
                left: -momentum,
                behavior: 'smooth'
            });
        }
    }
    
    // 클릭과 드래그 구분
    container.addEventListener('click', (e) => {
        if (Math.abs(velocity) > 0.5) {
            e.stopPropagation();
            e.preventDefault();
        }
    }, true);
}

// 메뉴 버튼
document.querySelector('.menu-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    const menuPopup = document.getElementById('menuPopup');
    if (menuPopup) {
        menuPopup.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
});

// 메뉴 닫기 버튼
document.querySelector('.close-menu-btn')?.addEventListener('click', () => {
    const menuPopup = document.getElementById('menuPopup');
    if (menuPopup) {
        menuPopup.classList.remove('active');
        document.body.style.overflow = '';
    }
});

// 메뉴 오버레이 클릭 시 닫기
document.querySelector('#menuPopup .menu-overlay')?.addEventListener('click', () => {
    const menuPopup = document.getElementById('menuPopup');
    if (menuPopup) {
        menuPopup.classList.remove('active');
        document.body.style.overflow = '';
    }
});

// 메뉴 사용자 정보 업데이트
async function updateMenuUserInfo() {
    const menuUserInfo = document.getElementById('menuUserInfo');
    if (!menuUserInfo) return;
    try {
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (user) {
            const emailSafe =
                typeof escapeHtml === 'function' ? escapeHtml(user.email || '') : user.email;
            let sub = '로그인 중';
            if (allLoadedLogs.length > 0) {
                sub = `기록 ${allLoadedLogs.length}${hasMoreData ? '+' : ''}건`;
            } else if (typeof hasMoreData !== 'undefined' && !hasMoreData) {
                sub = '첫 코디를 남겨 보세요';
            }
            menuUserInfo.innerHTML = `
                <p style="font-weight: 600; margin-bottom: 4px;">${emailSafe}</p>
                <p class="util-sub" style="margin: 0;">${sub}</p>
            `;
        }
    } catch (error) {
        console.error('사용자 정보 로드 오류:', error);
        menuUserInfo.innerHTML = `<p>사용자 정보를 불러올 수 없습니다.</p>`;
    }
}

// 작성 버튼
document.querySelector('.write-btn')?.addEventListener('click', () => {
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];
    window.location.href = `write.html?date=${dateStr}`;
});

// 즐겨찾기 버튼
document.querySelector('.favorite-btn')?.addEventListener('click', () => {
    window.location.href = 'mypage.html';
});

// 스크롤 방향에 따른 헤더 hide/show (아래로 스크롤 → 숨김, 위로 스크롤 → 표시)
let _lastScrollY = 0;
let _scrollTicking = false;
let _toggleCooldown = 0;
const _SCROLL_THRESHOLD_DOWN = 15;
const _SCROLL_THRESHOLD_UP = 25;  // 히스테리시스: 올릴 때 더 많이 올려야 표시
const _TOP_SHOW_ZONE = 100;

const _YEAR_LABEL_STICK_THRESHOLD = 82; /* year-label가 상단(헤더 아래)에 붙은 것으로 보는 기준(px) */

function _isYearLabelReachedTop(container) {
    const labels = container.querySelectorAll('.year-label-day-view');
    for (const el of labels) {
        const top = el.getBoundingClientRect().top;
        if (top <= _YEAR_LABEL_STICK_THRESHOLD) return true;
    }
    return false;
}

function _handleHeaderScroll() {
    if (_scrollTicking) return;
    _scrollTicking = true;
    requestAnimationFrame(() => {
        const container = document.querySelector('.container');
        if (!container || !container.querySelector('.year-label-day-view')) {
            _scrollTicking = false;
            return;
        }
        const now = Date.now();
        const currentY = window.scrollY || document.documentElement.scrollTop;
        const isHidden = document.body.classList.contains('header-scrolled-hidden');
        const yearLabelReachedTop = _isYearLabelReachedTop(container);
        const cooldownActive = now < _toggleCooldown;

        /* year-label-reached-top은 cooldown과 무관하게 항상 업데이트 (빠른 스크롤 시 반응 지연 방지) */
        if (yearLabelReachedTop) {
            document.body.classList.add('year-label-reached-top');
        } else {
            document.body.classList.remove('year-label-reached-top');
        }

        if (cooldownActive) {
            _lastScrollY = currentY;
            _scrollTicking = false;
            return;
        }

        if (currentY < _TOP_SHOW_ZONE) {
            if (isHidden) {
                document.body.classList.remove('header-scrolled-hidden');
                _toggleCooldown = now + 250;
            }
        } else if (currentY > _lastScrollY + _SCROLL_THRESHOLD_DOWN) {
            if (!isHidden) {
                document.body.classList.add('header-scrolled-hidden');
                _toggleCooldown = now + 250;
            }
        } else if (currentY < _lastScrollY - _SCROLL_THRESHOLD_UP) {
            if (isHidden) {
                document.body.classList.remove('header-scrolled-hidden');
                _toggleCooldown = now + 250;
            }
        }
        _lastScrollY = currentY;
        _scrollTicking = false;
    });
}

window.addEventListener('scroll', _handleHeaderScroll, { passive: true });

// 페이지 로드 시 초기화
window.addEventListener('pageshow', (event) => {
    if (!event.persisted) return;
    sessionStorage.removeItem('homeScrollY');
    sessionStorage.removeItem(HOME_RETURN_LOG_KEY);
    sessionStorage.removeItem(HOME_FILTER_STATE_STORAGE_KEY);
    document.body.classList.remove('scroll-restore-pending');
});

window.addEventListener('load', async () => {
    updateMenuUserInfo();
    await initPage();
    /** 헤더 날짜 영역과 경쟁하지 않도록 위젯은 백그라운드 업데이트 */
    void updateTodayInfo();
});

// 오늘 날짜와 날씨 정보 업데이트 (Danble 스타일 위젯)
async function updateTodayInfo() {
    debugLog('📅 날씨 업데이트 시작');

    const today = new Date();
    const dateLabel =
        typeof formatStyleLogDate === 'function' ? formatStyleLogDate(today, 'card') : today.toLocaleDateString('ko-KR');
    const heroDateEl = document.getElementById('homeHeroDate');
    if (heroDateEl) {
        heroDateEl.textContent = dateLabel;
        heroDateEl.setAttribute('datetime', today.toISOString().slice(0, 10));
    }
    const todayDateEl = document.getElementById('weatherTodayDate');
    if (todayDateEl) todayDateEl.textContent = dateLabel;

    try {
        const weather = await getCurrentWeather();
        debugLog('🌤️ 날씨 데이터:', weather);
        
        const tempRangeEl = document.getElementById('weatherTempRange');
        const iconWrapEl = document.getElementById('weatherIconWrap');
        const statusEl = document.getElementById('weatherStatus');
        const weatherChip = document.getElementById('homeWeatherChip') || document.getElementById('weatherBottomSection');
        
        if (weather && tempRangeEl && weatherChip) {
            if (weather.tempMin != null && weather.tempMax != null) {
                tempRangeEl.textContent = `최고 ${Math.round(weather.tempMax)}° · 최저 ${Math.round(weather.tempMin)}°`;
            } else if (weather.temp != null) {
                tempRangeEl.textContent = `평균 ${Math.round(weather.temp)}°`;
            } else {
                tempRangeEl.textContent = '—';
            }
            
            // 날씨 아이콘 (80px, 모바일 64px)
            if (iconWrapEl) {
                iconWrapEl.innerHTML = getWeatherIconSVG(weather.weather, 28);
            }
            
            if (statusEl) {
                statusEl.textContent = weather.description || '--';
            }
            
            // 날씨에 따라 배경 색상
            weatherChip.classList.remove('weather-clear', 'weather-sunny', 'weather-cloudy', 'weather-rainy', 'weather-snowy', 'weather-lightning');
            weatherChip.classList.add(`weather-${weather.weather}`);
            
            debugLog('✅ 날씨 표시 완료');
        } else {
            console.warn('⚠️ 날씨 데이터 또는 DOM 없음');
        }
    } catch (error) {
        console.error('❌ 날씨 로드 오류:', error);
    }
}
