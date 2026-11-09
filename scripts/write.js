// 작성 화면 스크립트

// URL 파라미터에서 날짜 및 ID 가져오기
const urlParams = new URLSearchParams(window.location.search);
const initialDate = urlParams.get('date');
const editLogId = urlParams.get('id'); // 수정 모드인지 확인
const writeModeParam = String(urlParams.get('mode') || '').trim().toLowerCase();
const fromRefLogId = String(urlParams.get('fromRef') || '').trim();

let currentWeather = null;
/** @type {'my_outfit'|'reference'} */
let writeLogKind = 'my_outfit';
let writeSourceReferenceId = null;
let selectedPhotos = [];
/** 예전 자유 태그. 화면에서는 고치지 않고 저장 때 그대로 둔다 */
let preservedTags = [];
let selectedTpo = [];
let isEditMode = false; // 수정 모드 플래그
let currentLog = null; // 수정할 로그 데이터
/** 신규 저장 시 INSERT id 를 Storage 경로와 맞추기 위해 한 번 결정되는 UUID */
let pendingNewStyleLogIdForUpload = null;
let draggingPhotoIndex = null;
let touchDragState = null;
let lastInsertPosition = -1;
let insertLineHideTimer = null;
let dragGhostEl = null;

/** 착장 품목 (v2): { category, value }[] — 구분 순서는 common.js OUTFIT_CATEGORY_SORT_ORDER */
const OUTFIT_DEFAULT_CATEGORIES = OUTFIT_CATEGORY_SORT_ORDER;

let outfitItems = [];
let outfitCategorySheetRowIndex = null;
/** add = 다중 선택 후 행 추가, edit = 기존 행 구분 변경 */
let outfitCategorySheetMode = 'add';
/** 시트 닫힌 뒤 포커스를 돌려줄 구분 버튼(aria-hidden 경고 방지) */
let outfitCategorySheetReturnEl = null;
/** 바텀시트에서 선택 중인 구분들 (확인 전) */
let outfitCategoryPending = new Set();

/** 옷장 카탈로그 (작성 화면 품목 선택) */
let writeWardrobeCatalog = [];
/** null = 여러 품목 추가 모드, number = 해당 행만 고르기 */
let outfitWardrobePickerRowIndex = null;
let outfitWardrobePickerCatFilter = '';
/** null이면 구분 칩을 모두 보여주고, 배열이면 그 구분만 */
let outfitWardrobePickerAllowedCats = null;
let outfitWardrobePickerSearchQuery = '';
let writeWardrobeAddCat = '상의';
let writeWardrobeAddBusy = false;
let outfitWardrobeRenameBusy = false;
let outfitWardrobePickerReturnEl = null;

/** DB 및 현재 작성 중인 행까지 반영한 구분별 품목명 후보 (제안 패널) */
let outfitSavedValuesByCategory = new Map();

/** localStorage 에 저장된 "직접 추가" 품목을 후보 맵에 합침 */
function hydrateOutfitSuggestionExtrasFromStorage() {
    const o = readOutfitSuggestionLsObject(LS_OUTFIT_SUGGESTION_EXTRAS);
    Object.keys(o).forEach((cat) => {
        outfitSuggestionStringsForCategory(o, cat).forEach((v) => {
            rememberOutfitValueSuggestion(cat, v);
        });
    });
}

/** 제안 목록에서 삭제: 이 기기에서만 숨김 + 기록에서 제거 */
function removeOutfitSuggestionFromPicker(category, value) {
    const c = normalizeOutfitCategoryKey(category);
    const v = String(value || '').trim();
    if (!c || !v) return;
    persistOutfitSuggestionBlocked(c, v);
    removeOutfitSuggestionExtraPersisted(c, v);
    const set = outfitSavedValuesByCategory.get(c);
    if (set) set.delete(v);
}

/** 제안 목록에서 이름 변경: 옛 이름은 숨기고 새 이름을 후보로 유지 */
function renameOutfitSuggestionInPicker(category, oldVal, newVal) {
    const c = normalizeOutfitCategoryKey(category);
    const oldV = String(oldVal || '').trim();
    let newV = String(newVal || '').trim();
    if (!c || !oldV) return { ok: false };
    if (!newV) {
        void showAlert('품목명을 입력해 주세요.');
        return { ok: false };
    }
    if (newV.length > OUTFIT_ITEM_VALUE_MAX_LEN) {
        void showAlert(`품목명은 ${OUTFIT_ITEM_VALUE_MAX_LEN}자 이하로 입력해 주세요.`);
        return { ok: false };
    }
    if (oldV === newV) return { ok: true, newVal: newV };

    persistOutfitSuggestionBlocked(c, oldV);
    removeOutfitSuggestionExtraPersisted(c, oldV);
    removeOutfitSuggestionBlockedValue(c, newV);

    const set = outfitSavedValuesByCategory.get(c);
    if (set) {
        set.delete(oldV);
        set.add(newV);
    } else {
        rememberOutfitValueSuggestion(c, newV);
    }
    persistOutfitSuggestionExtra(c, newV);

    return { ok: true, newVal: newV };
}

/** 최근 품목 이름 변경 후, 현재 화면 초안·편집 중 로그의 items 반영 및 행 재렌더 */
function refreshLocalDraftAfterRenamingOutfitSuggestion(category, oldValue, newValue) {
    const c = normalizeOutfitCategoryKey(category);
    const o = String(oldValue || '').trim();
    const n = String(newValue || '').trim();
    if (!c || !o || !n || o === n) return;

    outfitItems.forEach((row) => {
        if (normalizeOutfitCategoryKey(row.category) !== c) return;
        if (String(row.value || '').trim() === o) row.value = n;
        if (String(row.valueDraft || '').trim() === o) row.valueDraft = n;
    });

    if (currentLog && currentLog.items != null) {
        let arr = currentLog.items;
        if (typeof arr === 'string') {
            try {
                arr = JSON.parse(arr);
            } catch (_) {
                arr = [];
            }
        }
        if (Array.isArray(arr)) {
            let touched = false;
            const next = arr.map((it) => {
                if (!it || typeof it !== 'object') return it;
                const tc = normalizeOutfitCategoryKey(it.category);
                const tv = typeof it.value === 'string' ? it.value.trim() : '';
                if (tc === c && tv === o) {
                    touched = true;
                    return { ...it, value: n };
                }
                return it;
            });
            if (touched) currentLog.items = next;
        }
    }

    renderOutfitItemRows();
}
async function initPage() {
    debugLog('📝 write.html 초기화:', { 
        editLogId, 
        initialDate,
        urlParams: window.location.search,
        allParams: Object.fromEntries(urlParams.entries())
    });
    
    // 수정 모드 확인 (id가 null, 빈 문자열, 'null' 문자열이 아닌 경우만)
    if (editLogId && editLogId !== 'null' && editLogId !== 'undefined' && editLogId.trim() !== '') {
        debugLog('✏️ 수정 모드로 진입:', editLogId);
        isEditMode = true;
        try {
            await loadLogForEdit(editLogId);
        } catch (error) {
            console.error('❌ 로그 로드 실패:', error);
            await showAlert('일기를 불러오는데 실패했습니다. 새로 작성해 주세요.');
            isEditMode = false;
            await initNewLog();
        }
    } else {
        debugLog('📝 새 로그 작성 모드 (editLogId가 없거나 유효하지 않음)');
        // 새 로그 작성 모드
        await initNewLog();
    }
    
    await loadOutfitValueSuggestions();
    await loadWriteWardrobeCatalog();

    syncWriteLogKindUI();

    // 이벤트 리스너 등록
    attachEventListeners();
    
    // 폼 유효성 검사
    validateForm();
}

function syncWriteLogKindUI() {
    const section = document.getElementById('logKindSection');
    const refSection = document.getElementById('referenceFieldsSection');
    const hint = document.getElementById('logKindHint');
    const isRef = writeLogKind === 'reference';
    document.querySelectorAll('#logKindBtns .weather-fit-btn').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.value === writeLogKind);
    });
    if (refSection) refSection.hidden = !isRef;
    if (hint) {
        hint.textContent = isRef
            ? '붙여 둔 코디·룩북 링크와 메모를 남겨요. 사진은 복사하지 않아요.'
            : '내가 실제로 입은 코디를 남겨요.';
    }
    if (isEditMode && section) {
        section.setAttribute('hidden', '');
        if (refSection && isRef) refSection.removeAttribute('hidden');
    }
}

function setWriteLogKind(kind) {
    const next =
        typeof normalizeLogKind === 'function'
            ? normalizeLogKind(kind)
            : kind === 'reference'
              ? 'reference'
              : 'my_outfit';
    if (next === writeLogKind) return;
    writeLogKind = next;
    syncWriteLogKindUI();
}

const WRITE_OUTFIT_SEED_SS = 'stylelog_write_outfit_seed';

async function applyFromReferencePrefill(refId) {
    if (!refId || isEditMode) return;
    try {
        const ref = await StyleLogAPI.getById(refId);
        if (!ref) return;
        writeSourceReferenceId = ref.id;
        const titleInput = document.getElementById('titleInput');
        const refTitle = String(ref.title || '').trim();
        if (titleInput && !String(titleInput.value || '').trim() && refTitle) {
            titleInput.value = refTitle;
        }
        const scrapInput = document.getElementById('scrapGroupInput');
        const refScrap = String(ref.scrap_group || '').trim();
        if (scrapInput && !String(scrapInput.value || '').trim() && refScrap) {
            scrapInput.value = refScrap;
        }
        try {
            const seedRaw = sessionStorage.getItem(WRITE_OUTFIT_SEED_SS);
            sessionStorage.removeItem(WRITE_OUTFIT_SEED_SS);
            if (seedRaw) {
                const seed = JSON.parse(seedRaw);
                if (seed && seed.category && seed.value) {
                    outfitItems.push({
                        category: String(seed.category).trim(),
                        value: String(seed.value).trim(),
                        valueDraft: ''
                    });
                    renderOutfitItemRows();
                }
            }
        } catch (_) {
            /* ignore */
        }
    } catch (e) {
        console.warn('fromRef prefill', e);
    }
}

// 수정할 로그 데이터 로드
async function loadLogForEdit(logId) {
    try {
        debugLog('📝 수정 모드: 로그 로딩 중...', logId);
        
        if (!logId || logId === 'null' || logId === 'undefined') {
            throw new Error('유효하지 않은 로그 ID입니다.');
        }
        
        // DB에서 로그 가져오기
        const { data, error } = await supabaseClient
            .from('style_logs')
            .select('*')
            .eq('id', logId)
            .single();
        
        if (error) {
            console.error('❌ 로그 로드 오류:', error);
            throw error;
        }
        
        if (!data) {
            throw new Error('로그를 찾을 수 없습니다.');
        }
        
        currentLog = data;
        debugLog('✅ 로그 로드 완료:', currentLog);

        if (
            currentLog &&
            typeof currentLog === 'object' &&
            Object.prototype.hasOwnProperty.call(currentLog, 'items') &&
            typeof StyleLogAPI.resetOutfitItemsColumnErrorState === 'function'
        ) {
            StyleLogAPI.resetOutfitItemsColumnErrorState();
        }
        
        // 폼에 데이터 채우기
        const dateInput = document.getElementById('dateInput');
        const titleInput = document.getElementById('titleInput');
        const contentInput = document.getElementById('contentInput');
        
        dateInput.value = currentLog.date;
        titleInput.value = currentLog.title || '';
        contentInput.value = currentLog.content || '';
        
        // 사진 로드
        if (currentLog.photos && currentLog.photos.length > 0) {
            selectedPhotos = currentLog.photos.map((url, index) => ({
                dataUrl: url,
                isExisting: true // 기존 사진 표시
            }));
            renderPhotoPreviews();
        }
        
        preservedTags = Array.isArray(currentLog.tags) ? [...currentLog.tags] : [];
        selectedTpo = typeof normalizeTpoValues === 'function'
            ? normalizeTpoValues(currentLog.tpo)
            : [];
        syncTpoButtons();

        // 착장 품목 로드
        hydrateOutfitItemsFromLog(currentLog.items);

        writeLogKind =
            typeof normalizeLogKind === 'function'
                ? normalizeLogKind(currentLog.log_kind)
                : 'my_outfit';
        const refUrlInput = document.getElementById('referenceSourceUrlInput');
        const scrapInput = document.getElementById('scrapGroupInput');
        if (refUrlInput) {
            refUrlInput.value = String(currentLog.reference_source_url || '').trim();
        }
        if (scrapInput) {
            scrapInput.value = String(currentLog.scrap_group || '').trim();
        }
        
        // 날씨 정보 로드
        currentWeather = {
            weather: currentLog.weather || 'cloudy',
            temp: currentLog.weather_temp,
            tempMin: currentLog.weather_temp_min,
            tempMax: currentLog.weather_temp_max,
            description: currentLog.weather_description || '흐림'
        };
        updateWeatherDisplay(currentWeather);

        // 날씨적합도 로드
        const weatherFit = currentLog.weather_fit || 'good';
        const weatherFitInput = document.getElementById('weatherFitInput');
        if (weatherFitInput) weatherFitInput.value = weatherFit;
        document.querySelectorAll('#weatherFitBtns .weather-fit-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.value === weatherFit);
        });
        
        // 헤더 타이틀 변경
        const headerTitle = document.querySelector('.write-header h1');
        if (headerTitle) {
            headerTitle.textContent = '수정하기';
        }
        document.getElementById('writeFormLedeBlock')?.setAttribute('hidden', '');
        
        // 저장 버튼 텍스트 변경
        const saveBtn = document.querySelector('.save-btn');
        if (saveBtn) {
            saveBtn.textContent = '완료';
        }

        syncWriteLogKindUI();
        
    } catch (error) {
        console.error('❌ 로그 로드 오류:', error);
        return showAlert('로그를 불러오는데 실패했습니다.').then(() => window.history.back());
    }
}

// 새 로그 작성 초기화
async function initNewLog() {
    // 날짜 설정
    const dateInput = document.getElementById('dateInput');
    if (initialDate && initialDate !== 'null') {
        dateInput.value = initialDate;
    } else {
        // 현재 날짜를 YYYY-MM-DD 형식으로
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        dateInput.value = `${year}-${month}-${day}`;
    }
    
    // 날짜 변경 시 날씨 자동 업데이트
    dateInput.addEventListener('change', async (e) => {
        const selectedDate = e.target.value;
        if (selectedDate) {
            await loadWeatherForDate(selectedDate);
        }
    });
    
    if (writeModeParam === 'reference') {
        writeLogKind = 'reference';
    }
    if (fromRefLogId) {
        writeLogKind = 'my_outfit';
        await applyFromReferencePrefill(fromRefLogId);
    }

    // 초기 날씨 정보 로드
    await loadWeatherForDate(dateInput.value);
}

// 특정 날짜의 날씨 정보 로드
async function loadWeatherForDate(date) {
    try {
        debugLog('🌤️ 날씨 로딩 중...', date);
        
        currentWeather = await getWeatherByDate(date);
        
        if (currentWeather) {
            if (currentWeather.unavailable && currentWeather.reason === 'future') {
                // 7일 이후 미래 날짜 → 사용자 안내 표시
                currentWeather = {
                    ...currentWeather,
                    _futureHint: true
                };
            }
            debugLog('🌤️ 날씨 정보:', currentWeather);
            updateWeatherDisplay(currentWeather);
        } else {
            // API 오류 등 날씨 로드 실패 시 기본값
            currentWeather = {
                weather: 'cloudy',
                temp: null,
                tempMax: null,
                tempMin: null,
                description: '흐림'
            };
            updateWeatherDisplay(currentWeather);
        }
    } catch (error) {
        console.error('날씨 로드 오류:', error);
        currentWeather = {
            weather: 'cloudy',
            temp: null,
            tempMax: null,
            tempMin: null,
            description: '흐림'
        };
        updateWeatherDisplay(currentWeather);
    }
}

// 날씨 표시 업데이트
function updateWeatherDisplay(weather) {
    const weatherDisplay = document.getElementById('weatherDisplay');
    const weatherIconContainer = document.getElementById('weatherIconContainer');
    const weatherName = document.getElementById('weatherName');
    const weatherTemp = document.getElementById('weatherTemp');
    const weatherInput = document.getElementById('weatherInput');
    const weatherTempInput = document.getElementById('weatherTempInput');
    const weatherDescInput = document.getElementById('weatherDescInput');
    const tempRange = document.getElementById('tempRange');
    
    // 기존 안내 문구 제거
    const existingHint = weatherDisplay?.querySelector('.weather-future-hint');
    if (existingHint) existingHint.remove();
    
    // 7일 이후 미래 날짜인 경우: 안내 문구 표시
    if (weather._futureHint || (weather.unavailable && weather.reason === 'future')) {
        weatherIconContainer.innerHTML = getWeatherIconSVG('cloudy', 32);
        weatherName.textContent = '날씨를 알 수 없어요';
        weatherTemp.textContent = '—';
        tempRange.style.display = 'none';
        weatherInput.value = weather.weather || 'cloudy';
        weatherTempInput.value = '';
        weatherDescInput.value = '날씨를 알 수 없어요';
        
        const hint = document.createElement('p');
        hint.className = 'weather-future-hint write-ui-copy';
        setUiCopyLines(hint, [
            '7일 이후 날짜는 날씨 미리보기가 없어요.',
            '기록은 그대로 저장할 수 있어요.'
        ]);
        weatherDisplay?.appendChild(hint);
        return;
    }
    
    // 아이콘
    weatherIconContainer.innerHTML = getWeatherIconSVG(weather.weather, 32);
    
    // 이름
    weatherName.textContent = weather.description || '흐림';
    
    // 평균 기온
    if (weather.temp !== null && weather.temp !== undefined) {
        weatherTemp.textContent = `평균 ${Math.round(weather.temp)}°C`;
    } else {
        weatherTemp.textContent = '—';
    }
    
    // 최고/최저 기온
    if (weather.tempMax !== null && weather.tempMin !== null) {
        tempRange.style.display = 'flex';
        tempRange.innerHTML = `
            <span class="temp-high">최고 ${Math.round(weather.tempMax)}°</span>
            <span class="temp-low">최저 ${Math.round(weather.tempMin)}°</span>
        `;
    } else {
        tempRange.style.display = 'none';
    }

    // 날씨별 카드 배경
    const card = document.getElementById('writeWeatherCard');
    if (card) {
        card.classList.remove('weather-clear', 'weather-sunny', 'weather-cloudy', 'weather-rainy', 'weather-snowy', 'weather-lightning');
        if (weather.weather && !weather._futureHint && !weather.unavailable) {
            card.classList.add(`weather-${weather.weather}`);
        } else {
            card.classList.add('weather-cloudy');
        }
    }
    
    // hidden input 설정
    weatherInput.value = weather.weather;
    if (weather.temp) weatherTempInput.value = weather.temp;
    if (weather.description) weatherDescInput.value = weather.description;
}

function writeFormHasDraftContent() {
    if (isEditMode) return false;
    if (selectedPhotos && selectedPhotos.length > 0) return true;
    const title = document.getElementById('titleInput')?.value?.trim();
    const content = document.getElementById('contentInput')?.value?.trim();
    if (title || content) return true;
    if (selectedTpo.length > 0) return true;
    const itemsRaw = document.getElementById('itemsJsonInput')?.value;
    try {
        const items = JSON.parse(itemsRaw || '[]');
        if (Array.isArray(items) && items.length > 0) return true;
    } catch (_) { /* ignore */ }
    return false;
}

// 이벤트 리스너 등록
function attachEventListeners() {
    // 취소 버튼
    document.querySelector('.cancel-btn').addEventListener('click', () => {
        if (!writeFormHasDraftContent()) {
            window.history.back();
            return;
        }
        showConfirm('작성 중인 내용이 사라져요. 나가시겠어요?').then((ok) => {
            if (ok) window.history.back();
        });
    });
    
    // 저장 버튼
    const saveBtn = document.querySelector('.save-btn');
    saveBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        debugLog('💾 저장 버튼 클릭됨');
        await handleSubmit();
    });
    
    // 사진 선택
    document.getElementById('photoInput').addEventListener('change', handlePhotoSelect);

    // 리스트 영역 드래그 오버 (플로팅 클론 + 갭 확대)
    document.getElementById('photoPreviewList').addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (draggingPhotoIndex === null) return;
        updateDragGhost(e.clientX, e.clientY);
        const insertPos = getInsertPositionFromCoords(e.clientX, e.clientY);
        if (insertPos >= 0 && insertPos !== draggingPhotoIndex && insertPos !== draggingPhotoIndex + 1) {
            updateInsertLine(insertPos);
        } else {
            updateInsertLine(-1);
        }
    });
    document.getElementById('photoPreviewList').addEventListener('drop', (e) => {
        if (e.target.closest('.photo-preview-item')) return;
        e.preventDefault();
        e.stopPropagation();
        removeDragGhost();
        if (insertLineHideTimer) clearTimeout(insertLineHideTimer);
        insertLineHideTimer = null;
        const line = document.getElementById('photoInsertLine');
        if (line) line.classList.remove('visible');
        const fromIndex = draggingPhotoIndex;
        const insertPos = lastInsertPosition;
        if (fromIndex === null || insertPos < 0 || insertPos === fromIndex || insertPos === fromIndex + 1) {
            draggingPhotoIndex = null;
            return;
        }
        const [moved] = selectedPhotos.splice(fromIndex, 1);
        const insertIndex = fromIndex < insertPos ? insertPos - 1 : insertPos;
        selectedPhotos.splice(insertIndex, 0, moved);
        draggingPhotoIndex = null;
        renderPhotoPreviews();
    });

    // 포인터 업 시 dragging 클래스 제거 (클릭만 하고 드래그 안 했을 때)
    document.addEventListener('pointerup', clearPhotoDraggingState);
    document.addEventListener('pointercancel', clearPhotoDraggingState);
    
    document.querySelectorAll('#tpoBtns .weather-fit-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            const value = btn.dataset.value;
            if (!value) return;
            btn.classList.toggle('active');
            if (btn.classList.contains('active')) {
                if (!selectedTpo.includes(value)) selectedTpo.push(value);
            } else {
                selectedTpo = selectedTpo.filter((item) => item !== value);
            }
        });
    });

    document.querySelectorAll('#logKindBtns .weather-fit-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            if (isEditMode) return;
            const value = btn.dataset.value;
            if (!value) return;
            setWriteLogKind(value);
        });
    });

    // 폼 입력 시 유효성 검사
    document.getElementById('dateInput').addEventListener('change', validateForm);
    document.getElementById('titleInput').addEventListener('input', validateForm);
    document.getElementById('contentInput').addEventListener('input', validateForm);

    // 옷차림 체감만 단일 선택. 상황 칩은 같은 버튼 클래스를 쓰지만 여러 개 남긴다.
    document.querySelectorAll('#weatherFitBtns .weather-fit-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('#weatherFitBtns .weather-fit-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const input = document.getElementById('weatherFitInput');
            if (input) input.value = btn.dataset.value;
        });
    });

    // 크롭 모달 초기화
    initCropModal();

    initOutfitItemsUI();
}

/**
 * DB items(jsonb) → 로컬 배열 (기본 6종 외 구분은 기존 저장값 표시용으로만 그리드에 포함)
 */
function hydrateOutfitItemsFromLog(itemsRaw) {
    if (!itemsRaw) {
        outfitItems = [];
        return;
    }
    let arr = itemsRaw;
    if (typeof itemsRaw === 'string') {
        try {
            arr = JSON.parse(itemsRaw);
        } catch (_) {
            arr = [];
        }
    }
    if (!Array.isArray(arr)) {
        outfitItems = [];
        return;
    }
    outfitItems = arr.map((row) => {
        const v = typeof row.value === 'string' ? row.value.trim() : '';
        return {
            category: typeof row.category === 'string' ? row.category.trim() : '',
            value: v,
            valueDraft: v
        };
    });
    sortOutfitItemsInPlace();
}

/** 구분 순서(아우터→상의→…)에 맞춰 착장 품목 행 정렬 — 동일 구분은 기존 순서 유지 */
function sortOutfitItemsInPlace() {
    if (outfitItems.length < 2) return;
    outfitItems.sort((a, b) => {
        const ca = String(a.category || '').trim();
        const cb = String(b.category || '').trim();
        const ra = outfitCategorySortRank(ca);
        const rb = outfitCategorySortRank(cb);
        if (ra !== rb) return ra - rb;
        if (ra === OUTFIT_CATEGORY_SORT_ORDER.length) {
            return ca.localeCompare(cb, 'ko');
        }
        return 0;
    });
}

async function loadOutfitValueSuggestions() {
    try {
        const excludeLogId =
            isEditMode && currentLog && currentLog.id ? String(currentLog.id) : null;
        const map = await StyleLogAPI.getOutfitItemValueSuggestions({ excludeLogId });
        outfitSavedValuesByCategory = map instanceof Map ? map : new Map();
    } catch (e) {
        console.warn('착장 품목 후보 로드 실패:', e);
        outfitSavedValuesByCategory = new Map();
    }
    hydrateOutfitSuggestionExtrasFromStorage();
    mergeOutfitRowsIntoSuggestionMap();
}

/** 현재 폼의 outfitItems 품목명을 후보 맵에 합침 (같은 화면에서 입력한 것도 제안에 포함) */
function mergeOutfitRowsIntoSuggestionMap() {
    outfitItems.forEach((row) => {
        rememberOutfitValueSuggestion(row.category, row.value);
    });
}

function rememberOutfitValueSuggestion(category, value) {
    const c = String(category || '').trim();
    const v = String(value || '').trim();
    if (!c || !v) return;
    if (getOutfitSuggestionBlockedSet(c).has(v)) return;
    if (!outfitSavedValuesByCategory.has(c)) outfitSavedValuesByCategory.set(c, new Set());
    outfitSavedValuesByCategory.get(c).add(v);
}

/** 같은 구분에서 쓰인 과거 품목명 (제안 패널용 — 숨김 목록 제외) */
function getOutfitSuggestionValuesForCategory(category) {
    const cat = String(category || '').trim();
    if (!cat) return [];
    const set = outfitSavedValuesByCategory.get(cat);
    if (!set || set.size === 0) return [];
    const blocked = getOutfitSuggestionBlockedSet(cat);
    return [...set]
        .map((s) => String(s || '').trim())
        .filter((s) => s.length > 0 && !blocked.has(s))
        .sort((a, b) => a.localeCompare(b, 'ko'));
}

const outfitSuggestionPanelHideTimers = new WeakMap();

function setOutfitSuggestionRowOpenState(panel, open) {
    const rowEl = panel?.closest?.('.outfit-item-row');
    if (rowEl) rowEl.classList.toggle('outfit-item-row--suggest-open', Boolean(open));
}

/** 다른 줄의 레이어·타이머가 남지 않도록 즉시 닫음 */
function hideOtherOutfitSuggestionPanels(keepPanel) {
    document.querySelectorAll('.outfit-value-suggestions').forEach((p) => {
        if (p === keepPanel) return;
        p.hidden = true;
        setOutfitSuggestionRowOpenState(p, false);
    });
}

function hideOutfitValueSuggestionSoon(panel) {
    if (!panel) return;
    const prev = outfitSuggestionPanelHideTimers.get(panel);
    if (prev != null) window.clearTimeout(prev);
    const t = window.setTimeout(() => {
        if (panel.contains(document.activeElement)) {
            outfitSuggestionPanelHideTimers.delete(panel);
            return;
        }
        panel.hidden = true;
        setOutfitSuggestionRowOpenState(panel, false);
        outfitSuggestionPanelHideTimers.delete(panel);
    }, 240);
    outfitSuggestionPanelHideTimers.set(panel, t);
}

function cancelOutfitSuggestionHideForPanel(panel) {
    if (!panel) return;
    const t = outfitSuggestionPanelHideTimers.get(panel);
    if (t != null) {
        window.clearTimeout(t);
        outfitSuggestionPanelHideTimers.delete(panel);
    }
}

function cancelAllOutfitSuggestionHideTimers() {
    document.querySelectorAll('.outfit-value-suggestions').forEach((p) => {
        cancelOutfitSuggestionHideForPanel(p);
    });
}

function hideAllOutfitValueSuggestionPanels() {
    cancelAllOutfitSuggestionHideTimers();
    document.querySelectorAll('.outfit-value-suggestions').forEach((p) => {
        p.hidden = true;
        setOutfitSuggestionRowOpenState(p, false);
    });
}

/** @param {HTMLInputElement} inp @param {HTMLDivElement} panel */
function attachOutfitValueSuggestionUI(inp, panel) {
    const MAX_SUGGEST = 200;

    const refresh = () => {
        hideOtherOutfitSuggestionPanels(panel);
        cancelOutfitSuggestionHideForPanel(panel);
        const idx = parseInt(inp.getAttribute('data-outfit-value-index'), 10);
        if (Number.isNaN(idx) || !outfitItems[idx]) {
            panel.hidden = true;
            setOutfitSuggestionRowOpenState(panel, false);
            return;
        }
        const cat = String(outfitItems[idx].category || '').trim();
        let values = getOutfitSuggestionValuesForCategory(cat);
        const qTrim = (inp.value || '').trim();
        const qLc = qTrim.toLowerCase();

        /** '수정' 탭 후 한 번만: 검색 필터·동일 문자열 접기 없이 최근 목록 전체 표시 */
        const forceFullSuggest = Boolean(inp._outfitShowFullSuggestionsOnce);
        if (inp._outfitShowFullSuggestionsOnce) {
            inp._outfitShowFullSuggestionsOnce = false;
        }

        if (!forceFullSuggest) {
            if (qTrim.length > 0) {
                values = values.filter((v) => v.toLowerCase().includes(qLc));
            }
            const bypassHideUntil = Number(inp._outfitBypassSuggestExactHideUntil) || 0;
            const canExactHide = performance.now() >= bypassHideUntil;
            // 입력이 후보와 동일하면(이미 확정) 목록을 띄우지 않음 — 겹침·잔상 방지 ('수정' 직후·강제 열림은 제외)
            if (canExactHide && qTrim.length > 0 && values.some((v) => v === qTrim)) {
                panel.innerHTML = '';
                panel.hidden = true;
                setOutfitSuggestionRowOpenState(panel, false);
                return;
            }
        }
        panel.innerHTML = '';
        if (values.length === 0) {
            panel.hidden = true;
            setOutfitSuggestionRowOpenState(panel, false);
            return;
        }

        const head = document.createElement('div');
        head.className = 'outfit-value-suggestions__head';
        head.textContent = '최근 쓴 품목';
        panel.appendChild(head);

        const listEl = document.createElement('div');
        listEl.className = 'outfit-value-suggestions__list';

        const applyValueFromSuggestion = (v) => {
            const t = String(v || '').trim();
            inp.value = t;
            outfitItems[idx].value = t;
            outfitItems[idx].valueDraft = t;
            syncOutfitItemsHiddenInput();
            if (t.length > 0) {
                removeOutfitSuggestionBlockedValue(cat, t);
            }
            rememberOutfitValueSuggestion(cat, t);
            panel.hidden = true;
            setOutfitSuggestionRowOpenState(panel, false);
            inp.focus();
            const cbtn = document.querySelector(
                `[data-outfit-commit-index="${CSS.escape(String(idx))}"]`
            );
            refreshOutfitValueCommitBtn(cbtn, idx);
        };

        const ICON_PENCIL =
            '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>';
        const ICON_TRASH =
            '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>';

        values.slice(0, MAX_SUGGEST).forEach((val) => {
            const row = document.createElement('div');
            row.className = 'outfit-value-suggestion-row';

            const selBtn = document.createElement('button');
            selBtn.type = 'button';
            selBtn.className = 'outfit-value-suggestion-select';
            selBtn.textContent = val;
            selBtn.title = val;

            const editBtn = document.createElement('button');
            editBtn.type = 'button';
            editBtn.className = 'outfit-value-suggestion-action outfit-value-suggestion-action--edit';
            editBtn.innerHTML = ICON_PENCIL;
            editBtn.setAttribute('aria-label', `${val} 수정`);

            const delBtn = document.createElement('button');
            delBtn.type = 'button';
            delBtn.className = 'outfit-value-suggestion-action outfit-value-suggestion-action--delete';
            delBtn.innerHTML = ICON_TRASH;
            delBtn.setAttribute('aria-label', `${val} 목록에서 제거`);

            const openInlineEdit = () => {
                cancelOutfitSuggestionHideForPanel(panel);
                row.classList.add('outfit-value-suggestion-row--editing');
                row.innerHTML = '';

                const editInput = document.createElement('input');
                editInput.type = 'text';
                editInput.className = 'outfit-value-suggestion-edit-input';
                editInput.maxLength = OUTFIT_ITEM_VALUE_MAX_LEN;
                editInput.value = val;

                const actions = document.createElement('div');
                actions.className = 'outfit-value-suggestion-edit-actions';

                const cancelBtn = document.createElement('button');
                cancelBtn.type = 'button';
                cancelBtn.className =
                    'outfit-value-suggestion-edit-foot outfit-value-suggestion-edit-foot--muted';
                cancelBtn.textContent = '취소';

                const okBtn = document.createElement('button');
                okBtn.type = 'button';
                okBtn.className =
                    'outfit-value-suggestion-edit-foot outfit-value-suggestion-edit-foot--primary';
                okBtn.textContent = '변경';

                const closeEditAndRefresh = () => {
                    refresh();
                    cancelOutfitSuggestionHideForPanel(panel);
                    setTimeout(() => inp.focus(), 0);
                };

                cancelBtn.addEventListener('mousedown', (e) => e.preventDefault());
                okBtn.addEventListener('mousedown', (e) => e.preventDefault());

                cancelBtn.addEventListener('click', () => closeEditAndRefresh());

                okBtn.addEventListener('click', async () => {
                    const appliesToCommittedRow =
                        String(outfitItems[idx]?.value || '').trim() === val;

                    const res = renameOutfitSuggestionInPicker(cat, val, editInput.value);
                    if (!res.ok) return;
                    if (String(val || '').trim() === String(res.newVal || '').trim()) {
                        closeEditAndRefresh();
                        return;
                    }

                    okBtn.disabled = true;
                    try {
                        await StyleLogAPI.renameOutfitItemValueAcrossLogs({
                            category: cat,
                            oldValue: val,
                            newValue: res.newVal
                        });
                    } catch (e) {
                        console.error(e);
                        void showAlert(
                            '다른 기록에 같은 품목명을 바꾸지 못했습니다. 네트워크를 확인한 뒤 다시 시도해 주세요.'
                        );
                    } finally {
                        okBtn.disabled = false;
                    }

                    refreshLocalDraftAfterRenamingOutfitSuggestion(cat, val, res.newVal);

                    if (appliesToCommittedRow) {
                        const inpNow = document.querySelector(
                            `.outfit-item-value-input[data-outfit-value-index="${CSS.escape(
                                String(idx)
                            )}"]`
                        );
                        const cbtn = inpNow
                            ? document.querySelector(
                                  `[data-outfit-commit-index="${CSS.escape(String(idx))}"]`
                              )
                            : null;
                        if (inpNow) inpNow.focus();
                        if (cbtn) refreshOutfitValueCommitBtn(cbtn, idx);
                        cancelOutfitSuggestionHideForPanel(panel);
                        panel.hidden = true;
                        setOutfitSuggestionRowOpenState(panel, false);
                    }
                });

                editInput.addEventListener('keydown', (e) => {
                    if (e.key === 'Escape') {
                        e.preventDefault();
                        closeEditAndRefresh();
                    }
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        okBtn.click();
                    }
                });

                actions.appendChild(cancelBtn);
                actions.appendChild(okBtn);
                row.appendChild(editInput);
                row.appendChild(actions);
                row.scrollIntoView({ block: 'nearest', inline: 'nearest' });
                setTimeout(() => {
                    editInput.focus();
                    editInput.select();
                }, 0);
            };

            selBtn.addEventListener('mousedown', (e) => e.preventDefault());
            selBtn.addEventListener('click', () => applyValueFromSuggestion(val));

            editBtn.addEventListener('mousedown', (e) => e.preventDefault());
            editBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                openInlineEdit();
            });

            delBtn.addEventListener('mousedown', (e) => e.preventDefault());
            delBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                removeOutfitSuggestionFromPicker(cat, val);
                if (String(outfitItems[idx].value || '').trim() === val) {
                    inp.value = '';
                    outfitItems[idx].value = '';
                    outfitItems[idx].valueDraft = '';
                    syncOutfitItemsHiddenInput();
                    const cbtn = document.querySelector(
                        `[data-outfit-commit-index="${CSS.escape(String(idx))}"]`
                    );
                    refreshOutfitValueCommitBtn(cbtn, idx);
                }
                refresh();
                cancelOutfitSuggestionHideForPanel(panel);
            });

            row.appendChild(selBtn);
            row.appendChild(editBtn);
            row.appendChild(delBtn);
            listEl.appendChild(row);
        });

        panel.appendChild(listEl);

        panel.hidden = false;
        setOutfitSuggestionRowOpenState(panel, true);
    };

    const bumpSuggestionPanelInteraction = () => {
        inp._outfitSuggestionInteractUntil = performance.now() + 900;
    };

    panel.addEventListener(
        'pointerdown',
        () => {
            bumpSuggestionPanelInteraction();
            cancelOutfitSuggestionHideForPanel(panel);
        },
        true
    );
    panel.addEventListener(
        'touchstart',
        () => bumpSuggestionPanelInteraction(),
        { passive: true, capture: true }
    );
    panel.addEventListener(
        'touchmove',
        () => bumpSuggestionPanelInteraction(),
        { passive: true, capture: true }
    );
    panel.addEventListener(
        'wheel',
        () => bumpSuggestionPanelInteraction(),
        { passive: true, capture: true }
    );

    /** 데스크톱: 스크롤·빈 영역 탭 시 입력 블러 → 레이어가 바로 닫히는 것 방지(버튼은 그대로) */
    panel.addEventListener(
        'mousedown',
        (e) => {
            if (e.button !== 0) return;
            if (e.target.closest('button, input, textarea, [contenteditable], a')) return;
            if (!panel.closest('.outfit-value-field')) return;
            e.preventDefault();
        },
        true
    );

    inp.addEventListener('focus', () => {
        window.clearTimeout(inp._outfitFocusOutHideT);
        window.clearTimeout(inp._outfitFocusOutCommitT);
        inp._outfitFocusOutHideT = null;
        inp._outfitFocusOutCommitT = null;
        inp._outfitSuggestionInteractUntil = 0;
        cancelOutfitSuggestionHideForPanel(panel);
        refresh();
    });
    inp.addEventListener('input', refresh);
    inp.addEventListener('pointerdown', () => {
        cancelOutfitSuggestionHideForPanel(panel);
        setTimeout(refresh, 0);
    });
    inp.addEventListener('focusout', () => {
        cancelOutfitSuggestionHideForPanel(panel);
        window.clearTimeout(inp._outfitFocusOutHideT);
        window.clearTimeout(inp._outfitFocusOutCommitT);

        const runHideDecision = () => {
            inp._outfitFocusOutHideT = null;
            const aeHide = document.activeElement;
            if (aeHide instanceof Node && panel.contains(aeHide)) {
                cancelOutfitSuggestionHideForPanel(panel);
                return;
            }
            const until = inp._outfitSuggestionInteractUntil || 0;
            if (performance.now() < until) {
                const wait = Math.max(32, Math.ceil(until - performance.now()) + 8);
                inp._outfitFocusOutHideT = window.setTimeout(runHideDecision, wait);
                return;
            }
            hideOutfitValueSuggestionSoon(panel);
        };
        inp._outfitFocusOutHideT = window.setTimeout(runHideDecision, 120);

        const idx = parseInt(inp.getAttribute('data-outfit-value-index'), 10);
        inp._outfitFocusOutCommitT = window.setTimeout(() => {
            inp._outfitFocusOutCommitT = null;
            if (!inp.isConnected) return;
            if (document.activeElement === inp) return;
            const ae = document.activeElement;
            const rowWrap = inp.closest('.outfit-item-row');
            if (rowWrap && ae instanceof Node && rowWrap.contains(ae)) return;
            if (ae instanceof Node && panel.contains(ae)) return;
            if (performance.now() < (inp._outfitSuggestionInteractUntil || 0)) return;
            if (Number.isNaN(idx) || !outfitItems[idx]) return;
            const row = outfitItems[idx];
            if (!String(row.category || '').trim()) return;
            const draftTrim = inp.value.trim();
            const valTrim = String(row.value || '').trim();
            const hasTyped = draftTrim.length > 0;
            const dirty = draftTrim !== valTrim;
            if (!dirty && !hasTyped) return;
            commitOutfitItemValue(idx);
        }, 520);
    });
    inp.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            cancelOutfitSuggestionHideForPanel(panel);
            panel.hidden = true;
            setOutfitSuggestionRowOpenState(panel, false);
        }
    });
}

function mergeOutfitCategoryOptions() {
    const ordered = [...OUTFIT_DEFAULT_CATEGORIES];
    outfitItems.forEach((row) => {
        const t = String(row.category || '').trim();
        if (t && !ordered.includes(t)) ordered.push(t);
    });
    return ordered;
}

function updateOutfitItemsCountBadge() {
    const badge = document.getElementById('outfitItemsCountBadge');
    if (badge) {
        badge.textContent = `${outfitItemsForSave().length}개`;
    }
}

function syncOutfitItemsHiddenInput() {
    const el = document.getElementById('itemsJsonInput');
    if (el) {
        const snapshot = outfitItems.map((r) => ({
            category: String(r.category || '').trim(),
            value: String(r.value || '').trim()
        }));
        el.value = JSON.stringify(snapshot);
    }
}

/** 작성 중 필드 문자열 (= 확정 value 와 다를 수 있음) */
function getOutfitItemDraftString(row) {
    if (!row || typeof row !== 'object') return '';
    return String(row.valueDraft !== undefined && row.valueDraft !== null ? row.valueDraft : row.value ?? '');
}

/** 저장된 확정값이 있고, 입력 초안과 같을 때(= 수정 모드 레이블) */
function isOutfitRowCommittedClean(index) {
    const row = outfitItems[index];
    if (!row) return false;
    if (!String(row.category || '').trim()) return false;
    const draftTrim = String(getOutfitItemDraftString(row)).trim();
    const valTrim = String(row.value || '').trim();
    if (!valTrim) return false;
    return draftTrim === valTrim;
}

/** 확정값이 채워진 행에서 '수정'과 같이 목록 재오픈 (전체 후보 표시 후 포커스) */
function beginEditingOutfitValueWithSuggestions(index) {
    const inp = document.querySelector(
        `.outfit-item-value-input[data-outfit-value-index="${CSS.escape(String(index))}"]`
    );
    const field = inp?.closest?.('.outfit-value-field');
    const panel = field?.querySelector?.('.outfit-value-suggestions');
    if (!(inp instanceof HTMLInputElement) || !(panel instanceof HTMLElement)) return;

    inp._outfitShowFullSuggestionsOnce = true;
    /* 수정 직후 pointerdown 등으로 인한 즉시 refresh 가 다시 패널을 접지 않도록 */
    inp._outfitBypassSuggestExactHideUntil = performance.now() + 1400;

    hideOtherOutfitSuggestionPanels(panel);
    cancelOutfitSuggestionHideForPanel(panel);

    inp.focus({ preventScroll: false });
}

function refreshOutfitValueCommitBtn(btn, index) {
    if (!btn || !outfitItems[index]) return;
    const row = outfitItems[index];
    const hasCat = String(row.category || '').trim().length > 0;
    if (!hasCat) {
        btn.disabled = true;
        btn.textContent = '입력';
        btn.setAttribute('aria-label', '품목명 확정');
        btn.classList.remove('outfit-item-value-commit--dirty');
        return;
    }
    const draftTrim = String(getOutfitItemDraftString(row)).trim();
    const valTrim = String(row.value || '').trim();
    const dirty = draftTrim !== valTrim;
    const hasTyped = draftTrim.length > 0;

    if (valTrim.length > 0 && !dirty) {
        btn.disabled = false;
        btn.textContent = '수정';
        btn.setAttribute('aria-label', '품목명 수정 — 최근 품목에서 다시 고르기');
        btn.classList.remove('outfit-item-value-commit--dirty');
        return;
    }

    btn.textContent = '입력';
    btn.setAttribute('aria-label', '품목명 확정');

    /* 확정값과 글자가 같아도, 필드에 글자가 있으면 다시 확정할 수 있게 함(지웠다 같은 이름 재입력 등) */
    const canCommit = dirty || hasTyped;
    btn.disabled = !canCommit;
    btn.classList.toggle('outfit-item-value-commit--dirty', dirty);
}

/** 품목명 확정 → 저장 스냅샷·최근 품목 후보 반영 */
function commitOutfitItemValue(index) {
    const row = outfitItems[index];
    const inp = document.querySelector(
        `.outfit-item-value-input[data-outfit-value-index="${CSS.escape(String(index))}"]`
    );
    if (!row || !inp) return;
    const cat = String(row.category || '').trim();
    if (!cat) return;
    const next = inp.value.trim();
    row.value = next;
    row.valueDraft = next;
    inp.value = next;
    if (next.length > 0) {
        removeOutfitSuggestionBlockedValue(cat, next);
    }
    rememberOutfitValueSuggestion(cat, next);
    syncOutfitItemsHiddenInput();
    const btn = document.querySelector(
        `[data-outfit-commit-index="${CSS.escape(String(index))}"]`
    );
    refreshOutfitValueCommitBtn(btn, index);
}

/** 저장용: 구분·내용이 모두 비어 있지 않은 행만 */
function outfitItemsForSave() {
    return outfitItems
        .map((r) => ({
            category: String(r.category || '').trim(),
            value: String(r.value || '').trim()
        }))
        .filter((r) => r.category.length > 0 && r.value.length > 0);
}

async function loadWriteWardrobeCatalog() {
    try {
        writeWardrobeCatalog = mergeWardrobeCatalogWithExtras(
            await StyleLogAPI.getWardrobeCatalog()
        );
    } catch (e) {
        console.error('옷장 로드 오류:', e);
        writeWardrobeCatalog = [];
    }
}

function getActiveWriteWardrobeItems() {
    const blocked = getOutfitSuggestionBlockedMap();
    return writeWardrobeCatalog.filter(
        (it) => !isOutfitItemHiddenInMap(blocked, it.category, it.value)
    );
}

function outfitItemKey(category, value) {
    return `${normalizeOutfitCategoryKey(category)}\0${String(value || '').trim()}`;
}

function isDuplicateOutfitItem(category, value, exceptIndex = null) {
    const key = outfitItemKey(category, value);
    if (!String(value || '').trim()) return false;
    return outfitItems.some((row, i) => {
        if (exceptIndex != null && i === exceptIndex) return false;
        return outfitItemKey(row.category, row.value) === key;
    });
}

function findOutfitItemIndexByCategoryValue(category, value) {
    const key = outfitItemKey(category, value);
    if (!String(value || '').trim()) return -1;
    return outfitItems.findIndex(
        (row) => outfitItemKey(row.category, row.value) === key && String(row.value || '').trim()
    );
}

function removeOutfitItemAtIndex(idx, options = {}) {
    const render = options.render !== false;
    if (idx < 0 || idx >= outfitItems.length) return false;
    outfitItems.splice(idx, 1);
    sortOutfitItemsInPlace();
    syncOutfitItemsHiddenInput();
    if (render) renderOutfitItemRows();
    return true;
}

function addWardrobeItemToOutfitItems(cat, val, options = {}) {
    const render = options.render !== false;
    outfitItems.push({ category: cat, value: val, valueDraft: val });
    rememberOutfitValueSuggestion(cat, val);
    sortOutfitItemsInPlace();
    syncOutfitItemsHiddenInput();
    if (render) renderOutfitItemRows();
    return true;
}

/** 옷장 시트 열린 상태 — 착장 품목 행·피커 목록을 한 프레임에 갱신 (깜빡임 완화) */
function refreshOutfitRowsAndWardrobePickerList() {
    requestAnimationFrame(() => {
        renderOutfitItemRows();
        if (document.getElementById('outfitWardrobePickerSheet')?.classList.contains('active')) {
            renderOutfitWardrobePickerList();
        }
    });
}

/** 옷장 시트 — 행 지정 모드는 채우기, 여러 개 추가 모드는 탭으로 추가·재탭으로 제거 */
function handleWardrobePickerItemClick(item) {
    const cat = String(item.category || '').trim();
    const val = String(item.value || '').trim();
    if (!cat || !val) return 'noop';

    const rowIdx = outfitWardrobePickerRowIndex;
    const existingIdx = findOutfitItemIndexByCategoryValue(cat, val);

    if (rowIdx != null && rowIdx >= 0 && rowIdx < outfitItems.length) {
        if (existingIdx >= 0 && existingIdx !== rowIdx) {
            void showAlert('다른 착장 품목 줄에 이미 있어요.');
            return 'blocked';
        }
        outfitItems[rowIdx].category = cat;
        outfitItems[rowIdx].value = val;
        outfitItems[rowIdx].valueDraft = val;
        rememberOutfitValueSuggestion(cat, val);
        syncOutfitItemsHiddenInput();
        renderOutfitItemRows();
        return 'row-filled';
    }

    if (existingIdx >= 0) {
        removeOutfitItemAtIndex(existingIdx, { render: false });
        return 'removed';
    }

    addWardrobeItemToOutfitItems(cat, val, { render: false });
    return 'added';
}

function applyWardrobePickToOutfit(item, options = {}) {
    if (options.forceAdd) {
        const cat = String(item.category || '').trim();
        const val = String(item.value || '').trim();
        if (!cat || !val) return false;
        const rowIdx = outfitWardrobePickerRowIndex;
        if (rowIdx != null && rowIdx >= 0 && rowIdx < outfitItems.length) {
            const existingIdx = findOutfitItemIndexByCategoryValue(cat, val);
            if (existingIdx >= 0 && existingIdx !== rowIdx) {
                void showAlert('다른 착장 품목 줄에 이미 있어요.');
                return false;
            }
            outfitItems[rowIdx].category = cat;
            outfitItems[rowIdx].value = val;
            outfitItems[rowIdx].valueDraft = val;
            rememberOutfitValueSuggestion(cat, val);
            syncOutfitItemsHiddenInput();
            refreshOutfitRowsAndWardrobePickerList();
            return true;
        }
        if (findOutfitItemIndexByCategoryValue(cat, val) >= 0) return true;
        addWardrobeItemToOutfitItems(cat, val, { render: false });
        refreshOutfitRowsAndWardrobePickerList();
        return true;
    }
    const result = handleWardrobePickerItemClick(item);
    return result === 'added' || result === 'row-filled';
}

function getOutfitWardrobePickerCategoryOptions() {
    const active = getActiveWriteWardrobeItems();
    const allowed = outfitWardrobePickerAllowedCats;
    const baseCats =
        allowed && allowed.length
            ? [...allowed]
            : [...OUTFIT_DEFAULT_CATEGORIES];
    const seen = new Set(baseCats);
    active.forEach((it) => {
        const c = String(it.category || '').trim();
        if (c && !seen.has(c)) {
            seen.add(c);
            baseCats.push(c);
        }
    });
    if (allowed && allowed.length) {
        return baseCats.filter((c) => allowed.includes(c));
    }
    return baseCats;
}

function ensureOutfitWardrobePickerCategory() {
    const cats = getOutfitWardrobePickerCategoryOptions();
    if (!cats.includes(outfitWardrobePickerCatFilter)) {
        outfitWardrobePickerCatFilter = cats[0] || '';
    }
    return cats;
}

function renderOutfitWardrobePickerChips() {
    const wrap = document.getElementById('outfitWardrobePickerChips');
    if (!wrap) return;
    const cats = ensureOutfitWardrobePickerCategory();
    wrap.innerHTML = '';
    const mk = (label, key, iconHtml) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className =
            'outfit-wardrobe-picker-chip' +
            (outfitWardrobePickerCatFilter === key ? ' is-active' : '');
        btn.setAttribute('role', 'tab');
        btn.setAttribute('aria-selected', outfitWardrobePickerCatFilter === key ? 'true' : 'false');
        if (iconHtml) {
            const icon = document.createElement('span');
            icon.className = 'outfit-wardrobe-picker-chip-icon';
            icon.innerHTML = iconHtml;
            btn.appendChild(icon);
        }
        const text = document.createElement('span');
        text.textContent = label;
        btn.appendChild(text);
        btn.addEventListener('click', () => {
            outfitWardrobePickerCatFilter = key;
            renderOutfitWardrobePickerChips();
            renderOutfitWardrobePickerList();
        });
        wrap.appendChild(btn);
    };
    cats.forEach((c) => mk(c, c, getOutfitCategoryIconMarkup(c)));
}

const OUTFIT_RENAME_ICON =
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>';

async function renameWriteWardrobePickerItem(it, btn) {
    if (outfitWardrobeRenameBusy) return;
    const cat = String(it.category || '').trim();
    const oldVal = String(it.value || '').trim();
    if (!cat || !oldVal) return;

    const next = await showPrompt('품목 이름을 수정할까요?', {
        defaultValue: oldVal,
        confirmText: '변경',
        hint: '이름을 바꾸면 지난 기록과 옷장에도 반영돼요.',
        maxLength: OUTFIT_ITEM_VALUE_MAX_LEN
    });
    const pickerStillOpen = document
        .getElementById('outfitWardrobePickerSheet')
        ?.classList.contains('active');
    if (pickerStillOpen) document.body.style.overflow = 'hidden';
    if (next == null) return;

    const newVal = String(next).trim();
    if (!newVal) {
        await showAlert('품목명을 입력해 주세요.');
        if (pickerStillOpen) document.body.style.overflow = 'hidden';
        return;
    }
    if (newVal === oldVal) return;
    if (
        getActiveWriteWardrobeItems().some(
            (row) => row.category === cat && row.value === newVal
        )
    ) {
        await showAlert('이미 옷장에 있는 이름이에요.');
        if (pickerStillOpen) document.body.style.overflow = 'hidden';
        return;
    }

    outfitWardrobeRenameBusy = true;
    if (btn) btn.disabled = true;
    try {
        const res = renameOutfitSuggestionInPicker(cat, oldVal, newVal);
        if (!res.ok) return;
        await StyleLogAPI.renameOutfitItemValueAcrossLogs({
            category: cat,
            oldValue: oldVal,
            newValue: res.newVal
        });
        refreshLocalDraftAfterRenamingOutfitSuggestion(cat, oldVal, res.newVal);
        writeWardrobeCatalog.forEach((row) => {
            if (row.category === cat && row.value === oldVal) row.value = res.newVal;
        });
        await loadWriteWardrobeCatalog();
        renderOutfitItemRows();
        if (document.getElementById('outfitWardrobePickerSheet')?.classList.contains('active')) {
            renderOutfitWardrobePicker();
        }
    } catch (e) {
        console.error(e);
        await showAlert('이름을 바꾸지 못했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
        outfitWardrobeRenameBusy = false;
        if (btn) btn.disabled = false;
        if (document.getElementById('outfitWardrobePickerSheet')?.classList.contains('active')) {
            document.body.style.overflow = 'hidden';
        }
    }
}

function renderOutfitWardrobePickerList() {
    const listEl = document.getElementById('outfitWardrobePickerList');
    const emptyEl = document.getElementById('outfitWardrobePickerEmpty');
    if (!listEl) return;

    const q = outfitWardrobePickerSearchQuery.trim().toLowerCase();
    let items = getActiveWriteWardrobeItems();
    const allowed = outfitWardrobePickerAllowedCats;
    if (allowed && allowed.length) {
        const allowSet = new Set(allowed);
        items = items.filter((it) => allowSet.has(it.category));
    }
    if (outfitWardrobePickerCatFilter) {
        items = items.filter((it) => it.category === outfitWardrobePickerCatFilter);
    }
    if (q) {
        items = items.filter((it) => String(it.value).toLowerCase().includes(q));
    }
    items.sort((a, b) => {
        const d = outfitCategorySortRank(a.category) - outfitCategorySortRank(b.category);
        if (d !== 0) return d;
        return String(a.value).localeCompare(String(b.value), 'ko');
    });

    listEl.innerHTML = '';
    if (emptyEl) emptyEl.hidden = items.length > 0;

    items.forEach((it) => {
        const alreadyInOutfit =
            findOutfitItemIndexByCategoryValue(it.category, it.value) >= 0;
        const row = document.createElement('div');
        row.className = 'outfit-wardrobe-picker-row';

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className =
            'outfit-wardrobe-picker-item' + (alreadyInOutfit ? ' is-selected' : '');
        btn.setAttribute('role', 'option');
        btn.setAttribute('aria-selected', alreadyInOutfit ? 'true' : 'false');
        if (alreadyInOutfit) {
            btn.setAttribute('aria-label', `${it.value}, 착장 품목에 추가됨. 다시 탭하면 빼요.`);
        }

        const name = document.createElement('span');
        name.className = 'outfit-wardrobe-picker-item-name';
        name.textContent = it.value;

        const meta = document.createElement('span');
        meta.className = 'outfit-wardrobe-picker-item-meta';
        if (alreadyInOutfit) {
            meta.textContent = '추가됨';
        } else if (it.wearCount > 0) {
            meta.textContent = `${it.wearCount}회`;
        } else {
            meta.textContent = it.category;
        }

        btn.appendChild(name);
        btn.appendChild(meta);
        btn.addEventListener('click', () => {
            const result = handleWardrobePickerItemClick(it);
            if (result === 'blocked' || result === 'noop') return;
            if (result === 'row-filled') {
                closeOutfitWardrobePickerSheet();
                return;
            }
            if (result === 'removed' || result === 'added') {
                refreshOutfitRowsAndWardrobePickerList();
            }
        });

        const renameBtn = document.createElement('button');
        renameBtn.type = 'button';
        renameBtn.className = 'outfit-wardrobe-picker-rename';
        renameBtn.innerHTML = OUTFIT_RENAME_ICON;
        renameBtn.setAttribute('aria-label', `${it.value} 이름 바꾸기`);
        renameBtn.addEventListener('click', () => {
            void renameWriteWardrobePickerItem(it, renameBtn);
        });

        row.appendChild(btn);
        row.appendChild(renameBtn);
        listEl.appendChild(row);
    });
}

function renderOutfitWardrobePicker() {
    renderOutfitWardrobePickerChips();
    renderOutfitWardrobePickerList();
    const hint = document.getElementById('outfitWardrobePickerHint');
    if (hint) {
        if (outfitWardrobePickerRowIndex != null) {
            setUiCopyLines(hint, ['고른 옷이 이 착장 품목 줄에 들어가요.']);
        } else {
            setUiCopyLines(hint, [
                '구분을 고른 뒤 옷을 탭하세요. 연필로 이름을 바꿔요.',
                '다시 탭하면 빼요. 끝나면 선택 완료.'
            ]);
        }
    }
}

function showOutfitWardrobePickerSheet() {
    const sheet = document.getElementById('outfitWardrobePickerSheet');
    if (!sheet) return;
    renderOutfitWardrobePicker();
    sheet.classList.add('active');
    sheet.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
}

function openOutfitWardrobePicker(options = {}) {
    hideAllOutfitValueSuggestionPanels();
    outfitWardrobePickerRowIndex =
        typeof options.rowIndex === 'number' ? options.rowIndex : null;
    outfitWardrobePickerAllowedCats = options.categories
        ? [...options.categories]
        : null;
    outfitWardrobePickerSearchQuery = '';
    const search = document.getElementById('outfitWardrobePickerSearch');
    if (search) search.value = '';

    if (options.categories && options.categories.length === 1) {
        outfitWardrobePickerCatFilter = options.categories[0];
    } else if (
        outfitWardrobePickerRowIndex != null &&
        outfitItems[outfitWardrobePickerRowIndex]
    ) {
        const rowCat = String(outfitItems[outfitWardrobePickerRowIndex].category || '').trim();
        outfitWardrobePickerCatFilter = rowCat || '';
    } else {
        outfitWardrobePickerCatFilter = '';
    }
    ensureOutfitWardrobePickerCategory();

    outfitWardrobePickerReturnEl = options.returnFocusEl || null;
    showOutfitWardrobePickerSheet();
}

function openOutfitWardrobePickerForRow(rowIndex) {
    const row = outfitItems[rowIndex];
    const cat = String(row?.category || '').trim();
    if (!cat) {
        openOutfitCategorySheet(rowIndex);
        return;
    }
    const btn = document.querySelector(
        `[data-outfit-pick-index="${CSS.escape(String(rowIndex))}"]`
    );
    openOutfitWardrobePicker({
        rowIndex,
        categories: [cat],
        returnFocusEl: btn
    });
}

function clearOutfitSheetMotion(sheet) {
    const panel = sheet?.querySelector('.outfit-category-sheet__panel');
    if (!panel) return;
    panel.classList.remove('is-dragging');
    panel.style.transition = '';
    panel.style.transform = '';
}

/** 손잡이를 아래로 끌면 시트를 닫는다. 조금만 움직이면 제자리로 돌아온다. */
function bindOutfitSheetSwipeDismiss(sheet, closeFn) {
    const panel = sheet?.querySelector('.outfit-category-sheet__panel');
    const handle = sheet?.querySelector('.outfit-category-sheet__handle');
    if (!panel || !handle || sheet.dataset.swipeBound === '1') return;
    sheet.dataset.swipeBound = '1';

    const DISMISS_PX = 88;
    let startY = 0;
    let lastY = 0;
    let lastT = 0;
    let dragY = 0;
    let velocity = 0;
    let dragging = false;
    let pointerId = null;
    let gesture = 0;

    handle.addEventListener('pointerdown', (e) => {
        if (!sheet.classList.contains('active')) return;
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        dragging = true;
        pointerId = e.pointerId;
        gesture += 1;
        startY = e.clientY;
        lastY = e.clientY;
        lastT = e.timeStamp;
        dragY = 0;
        velocity = 0;
        panel.classList.add('is-dragging');
        panel.style.transition = 'none';
        panel.style.transform = 'translateY(0px)';
        try {
            handle.setPointerCapture(e.pointerId);
        } catch (_) {
            /* 캡처를 못 해도 move/up 은 핸들 위에서 이어진다 */
        }
    });

    handle.addEventListener('pointermove', (e) => {
        if (!dragging || e.pointerId !== pointerId) return;
        const dy = Math.max(0, e.clientY - startY);
        const dt = e.timeStamp - lastT;
        if (dt > 0) velocity = (e.clientY - lastY) / dt;
        lastY = e.clientY;
        lastT = e.timeStamp;
        dragY = dy;
        panel.style.transform = `translateY(${dy}px)`;
    });

    const endDrag = (e) => {
        if (!dragging || e.pointerId !== pointerId) return;
        dragging = false;
        pointerId = null;
        const token = gesture;
        const shouldClose = dragY > DISMISS_PX || (dragY > 36 && velocity > 0.65);
        let settled = false;
        const settle = () => {
            if (settled || token !== gesture) return;
            settled = true;
            window.clearTimeout(timer);
            panel.removeEventListener('transitionend', done);
            if (shouldClose) {
                closeFn();
                return;
            }
            panel.style.transition = '';
            panel.style.transform = '';
        };
        const done = (ev) => {
            if (ev.propertyName !== 'transform') return;
            settle();
        };
        const timer = window.setTimeout(settle, 280);
        panel.style.transition = shouldClose
            ? 'transform 0.2s ease'
            : 'transform 0.22s cubic-bezier(0.32, 0.72, 0, 1)';
        panel.style.transform = shouldClose ? 'translateY(110%)' : 'translateY(0px)';
        panel.addEventListener('transitionend', done);
    };

    handle.addEventListener('pointerup', endDrag);
    handle.addEventListener('pointercancel', endDrag);
}

function closeOutfitWardrobePickerSheet() {
    const sheet = document.getElementById('outfitWardrobePickerSheet');
    if (!sheet) return;
    const active = document.activeElement;
    if (active && typeof active.blur === 'function' && sheet.contains(active)) {
        active.blur();
    }
    sheet.classList.remove('active');
    sheet.setAttribute('aria-hidden', 'true');
    clearOutfitSheetMotion(sheet);
    document.body.style.overflow = '';
    outfitWardrobePickerRowIndex = null;
    outfitWardrobePickerAllowedCats = null;
    outfitWardrobePickerSearchQuery = '';
    const back = outfitWardrobePickerReturnEl;
    outfitWardrobePickerReturnEl = null;
    if (back && document.body.contains(back) && typeof back.focus === 'function') {
        try {
            back.focus();
        } catch (_) {
            /* ignore */
        }
    }
}

function syncWriteWardrobeAddGrid() {
    const grid = document.getElementById('writeWardrobeAddGrid');
    if (!grid) return;
    if (!grid.childElementCount) {
        OUTFIT_DEFAULT_CATEGORIES.forEach((cat) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'outfit-category-pill';
            btn.dataset.category = cat;
            const icon = document.createElement('span');
            icon.className = 'outfit-category-pill-icon';
            icon.innerHTML = getOutfitCategoryIconMarkup(cat);
            const label = document.createElement('span');
            label.textContent = cat;
            btn.appendChild(icon);
            btn.appendChild(label);
            grid.appendChild(btn);
        });
    }
    grid.querySelectorAll('.outfit-category-pill').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.category === writeWardrobeAddCat);
    });
}

function openWriteWardrobeAddSheet() {
    const pref =
        outfitWardrobePickerCatFilter &&
        OUTFIT_DEFAULT_CATEGORIES.includes(outfitWardrobePickerCatFilter)
            ? outfitWardrobePickerCatFilter
            : outfitWardrobePickerAllowedCats &&
                outfitWardrobePickerAllowedCats.length === 1
              ? outfitWardrobePickerAllowedCats[0]
              : writeWardrobeAddCat;
    if (OUTFIT_DEFAULT_CATEGORIES.includes(pref)) writeWardrobeAddCat = pref;

    const sheet = document.getElementById('writeWardrobeAddSheet');
    const input = document.getElementById('writeWardrobeAddName');
    if (!sheet) return;
    syncWriteWardrobeAddGrid();
    if (input) input.value = '';
    sheet.classList.add('active');
    sheet.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    setTimeout(() => input?.focus(), 80);
}

function closeWriteWardrobeAddSheet() {
    const sheet = document.getElementById('writeWardrobeAddSheet');
    if (!sheet || !sheet.classList.contains('active')) return;
    sheet.classList.remove('active');
    sheet.setAttribute('aria-hidden', 'true');
    clearOutfitSheetMotion(sheet);
    const picker = document.getElementById('outfitWardrobePickerSheet');
    if (picker?.classList.contains('active')) {
        document.body.style.overflow = 'hidden';
    } else {
        document.body.style.overflow = '';
    }
}

async function submitWriteWardrobeAdd() {
    if (writeWardrobeAddBusy) return;
    const cat = String(writeWardrobeAddCat || '').trim();
    const input = document.getElementById('writeWardrobeAddName');
    const name = String(input?.value || '').trim();
    if (!cat || !OUTFIT_DEFAULT_CATEGORIES.includes(cat)) {
        await showAlert('구분을 골라 주세요.');
        return;
    }
    if (!name) {
        await showAlert('이름을 입력해 주세요.');
        input?.focus();
        return;
    }
    if (name.length > OUTFIT_ITEM_VALUE_MAX_LEN) {
        await showAlert(`이름은 ${OUTFIT_ITEM_VALUE_MAX_LEN}자 이하로 입력해 주세요.`);
        return;
    }

    const active = getActiveWriteWardrobeItems();
    if (active.some((it) => it.category === cat && it.value === name)) {
        await showAlert('이미 옷장에 있는 이름이에요. 목록에서 선택해 주세요.');
        return;
    }

    const blocked = getOutfitSuggestionBlockedMap();
    if (isOutfitItemHiddenInMap(blocked, cat, name)) {
        removeOutfitSuggestionBlockedValue(cat, name);
    }
    persistOutfitSuggestionExtra(cat, name);

    writeWardrobeAddBusy = true;
    try {
        await loadWriteWardrobeCatalog();
        closeWriteWardrobeAddSheet();
        outfitWardrobePickerCatFilter = cat;
        const picked = applyWardrobePickToOutfit(
            { category: cat, value: name },
            { forceAdd: true }
        );
        if (picked) renderOutfitWardrobePicker();
        if (outfitWardrobePickerRowIndex != null && picked) {
            closeOutfitWardrobePickerSheet();
        }
    } finally {
        writeWardrobeAddBusy = false;
    }
}

function initOutfitWardrobePickerUI() {
    bindOutfitSheetSwipeDismiss(
        document.getElementById('outfitWardrobePickerSheet'),
        closeOutfitWardrobePickerSheet
    );
    bindOutfitSheetSwipeDismiss(
        document.getElementById('writeWardrobeAddSheet'),
        closeWriteWardrobeAddSheet
    );
    bindOutfitSheetSwipeDismiss(
        document.getElementById('outfitCategorySheet'),
        closeOutfitCategorySheet
    );
    document.getElementById('outfitWardrobePickerOverlay')?.addEventListener('click', () => {
        closeOutfitWardrobePickerSheet();
    });
    document.getElementById('outfitWardrobePickerDoneBtn')?.addEventListener('click', () => {
        closeOutfitWardrobePickerSheet();
    });
    document.getElementById('outfitWardrobePickerNewBtn')?.addEventListener('click', () => {
        openWriteWardrobeAddSheet();
    });
    document.getElementById('outfitWardrobePickerSearch')?.addEventListener('input', (e) => {
        outfitWardrobePickerSearchQuery = e.target.value || '';
        renderOutfitWardrobePickerList();
    });

    document.getElementById('writeWardrobeAddOverlay')?.addEventListener('click', () => {
        closeWriteWardrobeAddSheet();
    });
    document.getElementById('writeWardrobeAddGrid')?.addEventListener('click', (e) => {
        const btn = e.target.closest('.outfit-category-pill');
        if (!btn?.dataset.category) return;
        writeWardrobeAddCat = btn.dataset.category;
        syncWriteWardrobeAddGrid();
    });
    document.getElementById('writeWardrobeAddSubmit')?.addEventListener('click', () => {
        submitWriteWardrobeAdd();
    });
    document.getElementById('writeWardrobeAddName')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            submitWriteWardrobeAdd();
        }
    });
}

function renderOutfitItemRows() {
    const list = document.getElementById('outfitItemsList');
    if (!list) return;

    list.innerHTML = '';
    outfitItems.forEach((row, index) => {
        const cat = String(row.category || '').trim();
        const hasCat = cat.length > 0;

        if (row.valueDraft === undefined) {
            row.valueDraft = String(row.value || '');
        }

        const rowEl = document.createElement('div');
        rowEl.className = 'outfit-item-row';

        const catBtn = document.createElement('button');
        catBtn.type = 'button';
        catBtn.className =
            'outfit-item-category-btn' + (hasCat ? '' : ' outfit-item-category-btn--placeholder');
        catBtn.setAttribute('data-outfit-cat-index', String(index));
        catBtn.setAttribute('aria-label', '구분 선택');

        const iconWrap = document.createElement('span');
        iconWrap.className = 'outfit-item-category-icon';
        iconWrap.innerHTML = getOutfitCategoryIconMarkup(hasCat ? cat : '');

        const labelSpan = document.createElement('span');
        labelSpan.className = 'outfit-item-category-label';
        labelSpan.textContent = hasCat ? cat : '구분';

        catBtn.appendChild(iconWrap);
        catBtn.appendChild(labelSpan);

        const valTrim = String(row.value || '').trim();
        const pickBtn = document.createElement('button');
        pickBtn.type = 'button';
        pickBtn.className =
            'outfit-item-pick-btn' + (valTrim ? '' : ' outfit-item-pick-btn--placeholder');
        pickBtn.setAttribute('data-outfit-pick-index', String(index));
        pickBtn.setAttribute('aria-label', valTrim ? '옷장에서 다시 고르기' : '옷장에서 선택');

        const pickLabel = document.createElement('span');
        pickLabel.className = 'outfit-item-pick-btn-label';
        pickLabel.textContent = valTrim || (hasCat ? '옷장에서 선택' : '먼저 구분 선택');

        const chevron = document.createElement('span');
        chevron.className = 'outfit-item-pick-btn-chevron';
        chevron.setAttribute('aria-hidden', 'true');
        chevron.textContent = '›';

        pickBtn.appendChild(pickLabel);
        pickBtn.appendChild(chevron);

        const rm = document.createElement('button');
        rm.type = 'button';
        rm.className = 'outfit-item-remove';
        rm.setAttribute('data-outfit-remove-index', String(index));
        rm.setAttribute('aria-label', '이 품목 삭제');
        rm.innerHTML =
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"></path></svg>';

        rowEl.appendChild(catBtn);
        rowEl.appendChild(pickBtn);
        rowEl.appendChild(rm);
        list.appendChild(rowEl);
    });

    updateOutfitItemsCountBadge();
    syncOutfitItemsHiddenInput();
}

function renderCategorySheetGrid() {
    const grid = document.getElementById('outfitCategoryGrid');
    if (!grid) return;
    const options = mergeOutfitCategoryOptions();
    grid.innerHTML = '';
    grid.setAttribute(
        'aria-multiselectable',
        outfitCategorySheetMode === 'add' ? 'true' : 'false'
    );
    options.forEach((cat) => {
        const selected = outfitCategoryPending.has(cat);
        const pill = document.createElement('button');
        pill.type = 'button';
        pill.className = 'outfit-category-pill' + (selected ? ' active' : '');
        pill.dataset.category = cat;
        pill.setAttribute('aria-pressed', selected ? 'true' : 'false');

        const iconWrap = document.createElement('span');
        iconWrap.className = 'outfit-category-pill-icon';
        iconWrap.innerHTML = getOutfitCategoryIconMarkup(cat);

        const labelSpan = document.createElement('span');
        labelSpan.textContent = cat;

        pill.appendChild(iconWrap);
        pill.appendChild(labelSpan);
        grid.appendChild(pill);
    });
}

function refreshCategorySheetConfirmBtn() {
    const confirmBtn = document.getElementById('outfitCategoryConfirmBtn');
    if (!confirmBtn) return;
    const n = outfitCategoryPending.size;
    confirmBtn.disabled = n === 0;
    if (outfitCategorySheetMode === 'add') {
        confirmBtn.textContent = n > 0 ? `${n}개 추가` : '확인';
    } else {
        confirmBtn.textContent = '확인';
    }
}

function updateCategorySheetCopy() {
    const title = document.getElementById('outfitCategorySheetTitle');
    const hint = document.getElementById('outfitCategorySheetHint');
    if (title) {
        title.textContent = outfitCategorySheetMode === 'edit' ? '구분 변경' : '구분 선택';
    }
    if (hint) {
        if (outfitCategorySheetMode === 'add') {
            hint.hidden = false;
            setUiCopyLines(hint, [
                '구분을 여러 개 고른 뒤',
                '확인하면 한꺼번에 추가돼요.'
            ]);
        } else {
            hint.hidden = true;
            hint.replaceChildren();
        }
    }
    refreshCategorySheetConfirmBtn();
}

function showOutfitCategorySheet() {
    const sheet = document.getElementById('outfitCategorySheet');
    if (!sheet) return;
    updateCategorySheetCopy();
    renderCategorySheetGrid();
    sheet.classList.add('active');
    sheet.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
}

function openOutfitCategorySheetForAdd() {
    hideAllOutfitValueSuggestionPanels();
    const sheet = document.getElementById('outfitCategorySheet');
    if (!sheet) return;
    outfitCategorySheetMode = 'add';
    outfitCategorySheetRowIndex = null;
    outfitCategoryPending = new Set();
    const addBtn = document.getElementById('outfitItemsAddBtn');
    outfitCategorySheetReturnEl =
        addBtn && typeof addBtn.focus === 'function' ? addBtn : null;
    showOutfitCategorySheet();
}

function openOutfitCategorySheet(rowIndex) {
    hideAllOutfitValueSuggestionPanels();
    const sheet = document.getElementById('outfitCategorySheet');
    if (!sheet) return;
    outfitCategorySheetMode = 'edit';
    outfitCategorySheetRowIndex = rowIndex;
    const existing = (outfitItems[rowIndex]?.category || '').trim();
    outfitCategoryPending = new Set();
    if (existing) outfitCategoryPending.add(existing);
    const returnBtn = document.querySelector(
        `[data-outfit-cat-index="${CSS.escape(String(rowIndex))}"]`
    );
    outfitCategorySheetReturnEl =
        returnBtn && typeof returnBtn.focus === 'function' ? returnBtn : null;
    showOutfitCategorySheet();
}

function closeOutfitCategorySheet() {
    const sheet = document.getElementById('outfitCategorySheet');
    if (!sheet) return;

    const active = document.activeElement;
    if (
        active &&
        typeof active.blur === 'function' &&
        sheet.contains(active)
    ) {
        active.blur();
    }

    sheet.classList.remove('active');
    sheet.setAttribute('aria-hidden', 'true');
    clearOutfitSheetMotion(sheet);
    document.body.style.overflow = '';
    outfitCategorySheetRowIndex = null;
    outfitCategoryPending = new Set();

    const back = outfitCategorySheetReturnEl;
    outfitCategorySheetReturnEl = null;
    if (back && document.body.contains(back) && typeof back.focus === 'function') {
        try {
            back.focus();
        } catch (_) {
            /* ignore */
        }
    }
}

function confirmOutfitCategorySheet() {
    const ordered = mergeOutfitCategoryOptions().filter((c) => outfitCategoryPending.has(c));
    if (ordered.length === 0) return;

    if (outfitCategorySheetMode === 'add') {
        closeOutfitCategorySheet();
        const addBtn = document.getElementById('outfitItemsAddBtn');
        openOutfitWardrobePicker({
            categories: ordered,
            returnFocusEl: addBtn
        });
        return;
    }

    if (
        outfitCategorySheetRowIndex == null ||
        outfitCategorySheetRowIndex < 0 ||
        outfitCategorySheetRowIndex >= outfitItems.length
    ) {
        closeOutfitCategorySheet();
        return;
    }
    const rowIdx = outfitCategorySheetRowIndex;
    const targetRow = outfitItems[rowIdx];
    const prevCat = String(targetRow.category || '').trim();
    const nextCat = ordered[0];
    targetRow.category = nextCat;
    if (prevCat !== nextCat) {
        targetRow.value = '';
        targetRow.valueDraft = '';
    }
    sortOutfitItemsInPlace();
    renderOutfitItemRows();
    closeOutfitCategorySheet();
    const sortedIdx = outfitItems.indexOf(targetRow);
    if (sortedIdx >= 0) openOutfitWardrobePickerForRow(sortedIdx);
}

function addOutfitItemRow(openSheetAfter = false) {
    if (openSheetAfter) {
        const addBtn = document.getElementById('outfitItemsAddBtn');
        openOutfitWardrobePicker({
            returnFocusEl: addBtn
        });
        return;
    }
    outfitItems.push({ category: '', value: '', valueDraft: '' });
    renderOutfitItemRows();
}

function removeOutfitItemRow(index) {
    outfitItems.splice(index, 1);
    if (outfitCategorySheetRowIndex === index) {
        closeOutfitCategorySheet();
    }
    renderOutfitItemRows();
}

function initOutfitItemsUI() {
    const list = document.getElementById('outfitItemsList');
    const addBtn = document.getElementById('outfitItemsAddBtn');
    const sheet = document.getElementById('outfitCategorySheet');
    const overlay = document.getElementById('outfitCategorySheetOverlay');
    const confirmBtn = document.getElementById('outfitCategoryConfirmBtn');
    const grid = document.getElementById('outfitCategoryGrid');

    if (!list || !addBtn || !sheet) return;

    initOutfitWardrobePickerUI();

    renderOutfitItemRows();

    addBtn.addEventListener('click', () => {
        addOutfitItemRow(true);
    });

    list.addEventListener('click', (e) => {
        const rm = e.target.closest('[data-outfit-remove-index]');
        if (rm) {
            const i = parseInt(rm.getAttribute('data-outfit-remove-index'), 10);
            if (!Number.isNaN(i)) removeOutfitItemRow(i);
            return;
        }
        const catBtn = e.target.closest('[data-outfit-cat-index]');
        if (catBtn) {
            const i = parseInt(catBtn.getAttribute('data-outfit-cat-index'), 10);
            if (!Number.isNaN(i)) openOutfitCategorySheet(i);
            return;
        }
        const pickBtn = e.target.closest('[data-outfit-pick-index]');
        if (pickBtn) {
            const i = parseInt(pickBtn.getAttribute('data-outfit-pick-index'), 10);
            if (!Number.isNaN(i)) openOutfitWardrobePickerForRow(i);
        }
    });

    overlay?.addEventListener('click', () => {
        closeOutfitCategorySheet();
    });

    confirmBtn?.addEventListener('click', () => {
        confirmOutfitCategorySheet();
    });

    grid?.addEventListener('click', (e) => {
        const pill = e.target.closest('.outfit-category-pill');
        if (!pill || !pill.dataset.category) return;
        const cat = pill.dataset.category;
        if (outfitCategorySheetMode === 'add') {
            if (outfitCategoryPending.has(cat)) outfitCategoryPending.delete(cat);
            else outfitCategoryPending.add(cat);
        } else {
            outfitCategoryPending = new Set([cat]);
        }
        renderCategorySheetGrid();
        refreshCategorySheetConfirmBtn();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        if (isCropModalOpen()) {
            closeCropModal();
            return;
        }
        const addSheet = document.getElementById('writeWardrobeAddSheet');
        if (addSheet?.classList.contains('active')) {
            closeWriteWardrobeAddSheet();
            return;
        }
        const picker = document.getElementById('outfitWardrobePickerSheet');
        if (picker?.classList.contains('active')) {
            closeOutfitWardrobePickerSheet();
            return;
        }
        if (sheet.classList.contains('active')) {
            closeOutfitCategorySheet();
        }
    });
}

// 사진 선택 처리 (여러 장 선택 → FileList 순서 유지 → 드래그로 순서 변경 가능)
function handlePhotoSelect(e) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const canAdd = Math.max(0, 3 - selectedPhotos.length);
    if (canAdd === 0) {
        showAlert('사진은 최대 3장까지 등록할 수 있습니다.');
        e.target.value = '';
        return;
    }
    const filesToAdd = files.slice(0, canAdd);
    if (files.length > canAdd) {
        showAlert(`사진은 최대 3장까지 등록할 수 있습니다. (${files.length - canAdd}장 제외)`);
    }

    const results = new Array(filesToAdd.length);
    let loadedCount = 0;

    filesToAdd.forEach((file, index) => {
        const reader = new FileReader();
        reader.onload = async (event) => {
            const raw = typeof event.target?.result === 'string' ? event.target.result : '';
            const dataUrl = raw ? await dataUrlForCropEditor(raw) : '';
            results[index] = dataUrl ? { file, dataUrl } : null;
            loadedCount++;
            if (loadedCount === filesToAdd.length) {
                cropUploadQueue.push(...results.filter((r) => r?.dataUrl));
                processNextCropInQueue();
            }
        };
        reader.onerror = () => {
            results[index] = null;
            loadedCount++;
            if (loadedCount === filesToAdd.length) {
                cropUploadQueue.push(...results.filter((r) => r?.dataUrl));
                processNextCropInQueue();
            }
        };
        reader.readAsDataURL(file);
    });

    e.target.value = '';
}

// 사진 미리보기 렌더링 (드래그로 순서 변경 가능)
function renderPhotoPreviews() {
    const previewList = document.getElementById('photoPreviewList');
    const reorderHint = document.getElementById('photoReorderHint');
    previewList.innerHTML = '';

    if (selectedPhotos.length > 1 && reorderHint) {
        reorderHint.style.display = 'block';
    } else if (reorderHint) {
        reorderHint.style.display = 'none';
    }

    selectedPhotos.forEach((photo, index) => {
        const item = document.createElement('div');
        item.className = 'photo-preview-item';
        item.draggable = true;
        item.dataset.index = String(index);
        item.innerHTML = `
            <span class="photo-preview-num" aria-label="${index + 1}번째 사진">${index + 1}</span>
            <img src="${photo.dataUrl}" alt="사진 ${index + 1}" draggable="false">
            <button type="button" class="photo-remove-btn" onclick="event.stopPropagation(); removePhoto(${index})">×</button>
            <button type="button" class="photo-edit-btn" onclick="event.stopPropagation(); openCropModal(${index})" title="자르기">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>
            </button>
        `;
        item.addEventListener('pointerdown', handlePhotoPointerDown);
        item.addEventListener('dragstart', handlePhotoDragStart);
        item.addEventListener('dragenter', handlePhotoDragEnter);
        item.addEventListener('dragover', handlePhotoDragOver);
        item.addEventListener('dragleave', handlePhotoDragLeave);
        item.addEventListener('drop', handlePhotoDrop);
        item.addEventListener('dragend', handlePhotoDragEnd);
        item.addEventListener('touchstart', handlePhotoTouchStart, { passive: true });
        item.addEventListener('touchmove', handlePhotoTouchMove, { passive: false });
        item.addEventListener('touchend', handlePhotoTouchEnd);
        item.addEventListener('touchcancel', handlePhotoTouchEnd);
        previewList.appendChild(item);
    });
}

// 삽입선 표시/숨김 (insertPos: 0 ~ n, n=맨 뒤)
function updateInsertLine(insertPos) {
    if (insertLineHideTimer) {
        clearTimeout(insertLineHideTimer);
        insertLineHideTimer = null;
    }
    let line = document.getElementById('photoInsertLine');
    if (!line) {
        line = document.createElement('div');
        line.id = 'photoInsertLine';
        line.className = 'photo-insert-line';
        document.getElementById('photoPreviewList').appendChild(line);
    }
    if (insertPos < 0) {
        insertLineHideTimer = setTimeout(() => {
            line.classList.remove('visible');
            lastInsertPosition = -1;
            insertLineHideTimer = null;
        }, 180);
        return;
    }
    lastInsertPosition = insertPos;
    const list = document.getElementById('photoPreviewList');
    const items = [...list.querySelectorAll('.photo-preview-item')];
    const listRect = list.getBoundingClientRect();
    const gap = 8;
    let left;
    if (items.length === 0) {
        left = 0;
    } else if (insertPos === 0) {
        left = items[0].getBoundingClientRect().left - listRect.left - 2;
    } else if (insertPos >= items.length) {
        const last = items[items.length - 1].getBoundingClientRect();
        left = last.right - listRect.left + gap / 2 - 2;
    } else {
        const prev = items[insertPos - 1].getBoundingClientRect();
        const next = items[insertPos].getBoundingClientRect();
        left = (prev.right + next.left) / 2 - listRect.left - 2;
    }
    line.style.left = `${Math.max(0, left)}px`;
    line.classList.add('visible');
}

// 좌표 → 삽입 위치 (갭 24px 확대, 아이템 40% 구역)
function getInsertPositionFromCoords(clientX, clientY) {
    const list = document.getElementById('photoPreviewList');
    const items = [...list.querySelectorAll('.photo-preview-item')];
    if (items.length === 0) return -1;
    const listRect = list.getBoundingClientRect();
    const x = clientX - listRect.left;
    const GAP = 24;
    for (let i = 0; i < items.length; i++) {
        const r = items[i].getBoundingClientRect();
        const left = r.left - listRect.left;
        const right = r.right - listRect.left;
        const zone = (right - left) * 0.4;
        if (x < left - GAP) return i;
        if (x < left + zone) return i;
        if (x <= right - zone) return i + 1;
        if (x <= right + GAP) return i + 1;
    }
    return items.length;
}

// 아이템 위 좌표 → 삽입 위치 (40% 구역)
function getInsertPositionFromItem(item, clientX) {
    const idx = parseInt(item.dataset.index, 10);
    const rect = item.getBoundingClientRect();
    const zone = rect.width * 0.4;
    return clientX < rect.left + zone ? idx : idx + 1;
}

function clearPhotoDraggingState() {
    document.querySelectorAll('.photo-preview-item.photo-preview-dragging').forEach(el => el.classList.remove('photo-preview-dragging'));
}

// 플로팅 드래그 클론 (손가락/커서 따라다님)
function createDragGhost(sourceItem) {
    if (dragGhostEl) return dragGhostEl;
    const ghost = sourceItem.cloneNode(true);
    ghost.id = 'photoDragGhost';
    ghost.className = 'photo-preview-item photo-drag-ghost';
    ghost.querySelectorAll('.photo-remove-btn, .photo-edit-btn').forEach(b => b.remove());
    ghost.style.cssText = 'position:fixed;pointer-events:none;z-index:9998;width:78px;height:104px;opacity:0.95;transform:scale(1.05);box-shadow:0 8px 24px rgba(0,0,0,0.2);border:2px solid var(--color-primary);border-radius:8px;overflow:hidden;';
    document.body.appendChild(ghost);
    dragGhostEl = ghost;
    return ghost;
}
function updateDragGhost(clientX, clientY) {
    if (!dragGhostEl) return;
    const size = 100;
    const offset = size / 2;
    dragGhostEl.style.left = `${clientX - offset}px`;
    dragGhostEl.style.top = `${clientY - offset}px`;
}
function removeDragGhost() {
    if (dragGhostEl) {
        dragGhostEl.remove();
        dragGhostEl = null;
    }
}

// 포인터 다운 - 즉시 시각적 피드백 (클릭/터치 직후)
function handlePhotoPointerDown(e) {
    if (e.target.closest('.photo-remove-btn, .photo-edit-btn')) return;
    e.currentTarget.classList.add('photo-preview-dragging');
}

// 드래그 시작 - 플로팅 클론 생성
function handlePhotoDragStart(e) {
    if (e.target.closest('.photo-remove-btn, .photo-edit-btn')) {
        e.preventDefault();
        return;
    }
    const item = e.currentTarget;
    const index = parseInt(item.dataset.index, 10);
    draggingPhotoIndex = index;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
    e.dataTransfer.setData('application/x-photo-index', String(index));
    try { e.dataTransfer.setDragImage(document.createElement('div'), 0, 0); } catch (_) {} // 기본 고스트 숨김
    createDragGhost(item);
    updateDragGhost(e.clientX, e.clientY);
    item.classList.add('photo-preview-dragging');
}

// 드래그 진입
function handlePhotoDragEnter(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
}

// 드래그 오버 - 플로팅 클론 위치 + 삽입선
function handlePhotoDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    updateDragGhost(e.clientX, e.clientY);
    const item = e.currentTarget;
    if (item.classList.contains('photo-preview-dragging')) return;
    const pos = getInsertPositionFromItem(item, e.clientX);
    const fromIndex = draggingPhotoIndex;
    if (pos !== fromIndex && pos !== fromIndex + 1) {
        updateInsertLine(pos);
    } else {
        updateInsertLine(-1);
    }
}

// 드래그 영역 이탈 - 리스트 밖으로 나가면 삽입선 제거
function handlePhotoDragLeave(e) {
    const item = e.currentTarget;
    const related = e.relatedTarget;
    if (!related || !related.closest('.photo-preview-list')) {
        updateInsertLine(-1);
    }
}

// 드롭 - 삽입선 위치에 맞게 순서 변경
function handlePhotoDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    removeDragGhost();
    if (insertLineHideTimer) clearTimeout(insertLineHideTimer);
    insertLineHideTimer = null;
    const line = document.getElementById('photoInsertLine');
    if (line) line.classList.remove('visible');

    const fromIndex = draggingPhotoIndex !== null
        ? draggingPhotoIndex
        : parseInt(e.dataTransfer.getData('text/plain') || e.dataTransfer.getData('application/x-photo-index'), 10);
    const insertPos = lastInsertPosition;

    if (insertPos < 0 || insertPos === fromIndex || insertPos === fromIndex + 1 || isNaN(fromIndex)) {
        draggingPhotoIndex = null;
        return;
    }

    const [moved] = selectedPhotos.splice(fromIndex, 1);
    const insertIndex = fromIndex < insertPos ? insertPos - 1 : insertPos;
    selectedPhotos.splice(insertIndex, 0, moved);
    draggingPhotoIndex = null;
    renderPhotoPreviews();
}

// 드래그 끝 - 플로팅 클론·삽입선 제거
function handlePhotoDragEnd(e) {
    e.currentTarget.classList.remove('photo-preview-dragging');
    removeDragGhost();
    if (insertLineHideTimer) clearTimeout(insertLineHideTimer);
    insertLineHideTimer = null;
    const line = document.getElementById('photoInsertLine');
    if (line) line.classList.remove('visible');
    lastInsertPosition = -1;
    draggingPhotoIndex = null;
}

// 터치: 짧게/길게 누르면 모두 이동 모드
function handlePhotoTouchStart(e) {
    if (e.target.closest('.photo-remove-btn, .photo-edit-btn')) return;
    const item = e.currentTarget;
    const idx = parseInt(item.dataset.index, 10);
    item.classList.add('photo-preview-dragging');
    touchDragState = { fromIndex: idx, itemEl: item, startY: e.touches[0].clientY, isDragging: true, lastInsertPosition: -1 };
}

// 터치: 이동 중 - 플로팅 클론 + 삽입선
function handlePhotoTouchMove(e) {
    if (!touchDragState) return;
    e.preventDefault();
    const touch = e.touches[0];
    createDragGhost(touchDragState.itemEl);
    updateDragGhost(touch.clientX, touch.clientY);
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    const targetItem = el?.closest('.photo-preview-item');
    const insertPos = targetItem
        ? getInsertPositionFromItem(targetItem, touch.clientX)
        : getInsertPositionFromCoords(touch.clientX, touch.clientY);
    if (insertPos >= 0 && insertPos !== touchDragState.fromIndex && insertPos !== touchDragState.fromIndex + 1) {
        updateInsertLine(insertPos);
        touchDragState.lastInsertPosition = insertPos;
    } else {
        updateInsertLine(-1);
        touchDragState.lastInsertPosition = -1;
    }
}

// 터치: 손가락 뗄 때 순서 변경
function handlePhotoTouchEnd(e) {
    if (!touchDragState) return;
    clearPhotoDraggingState();
    removeDragGhost();
    if (insertLineHideTimer) clearTimeout(insertLineHideTimer);
    insertLineHideTimer = null;
    const line = document.getElementById('photoInsertLine');
    if (line) line.classList.remove('visible');
    if (touchDragState.isDragging && touchDragState.lastInsertPosition >= 0) {
        const insertPos = touchDragState.lastInsertPosition;
        const fromIndex = touchDragState.fromIndex;
        if (insertPos !== fromIndex && insertPos !== fromIndex + 1) {
            const [moved] = selectedPhotos.splice(fromIndex, 1);
            const insertIndex = fromIndex < insertPos ? insertPos - 1 : insertPos;
            selectedPhotos.splice(insertIndex, 0, moved);
            renderPhotoPreviews();
        }
    }
    lastInsertPosition = -1;
    touchDragState = null;
}

// 사진 제거
function removePhoto(index) {
    selectedPhotos.splice(index, 1);
    renderPhotoPreviews();
}

// 크롭 편집 모달 — 코디 표시와 동일한 세로 3:4만 허용
const OUTFIT_PHOTO_CROP_ASPECT = 3 / 4;
/** 편집기에 넣기 전 긴 변. 초대형 원본은 캔버스 한도를 넘어 잘린 결과로 나온다. */
const CROP_SOURCE_MAX_EDGE = 2048;
/** 저장 캔버스. 가로·세로를 따로 강제하면 맞춘 박스와 비율이 어긋난다. */
const CROP_OUTPUT_MAX_WIDTH = 1200;
const CROP_OUTPUT_MAX_HEIGHT = 1600;

let cropModalCropper = null;
/** selectedPhotos 인덱스. 신규 업로드 대기 중이면 null */
let cropModalPhotoIndex = null;
/** 앨범에서 고른 뒤 아직 selectedPhotos에 넣기 전 */
let cropPendingNewPhoto = null;
let cropUploadQueue = [];
let cropperInitTries = 0;

function loadHtmlImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('load'));
        img.src = src;
    });
}

/** 편집 전에만 축소. 브라우저가 방향을 반영한 뒤라 결과 JPEG에는 회전 정보가 남지 않는다. */
async function dataUrlForCropEditor(dataUrl) {
    try {
        const img = await loadHtmlImage(dataUrl);
        const nw = img.naturalWidth || img.width;
        const nh = img.naturalHeight || img.height;
        if (!nw || !nh || Math.max(nw, nh) <= CROP_SOURCE_MAX_EDGE) return dataUrl;
        const scale = CROP_SOURCE_MAX_EDGE / Math.max(nw, nh);
        const w = Math.max(1, Math.round(nw * scale));
        const h = Math.max(1, Math.round(nh * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return dataUrl;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        return canvas.toDataURL('image/jpeg', 0.92);
    } catch (_) {
        return dataUrl;
    }
}

function initCropperOnImage() {
    const img = document.getElementById('cropImage');
    const container = document.querySelector('#cropModal .crop-container');
    if (!img || typeof Cropper === 'undefined') return;
    if (!img.naturalWidth || !container || container.clientHeight < 40) {
        if (cropperInitTries++ < 12) requestAnimationFrame(initCropperOnImage);
        return;
    }
    cropperInitTries = 0;
    if (cropModalCropper) {
        cropModalCropper.destroy();
        cropModalCropper = null;
    }
    cropModalCropper = new Cropper(img, {
        aspectRatio: OUTFIT_PHOTO_CROP_ASPECT,
        viewMode: 1,
        dragMode: 'move',
        autoCropArea: 1,
        responsive: true,
        background: false,
        restore: false,
        guides: true,
        center: true,
        highlight: true,
        cropBoxMovable: true,
        cropBoxResizable: true,
        toggleDragModeOnDblclick: false,
        checkOrientation: true,
        ready() {
            const cropper = this.cropper;
            if (cropper && typeof cropper.resize === 'function') {
                requestAnimationFrame(() => cropper.resize());
            }
        }
    });
}

/** 크롭 박스 비율을 유지한 채 긴 변만 제한. width·height를 같이 넘기면 다시 잘린다. */
function getOutfitCropCanvas(cropper) {
    if (!cropper) return null;
    const canvas = cropper.getCroppedCanvas({
        maxWidth: CROP_OUTPUT_MAX_WIDTH,
        maxHeight: CROP_OUTPUT_MAX_HEIGHT,
        fillColor: '#ffffff',
        imageSmoothingEnabled: true,
        imageSmoothingQuality: 'high'
    });
    if (!canvas || canvas.width < 2 || canvas.height < 2) return null;
    return canvas;
}

function isCropModalOpen() {
    return document.getElementById('cropModal')?.classList.contains('active');
}

function processNextCropInQueue() {
    if (isCropModalOpen()) return;
    if (cropUploadQueue.length === 0) return;
    if (selectedPhotos.length >= 3) {
        cropUploadQueue = [];
        return;
    }
    const next = cropUploadQueue.shift();
    if (next?.dataUrl) openCropModalForNewUpload(next);
}

function mountCropImage(src) {
    const img = document.getElementById('cropImage');
    if (!img || !src) return;
    cropperInitTries = 0;
    const start = () => {
        if (!img.naturalWidth) return;
        requestAnimationFrame(() => requestAnimationFrame(() => initCropperOnImage()));
    };
    img.onload = start;
    img.onerror = () => {
        void showAlert('사진을 불러오지 못했어요. 다시 선택해 주세요.');
        closeCropModal();
    };
    if (/^https?:\/\//i.test(src)) img.crossOrigin = 'anonymous';
    else img.removeAttribute('crossorigin');
    if (img.getAttribute('src') === src && img.complete && img.naturalWidth) {
        start();
        return;
    }
    img.src = src;
}

function openCropModalForNewUpload(pending) {
    if (typeof Cropper === 'undefined') {
        void showAlert('편집 기능을 불러올 수 없습니다. 페이지를 새로고침해 주세요.');
        processNextCropInQueue();
        return;
    }
    cropPendingNewPhoto = pending;
    cropModalPhotoIndex = null;

    const modal = document.getElementById('cropModal');
    const img = document.getElementById('cropImage');
    if (!modal || !img || !pending?.dataUrl) return;

    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    mountCropImage(pending.dataUrl);
}

function openCropModal(index) {
    const photo = selectedPhotos[index];
    if (!photo?.dataUrl) return;
    if (typeof Cropper === 'undefined') {
        showAlert('편집 기능을 불러올 수 없습니다. 페이지를 새로고침해 주세요.');
        return;
    }

    cropPendingNewPhoto = null;
    cropModalPhotoIndex = index;
    const modal = document.getElementById('cropModal');
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    mountCropImage(photo.dataUrl);
}

function finishCropModalCleanup() {
    const modal = document.getElementById('cropModal');
    modal?.classList.remove('active');
    if (cropModalCropper) {
        cropModalCropper.destroy();
        cropModalCropper = null;
    }
    cropModalPhotoIndex = null;
    cropPendingNewPhoto = null;
    if (
        !document.getElementById('outfitWardrobePickerSheet')?.classList.contains('active') &&
        !document.getElementById('writeWardrobeAddSheet')?.classList.contains('active') &&
        !document.getElementById('outfitCategorySheet')?.classList.contains('active')
    ) {
        document.body.style.overflow = '';
    }
}

function closeCropModal() {
    const wasPending = cropPendingNewPhoto != null;
    finishCropModalCleanup();
    if (wasPending) processNextCropInQueue();
}

function applyCrop() {
    if (!cropModalCropper) {
        void showAlert('사진 맞추기를 준비하고 있어요. 잠시 뒤 다시 적용해 주세요.');
        return;
    }
    const canvas = getOutfitCropCanvas(cropModalCropper);
    if (!canvas) {
        void showAlert('사진 맞추기를 준비하고 있어요. 잠시 뒤 다시 적용해 주세요.');
        return;
    }
    let dataUrl;
    try {
        dataUrl = canvas.toDataURL('image/jpeg', 0.86);
    } catch (_) {
        void showAlert('이 사진은 다시 자를 수 없어요. 앨범에서 다시 골라 주세요.');
        return;
    }

    if (cropPendingNewPhoto) {
        const pending = cropPendingNewPhoto;
        cropPendingNewPhoto = null;
        selectedPhotos.push({
            file: pending.file,
            dataUrl
        });
        renderPhotoPreviews();
        finishCropModalCleanup();
        processNextCropInQueue();
        return;
    }

    if (cropModalPhotoIndex == null) {
        closeCropModal();
        return;
    }

    const photo = selectedPhotos[cropModalPhotoIndex];
    if (photo) {
        selectedPhotos[cropModalPhotoIndex] = {
            ...photo,
            dataUrl
        };
        renderPhotoPreviews();
    }
    closeCropModal();
}

function initCropModal() {
    const modal = document.getElementById('cropModal');
    const closeBtn = document.getElementById('cropModalClose');
    const cancelBtn = document.getElementById('cropCancelBtn');
    const applyBtn = document.getElementById('cropApplyBtn');
    const overlay = modal?.querySelector('.crop-modal-overlay');

    closeBtn?.addEventListener('click', closeCropModal);
    cancelBtn?.addEventListener('click', closeCropModal);
    overlay?.addEventListener('click', closeCropModal);
    applyBtn?.addEventListener('click', applyCrop);
}

function syncTpoButtons() {
    const allowed = new Set(selectedTpo);
    document.querySelectorAll('#tpoBtns .weather-fit-btn').forEach((btn) => {
        btn.classList.toggle('active', allowed.has(btn.dataset.value));
    });
}

// 폼 유효성 검사
function validateForm() {
    const dateInput = document.getElementById('dateInput');
    const saveBtn = document.querySelector('.save-btn');
    
    if (dateInput?.value) {
        saveBtn.disabled = false;
    } else {
        saveBtn.disabled = true;
    }
}

// 폼 제출
async function handleSubmit() {
    debugLog('💾 저장 시작');
    
    const dateInput = document.getElementById('dateInput');
    const titleInput = document.getElementById('titleInput');
    const contentInput = document.getElementById('contentInput');
    const saveBtn = document.querySelector('.save-btn');
    
    if (!dateInput.value) {
        showAlert('날짜를 선택해주세요.');
        return;
    }
    
    // 버튼 비활성화
    saveBtn.disabled = true;
    saveBtn.textContent = isEditMode ? '수정 중...' : '저장 중...';

    try {
        sortOutfitItemsInPlace();

        const outfitDraftPending = outfitItems.some((row) => {
            const cat = String(row.category || '').trim();
            if (!cat) return false;
            return (
                String(getOutfitItemDraftString(row)).trim() !==
                String(row.value || '').trim()
            );
        });
        if (outfitDraftPending) {
            saveBtn.disabled = false;
            saveBtn.textContent = isEditMode ? '완료' : '저장';
            await showAlert('품목명을 수정한 줄은 입력 버튼으로 확정한 뒤 저장해 주세요.');
            return;
        }

        const { data: authUserResp, error: authUserErr } = await supabaseClient.auth.getUser();
        const userId = authUserResp && authUserResp.user && authUserResp.user.id;
        if (authUserErr || !userId) {
            throw new Error('로그인 정보를 확인할 수 없습니다. 다시 로그인 후 시도해 주세요.');
        }

        let uploadRowId =
            isEditMode && currentLog && currentLog.id ? String(currentLog.id) : '';
        if (!uploadRowId) {
            if (!pendingNewStyleLogIdForUpload) {
                pendingNewStyleLogIdForUpload =
                    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
                        ? crypto.randomUUID()
                        : (() => {
                              const b = (n) => (Math.random() * n) | 0;
                              return (
                                  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
                                      const r = b(16);
                                      const v = c === 'x' ? r : (r & 0x3) | 0x8;
                                      return v.toString(16);
                                  })
                              );
                          })();
            }
            uploadRowId = pendingNewStyleLogIdForUpload;
        }

        /** @type {string[]} */
        let photoUrls = [];
        if (selectedPhotos.length > 0) {
            photoUrls = await publishStyleLogPhotosFromSelection(
                supabaseClient,
                userId,
                uploadRowId,
                selectedPhotos
            );
        }

        let thumbUrl = null;
        if (photoUrls.length > 0) {
            /* 홈 카드는 thumb_url만 조회 — Storage display URL과 동일하게 두면 safeStyleLogMediaUrl·용량 모두 안전 */
            const first = String(photoUrls[0] || '').trim();
            thumbUrl = first || null;
        }

        const weatherFitInput = document.getElementById('weatherFitInput');
        const weatherFit = weatherFitInput?.value || 'good';

        const hadOutfitItemsToSave = outfitItemsForSave().length > 0;

        // 로그 데이터 생성
        const logData = {
            date: dateInput.value,
            title: titleInput.value.trim() || null,
            content: contentInput.value.trim() || null,
            weather: currentWeather?.weather || 'cloudy',
            weather_temp: currentWeather?.temp || null,
            weather_temp_min: currentWeather?.tempMin || null,
            weather_temp_max: currentWeather?.tempMax || null,
            weather_description: currentWeather?.description || null,
            weather_fit: weatherFit,
            photos: photoUrls.length > 0 ? photoUrls : null,
            thumb_url: thumbUrl,
            tags: preservedTags.length > 0 ? preservedTags : null,
            tpo: selectedTpo.length > 0 ? [...selectedTpo] : [],
            items: (() => {
                const savedItems = outfitItemsForSave();
                return savedItems.length > 0 ? savedItems : null;
            })(),
            is_favorite: isEditMode ? currentLog.is_favorite : false // 수정 시에는 기존 값 유지, 신규는 false
        };

        const effectiveKind = isEditMode
            ? typeof normalizeLogKind === 'function'
                ? normalizeLogKind(currentLog?.log_kind)
                : 'my_outfit'
            : writeLogKind;
        logData.log_kind = effectiveKind;
        if (effectiveKind === 'reference') {
            const urlRaw = document.getElementById('referenceSourceUrlInput')?.value || '';
            const safeUrl =
                typeof safeExternalUrl === 'function' ? safeExternalUrl(urlRaw) : String(urlRaw).trim();
            logData.reference_source_url = safeUrl || null;
            const scrap = String(document.getElementById('scrapGroupInput')?.value || '').trim();
            logData.scrap_group = scrap || null;
            logData.source_reference_id = null;
        } else if (!isEditMode) {
            logData.reference_source_url = null;
            logData.scrap_group = null;
            if (writeSourceReferenceId) {
                logData.source_reference_id = writeSourceReferenceId;
            }
        }

        if (!isEditMode && pendingNewStyleLogIdForUpload) {
            logData.id = pendingNewStyleLogIdForUpload;
        }
        
        debugLog('📝 저장할 데이터:', logData);
        
        let result;
        if (isEditMode) {
            // 수정 모드
            result = await StyleLogAPI.update(currentLog.id, logData);
            debugLog('✅ 수정 성공:', result);
        } else {
            // 새 로그 작성
            result = await StyleLogAPI.create(logData);
            debugLog('✅ 저장 성공:', result);
        }

        const outfitItemsWereDropped =
            hadOutfitItemsToSave &&
            result &&
            result.__stylelogItemsDropped;

        if (result && Object.prototype.hasOwnProperty.call(result, '__stylelogItemsDropped')) {
            delete result.__stylelogItemsDropped;
        }

        let doneMsg = isEditMode ? '수정되었습니다.' : '저장되었습니다.';
        if (outfitItemsWereDropped && result && result.__stylelogContextDropped) {
            doneMsg = '저장되었지만, 착장과 상황은 빠졌어요.';
        } else if (outfitItemsWereDropped) {
            doneMsg = '저장되었지만, 착장 품목은 빠졌어요.';
        } else if (result && result.__stylelogContextDropped) {
            doneMsg = '저장되었지만, 상황은 빠졌어요.';
        }
        if (result && result.__stylelogLogKindDropped) {
            doneMsg =
                doneMsg.indexOf('빠졌') >= 0
                    ? doneMsg.replace(/\.$/, '') + ', 레퍼런스 정보는 빠졌어요.'
                    : '저장되었지만, 레퍼런스 정보는 빠졌어요.';
            delete result.__stylelogLogKindDropped;
        }

        await showAlert(doneMsg);

        // 상세 페이지로 이동 (약간의 지연을 주어 DB 반영 시간 확보)
        // replace를 사용하여 히스토리에서 write.html을 대체 (뒤로가기 시 홈으로 이동)
        setTimeout(() => {
            if (result && result.id) {
                // 저장된 로그의 ID를 사용하여 상세 페이지로 이동
                window.location.replace(`detail.html?date=${dateInput.value}&id=${result.id}`);
            } else {
                // ID가 없으면 날짜만 사용
                window.location.replace(`detail.html?date=${dateInput.value}`);
            }
        }, 500);
        
    } catch (error) {
        console.error('❌ 저장 오류:', error);
        showAlert(`${isEditMode ? '수정' : '저장'}에 실패했습니다: ${error.message}`);
        
        // 버튼 복구
        saveBtn.disabled = false;
        saveBtn.textContent = isEditMode ? '수정' : '저장';
    }
}

// 페이지 로드 시 초기화
window.addEventListener('load', initPage);

