// 작성 화면 스크립트

// URL 파라미터에서 날짜 및 ID 가져오기
const urlParams = new URLSearchParams(window.location.search);
const initialDate = urlParams.get('date');
const editLogId = urlParams.get('id'); // 수정 모드인지 확인

let currentWeather = null;
let selectedPhotos = [];
let tags = [];
let isEditMode = false; // 수정 모드 플래그
let currentLog = null; // 수정할 로그 데이터
let draggingPhotoIndex = null;
let touchDragState = null;
let lastInsertPosition = -1; // 드롭 시 사용할 삽입 위치 (0 = 맨 앞, n = n번째 뒤)

// 페이지 초기화
async function initPage() {
    console.log('📝 write.html 초기화:', { 
        editLogId, 
        initialDate,
        urlParams: window.location.search,
        allParams: Object.fromEntries(urlParams.entries())
    });
    
    // 수정 모드 확인 (id가 null, 빈 문자열, 'null' 문자열이 아닌 경우만)
    if (editLogId && editLogId !== 'null' && editLogId !== 'undefined' && editLogId.trim() !== '') {
        console.log('✏️ 수정 모드로 진입:', editLogId);
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
        console.log('📝 새 로그 작성 모드 (editLogId가 없거나 유효하지 않음)');
        // 새 로그 작성 모드
        await initNewLog();
    }
    
    // 이벤트 리스너 등록
    attachEventListeners();
    
    // 폼 유효성 검사
    validateForm();
}

// 수정할 로그 데이터 로드
async function loadLogForEdit(logId) {
    try {
        console.log('📝 수정 모드: 로그 로딩 중...', logId);
        
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
        console.log('✅ 로그 로드 완료:', currentLog);
        
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
        
        // 태그 로드
        if (currentLog.tags && currentLog.tags.length > 0) {
            tags = [...currentLog.tags];
            renderTags();
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
        document.querySelectorAll('.weather-fit-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.value === weatherFit);
        });
        
        // 헤더 타이틀 변경
        const headerTitle = document.querySelector('.write-header h1');
        if (headerTitle) {
            headerTitle.textContent = '수정하기';
        }
        
        // 저장 버튼 텍스트 변경
        const saveBtn = document.querySelector('.save-btn');
        if (saveBtn) {
            saveBtn.textContent = '완료';
        }
        
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
    
    // 초기 날씨 정보 로드
    await loadWeatherForDate(dateInput.value);
}

// 특정 날짜의 날씨 정보 로드
async function loadWeatherForDate(date) {
    try {
        console.log('🌤️ 날씨 로딩 중...', date);
        
        currentWeather = await getWeatherByDate(date);
        
        if (currentWeather) {
            if (currentWeather.unavailable && currentWeather.reason === 'future') {
                // 7일 이후 미래 날짜 → 사용자 안내 표시
                currentWeather = {
                    ...currentWeather,
                    _futureHint: true
                };
            }
            console.log('🌤️ 날씨 정보:', currentWeather);
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
        hint.className = 'weather-future-hint';
        hint.textContent = '7일 이후 날짜는 아직 날씨를 볼 수 없어요. 일기는 그대로 저장돼요.';
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

// 이벤트 리스너 등록
function attachEventListeners() {
    // 취소 버튼
    document.querySelector('.cancel-btn').addEventListener('click', () => {
        showConfirm('작성을 취소하시겠습니까?').then((ok) => {
            if (ok) window.history.back();
        });
    });
    
    // 저장 버튼
    const saveBtn = document.querySelector('.save-btn');
    saveBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('💾 저장 버튼 클릭됨');
        await handleSubmit();
    });
    
    // 사진 선택
    document.getElementById('photoInput').addEventListener('change', handlePhotoSelect);

    // 리스트 영역 드래그 오버 (갭 영역 포함) - 삽입선 위치 계산
    document.getElementById('photoPreviewList').addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (draggingPhotoIndex === null) return;
        const el = document.elementFromPoint(e.clientX, e.clientY);
        if (el?.closest('.photo-preview-item')) return; // 아이템 핸들러에서 처리
        const list = document.getElementById('photoPreviewList');
        const items = [...list.querySelectorAll('.photo-preview-item')];
        if (items.length === 0) return;
        const listRect = list.getBoundingClientRect();
        const x = e.clientX - listRect.left;
        let insertPos = 0;
        for (let i = 0; i < items.length; i++) {
            const r = items[i].getBoundingClientRect();
            const left = r.left - listRect.left;
            const right = r.right - listRect.left;
            if (x < left) break;
            if (x <= right) {
                const mid = left + (right - left) / 2;
                insertPos = x < mid ? i : i + 1;
                break;
            }
            insertPos = i + 1;
        }
        if (insertPos !== draggingPhotoIndex && insertPos !== draggingPhotoIndex + 1) {
            updateInsertLine(insertPos);
        } else {
            updateInsertLine(-1);
        }
    });
    document.getElementById('photoPreviewList').addEventListener('drop', (e) => {
        if (e.target.closest('.photo-preview-item')) return; // 아이템에서 처리
        e.preventDefault();
        e.stopPropagation();
        updateInsertLine(-1);
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
    
    // 태그 입력
    const tagsInput = document.getElementById('tagsInput');
    tagsInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            addTag(tagsInput.value.trim());
            tagsInput.value = '';
        }
    });
    
    // 폼 입력 시 유효성 검사
    document.getElementById('dateInput').addEventListener('change', validateForm);
    document.getElementById('titleInput').addEventListener('input', validateForm);
    document.getElementById('contentInput').addEventListener('input', validateForm);

    // 날씨적합도 단일선택 버튼
    document.querySelectorAll('.weather-fit-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.weather-fit-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const input = document.getElementById('weatherFitInput');
            if (input) input.value = btn.dataset.value;
        });
    });

    // 크롭 모달 초기화
    initCropModal();
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
        reader.onload = (event) => {
            results[index] = { file, dataUrl: event.target.result };
            loadedCount++;
            if (loadedCount === filesToAdd.length) {
                selectedPhotos.push(...results);
                renderPhotoPreviews();
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
    let line = document.getElementById('photoInsertLine');
    if (!line) {
        line = document.createElement('div');
        line.id = 'photoInsertLine';
        line.className = 'photo-insert-line';
        document.getElementById('photoPreviewList').appendChild(line);
    }
    if (insertPos < 0) {
        line.classList.remove('visible');
        lastInsertPosition = -1;
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

// 아이템 위 좌표 → 삽입 위치 (0=맨앞, n=맨뒤)
function getInsertPositionFromItem(item, clientX) {
    const idx = parseInt(item.dataset.index, 10);
    const rect = item.getBoundingClientRect();
    const mid = rect.left + rect.width / 2;
    return clientX < mid ? idx : idx + 1;
}

function clearPhotoDraggingState() {
    document.querySelectorAll('.photo-preview-item.photo-preview-dragging').forEach(el => el.classList.remove('photo-preview-dragging'));
}

// 포인터 다운 - 즉시 시각적 피드백 (클릭/터치 직후)
function handlePhotoPointerDown(e) {
    if (e.target.closest('.photo-remove-btn, .photo-edit-btn')) return;
    e.currentTarget.classList.add('photo-preview-dragging');
}

// 드래그 시작
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
    try { e.dataTransfer.setDragImage(item, 50, 50); } catch (_) {}
    item.classList.add('photo-preview-dragging');
}

// 드래그 진입
function handlePhotoDragEnter(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
}

// 드래그 오버 - 삽입선 위치 갱신
function handlePhotoDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
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
    updateInsertLine(-1);

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

// 드래그 끝
function handlePhotoDragEnd(e) {
    e.currentTarget.classList.remove('photo-preview-dragging');
    updateInsertLine(-1);
    draggingPhotoIndex = null;
}

// 터치: 드래그 시작 (HTML5 DnD는 터치 미지원) - 터치 즉시 시각적 표시
function handlePhotoTouchStart(e) {
    if (e.target.closest('.photo-remove-btn, .photo-edit-btn')) return;
    const item = e.currentTarget;
    const idx = parseInt(item.dataset.index, 10);
    item.classList.add('photo-preview-dragging');
    touchDragState = { fromIndex: idx, itemEl: item, startY: e.touches[0].clientY, isDragging: false, lastInsertPosition: -1 };
}

// 터치: 이동 중 - 삽입선 표시
function handlePhotoTouchMove(e) {
    if (!touchDragState) return;
    const dy = Math.abs(e.touches[0].clientY - touchDragState.startY);
    if (!touchDragState.isDragging && dy > 12) {
        touchDragState.isDragging = true;
    }
    if (!touchDragState.isDragging) return;
    e.preventDefault();
    const touch = e.touches[0];
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    const targetItem = el?.closest('.photo-preview-item');
    if (targetItem) {
        const insertPos = getInsertPositionFromItem(targetItem, touch.clientX);
        if (insertPos !== touchDragState.fromIndex && insertPos !== touchDragState.fromIndex + 1) {
            updateInsertLine(insertPos);
            touchDragState.lastInsertPosition = insertPos;
        } else {
            updateInsertLine(-1);
            touchDragState.lastInsertPosition = -1;
        }
    } else {
        updateInsertLine(-1);
        touchDragState.lastInsertPosition = -1;
    }
}

// 터치: 손가락 뗄 때 순서 변경
function handlePhotoTouchEnd(e) {
    if (!touchDragState) return;
    clearPhotoDraggingState();
    if (touchDragState.isDragging && touchDragState.lastInsertPosition >= 0) {
        const insertPos = touchDragState.lastInsertPosition;
        const fromIndex = touchDragState.fromIndex;
        updateInsertLine(-1);
        if (insertPos !== fromIndex && insertPos !== fromIndex + 1) {
            const [moved] = selectedPhotos.splice(fromIndex, 1);
            const insertIndex = fromIndex < insertPos ? insertPos - 1 : insertPos;
            selectedPhotos.splice(insertIndex, 0, moved);
            renderPhotoPreviews();
        }
    } else {
        updateInsertLine(-1);
    }
    touchDragState = null;
}

// 사진 제거
function removePhoto(index) {
    selectedPhotos.splice(index, 1);
    renderPhotoPreviews();
}

// 크롭 편집 모달
let cropModalCropper = null;
let cropModalPhotoIndex = null;

function openCropModal(index) {
    const photo = selectedPhotos[index];
    if (!photo?.dataUrl) return;
    if (typeof Cropper === 'undefined') {
        showAlert('편집 기능을 불러올 수 없습니다. 페이지를 새로고침해 주세요.');
        return;
    }

    cropModalPhotoIndex = index;
    const modal = document.getElementById('cropModal');
    const img = document.getElementById('cropImage');
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';

    img.onload = () => {
        if (cropModalCropper) {
            cropModalCropper.destroy();
            cropModalCropper = null;
        }
        cropModalCropper = new Cropper(img, {
            aspectRatio: NaN,
            viewMode: 1,
            dragMode: 'move',
            autoCropArea: 1
        });
        document.querySelectorAll('.crop-ratio-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.ratio === 'free');
        });
    };
    img.src = photo.dataUrl;
}

function closeCropModal() {
    const modal = document.getElementById('cropModal');
    modal.classList.remove('active');
    document.body.style.overflow = '';
    if (cropModalCropper) {
        cropModalCropper.destroy();
        cropModalCropper = null;
    }
    cropModalPhotoIndex = null;
}

function applyCrop() {
    if (!cropModalCropper || cropModalPhotoIndex == null) {
        closeCropModal();
        return;
    }
    const canvas = cropModalCropper.getCroppedCanvas({ maxWidth: 1920, maxHeight: 1920, imageSmoothingQuality: 'high' });
    if (!canvas) {
        closeCropModal();
        return;
    }
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    const photo = selectedPhotos[cropModalPhotoIndex];
    if (photo) {
        selectedPhotos[cropModalPhotoIndex] = {
            ...photo,
            dataUrl
        };
        if (photo.file) {
            selectedPhotos[cropModalPhotoIndex].file = photo.file;
        }
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

    const ratioMap = { '1': 1, '4/3': 4/3, '3/4': 3/4, '16/9': 16/9, '9/16': 9/16 };
    document.querySelectorAll('.crop-ratio-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const ratio = btn.dataset.ratio;
            document.querySelectorAll('.crop-ratio-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            if (!cropModalCropper) return;
            cropModalCropper.setAspectRatio(ratio === 'free' ? NaN : ratioMap[ratio]);
        });
    });
}

// 리스트용 썸네일 생성 (첫 번째 사진 리사이즈, 최대 1200px, 화질 85%)
function createThumbnail(dataUrl) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const MAX_SIZE = 1200;
            let w = img.width;
            let h = img.height;
            if (w > h && w > MAX_SIZE) {
                h = (h * MAX_SIZE) / w;
                w = MAX_SIZE;
            } else if (h > MAX_SIZE) {
                w = (w * MAX_SIZE) / h;
                h = MAX_SIZE;
            }
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, w, h);
            try {
                const thumb = canvas.toDataURL('image/jpeg', 0.85);
                resolve(thumb);
            } catch {
                resolve(dataUrl);
            }
        };
        img.onerror = () => resolve(null);
        img.src = dataUrl;
    });
}

// 태그 추가
function addTag(tagText) {
    if (!tagText) return;
    
    // # 제거
    tagText = tagText.replace(/^#/, '');
    
    if (tags.includes(tagText)) {
        return; // 중복 방지
    }
    
    tags.push(tagText);
    renderTags();
}

// 태그 렌더링
function renderTags() {
    const tagsDisplay = document.getElementById('tagsDisplay');
    tagsDisplay.innerHTML = '';
    
    tags.forEach((tag, index) => {
        const tagItem = document.createElement('div');
        tagItem.className = 'tag-item';
        tagItem.innerHTML = `
            #${tag}
            <button type="button" class="tag-remove" onclick="removeTag(${index})">×</button>
        `;
        tagsDisplay.appendChild(tagItem);
    });
}

// 태그 제거
function removeTag(index) {
    tags.splice(index, 1);
    renderTags();
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
    console.log('💾 저장 시작');
    
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
    saveBtn.textContent = isEditMode ? '완료 중...' : '저장 중...';
    
    try {
        // 사진 URL 배열 (실제로는 Supabase Storage에 업로드 필요)
        // 지금은 data URL을 그대로 저장 (임시)
        const photoUrls = selectedPhotos.map(photo => photo.dataUrl);
        
        // 리스트용 썸네일 생성 (첫 번째 사진만, 소형 base64)
        let thumbUrl = null;
        if (photoUrls.length > 0) {
            thumbUrl = await createThumbnail(photoUrls[0]);
        }
        
        const weatherFitInput = document.getElementById('weatherFitInput');
        const weatherFit = weatherFitInput?.value || 'good';

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
            tags: tags.length > 0 ? tags : null,
            is_favorite: isEditMode ? currentLog.is_favorite : false // 수정 시에는 기존 값 유지, 신규는 false
        };
        
        console.log('📝 저장할 데이터:', logData);
        
        let result;
        if (isEditMode) {
            // 수정 모드
            result = await StyleLogAPI.update(currentLog.id, logData);
            console.log('✅ 수정 성공:', result);
            showAlert('수정되었습니다!');
        } else {
            // 새 로그 작성
            result = await StyleLogAPI.create(logData);
            console.log('✅ 저장 성공:', result);
            showAlert('저장되었습니다!');
        }
        
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

