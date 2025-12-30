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

// 페이지 초기화
async function initPage() {
    console.log('📝 write.html 초기화:', { editLogId, initialDate });
    
    // 수정 모드 확인 (id가 null, 빈 문자열, 'null' 문자열이 아닌 경우만)
    if (editLogId && editLogId !== 'null' && editLogId !== 'undefined' && editLogId.trim() !== '') {
        console.log('✏️ 수정 모드로 진입:', editLogId);
        isEditMode = true;
        await loadLogForEdit(editLogId);
    } else {
        console.log('📝 새 로그 작성 모드');
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
        
        // 헤더 타이틀 변경
        const headerTitle = document.querySelector('.write-header h1');
        if (headerTitle) {
            headerTitle.textContent = 'EDIT LOG';
        }
        
        // 저장 버튼 텍스트 변경
        const saveBtn = document.querySelector('.save-btn');
        if (saveBtn) {
            saveBtn.textContent = '수정';
        }
        
    } catch (error) {
        console.error('❌ 로그 로드 오류:', error);
        alert('로그를 불러오는데 실패했습니다.');
        window.history.back();
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
            console.log('🌤️ 날씨 정보:', currentWeather);
            updateWeatherDisplay(currentWeather);
        } else {
            // 날씨 로드 실패 시 기본값
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
        // 기본값 사용
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
    const weatherIconContainer = document.getElementById('weatherIconContainer');
    const weatherName = document.getElementById('weatherName');
    const weatherTemp = document.getElementById('weatherTemp');
    const weatherInput = document.getElementById('weatherInput');
    const weatherTempInput = document.getElementById('weatherTempInput');
    const weatherDescInput = document.getElementById('weatherDescInput');
    const tempRange = document.getElementById('tempRange');
    
    // 아이콘
    weatherIconContainer.innerHTML = getWeatherIconSVG(weather.weather, 32);
    
    // 이름
    weatherName.textContent = weather.description || '흐림';
    
    // 현재 기온
    if (weather.temp !== null && weather.temp !== undefined) {
        weatherTemp.textContent = `${Math.round(weather.temp)}°C`;
    }
    
    // 최고/최저 기온
    if (weather.tempMax !== null && weather.tempMin !== null) {
        tempRange.style.display = 'flex';
        tempRange.innerHTML = `
            <span class="temp-max">최고 ${Math.round(weather.tempMax)}°C</span>
            <span class="temp-min">최저 ${Math.round(weather.tempMin)}°C</span>
        `;
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
        if (confirm('작성을 취소하시겠습니까?')) {
            window.history.back();
        }
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
}

// 사진 선택 처리
function handlePhotoSelect(e) {
    const files = Array.from(e.target.files);
    
    files.forEach(file => {
        if (selectedPhotos.length >= 3) {
            alert('사진은 최대 3장까지 등록할 수 있습니다.');
            return;
        }
        
        const reader = new FileReader();
        reader.onload = (event) => {
            selectedPhotos.push({
                file: file,
                dataUrl: event.target.result
            });
            renderPhotoPreviews();
        };
        reader.readAsDataURL(file);
    });
    
    // input 초기화
    e.target.value = '';
}

// 사진 미리보기 렌더링
function renderPhotoPreviews() {
    const previewList = document.getElementById('photoPreviewList');
    previewList.innerHTML = '';
    
    selectedPhotos.forEach((photo, index) => {
        const item = document.createElement('div');
        item.className = 'photo-preview-item';
        item.innerHTML = `
            <img src="${photo.dataUrl}" alt="사진 ${index + 1}">
            <button type="button" class="photo-remove-btn" onclick="removePhoto(${index})">×</button>
        `;
        previewList.appendChild(item);
    });
}

// 사진 제거
function removePhoto(index) {
    selectedPhotos.splice(index, 1);
    renderPhotoPreviews();
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
    
    // 날짜는 필수
    if (dateInput.value) {
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
        alert('날짜를 선택해주세요.');
        return;
    }
    
    // 버튼 비활성화
    saveBtn.disabled = true;
    saveBtn.textContent = isEditMode ? '수정 중...' : '저장 중...';
    
    try {
        // 사진 URL 배열 (실제로는 Supabase Storage에 업로드 필요)
        // 지금은 data URL을 그대로 저장 (임시)
        const photoUrls = selectedPhotos.map(photo => photo.dataUrl);
        
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
            photos: photoUrls.length > 0 ? photoUrls : null,
            tags: tags.length > 0 ? tags : null,
            is_favorite: isEditMode ? currentLog.is_favorite : false // 수정 시에는 기존 값 유지, 신규는 false
        };
        
        console.log('📝 저장할 데이터:', logData);
        
        let result;
        if (isEditMode) {
            // 수정 모드
            result = await StyleLogAPI.update(currentLog.id, logData);
            console.log('✅ 수정 성공:', result);
            alert('수정되었습니다!');
        } else {
            // 새 로그 작성
            result = await StyleLogAPI.create(logData);
            console.log('✅ 저장 성공:', result);
            alert('저장되었습니다!');
        }
        
        // 상세 페이지로 이동 (약간의 지연을 주어 DB 반영 시간 확보)
        setTimeout(() => {
            if (result && result.id) {
                // 저장된 로그의 ID를 사용하여 상세 페이지로 이동
                window.location.href = `detail.html?date=${dateInput.value}&id=${result.id}`;
            } else {
                // ID가 없으면 날짜만 사용
                window.location.href = `detail.html?date=${dateInput.value}`;
            }
        }, 500);
        
    } catch (error) {
        console.error('❌ 저장 오류:', error);
        alert(`${isEditMode ? '수정' : '저장'}에 실패했습니다: ${error.message}`);
        
        // 버튼 복구
        saveBtn.disabled = false;
        saveBtn.textContent = isEditMode ? '수정' : '저장';
    }
}

// 페이지 로드 시 초기화
window.addEventListener('load', initPage);

