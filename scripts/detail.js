// 상세 화면 스크립트

// URL 파라미터에서 날짜 정보 가져오기
const urlParams = new URLSearchParams(window.location.search);
const dateParam = urlParams.get('date'); // YYYY-MM-DD 형식
let currentLog = null;

// 페이지 초기화
async function initPage() {
    if (!dateParam) {
        alert('날짜 정보가 없습니다.');
        window.history.back();
        return;
    }
    
    try {
        // 날짜 표시 업데이트
        updateDateDisplay(dateParam);
        
        // URL에 id 파라미터가 있으면 ID로 조회 시도
        const idParam = urlParams.get('id');
        if (idParam && idParam !== 'null' && idParam !== 'undefined') {
            console.log('📋 ID로 로그 조회:', idParam);
            try {
                const { data, error } = await supabaseClient
                    .from('style_logs')
                    .select('*')
                    .eq('id', idParam)
                    .single();
                
                if (!error && data) {
                    currentLog = data;
                    console.log('✅ ID로 로그 조회 성공:', currentLog);
                } else {
                    // ID로 찾지 못하면 날짜로 조회
                    console.log('⚠️ ID로 찾지 못함, 날짜로 조회 시도');
                    currentLog = await StyleLogAPI.getByDate(dateParam);
                }
            } catch (error) {
                console.error('❌ ID 조회 오류:', error);
                // 오류 시 날짜로 조회
                currentLog = await StyleLogAPI.getByDate(dateParam);
            }
        } else {
            // 날짜로 조회
            currentLog = await StyleLogAPI.getByDate(dateParam);
        }
        
        if (!currentLog) {
            // 데이터 없으면 작성 화면으로
            if (confirm('이 날짜에 기록이 없습니다. 작성하시겠습니까?')) {
                window.location.href = `write.html?date=${dateParam}`;
            } else {
                window.history.back();
            }
            return;
        }
        
        // 최저/최고 기온이 없으면 날씨 API에서 가져와서 업데이트
        if ((currentLog.weather_temp_min === null || currentLog.weather_temp_min === undefined) &&
            (currentLog.weather_temp_max === null || currentLog.weather_temp_max === undefined)) {
            console.log('⚠️ 최저/최고 기온 없음. 날씨 API 재조회...');
            const weatherData = await getWeatherByDate(currentLog.date);
            
            if (weatherData && weatherData.tempMin !== null && weatherData.tempMax !== null) {
                // DB 업데이트
                await StyleLogAPI.update(currentLog.id, {
                    weather_temp_min: weatherData.tempMin,
                    weather_temp_max: weatherData.tempMax,
                    weather_temp: weatherData.temp
                });
                
                // currentLog 업데이트
                currentLog.weather_temp_min = weatherData.tempMin;
                currentLog.weather_temp_max = weatherData.tempMax;
                currentLog.weather_temp = weatherData.temp;
                
                console.log('✅ 날씨 데이터 업데이트 완료:', weatherData);
            }
        }
        
        // 데이터로 화면 렌더링
        renderLogDetail(currentLog);
        
        // 날씨 모달 초기화
        initWeatherModal();
        
        // 스크롤 시 헤더 효과
        initScrollEffect();
        
        // 이벤트 리스너 등록
        attachEventListeners();
        
    } catch (error) {
        console.error('데이터 로드 오류:', error);
        alert('데이터를 불러오는데 실패했습니다.');
        window.history.back();
    }
}

// 로그 상세 정보 렌더링
function renderLogDetail(log) {
    // 사진 섹션
    const container = document.querySelector('.container');
    const existingPhotoSection = document.querySelector('.photo-section');
    
    if (log.photos && log.photos.length > 0) {
        // 사진 있음 - 스와이프 가능한 갤러리 생성
        if (existingPhotoSection) {
            existingPhotoSection.remove();
        }
        
        const photoSection = document.createElement('div');
        photoSection.className = 'photo-section';
        
        if (log.photos.length === 1) {
            // 사진 1개
            photoSection.innerHTML = `
                <img src="${log.photos[0]}" alt="착장 사진" onerror="this.style.display='none'">
                <button class="favorite-toggle-btn-detail ${log.is_favorite ? 'active' : ''}" id="favoriteToggle" title="${log.is_favorite ? '즐겨찾기 해제' : '즐겨찾기 추가'}">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="${log.is_favorite ? '#ff6b6b' : 'none'}" stroke="${log.is_favorite ? '#ff6b6b' : '#666'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                    </svg>
                </button>
            `;
        } else {
            // 사진 여러 개 - 스와이프 갤러리
            photoSection.classList.add('photo-gallery');
            photoSection.innerHTML = `
                <div class="photo-slider">
                    ${log.photos.map((photo, index) => `
                        <div class="photo-slide">
                            <img src="${photo}" alt="착장 사진 ${index + 1}" onerror="this.parentElement.style.display='none'">
                        </div>
                    `).join('')}
                </div>
                <div class="photo-indicators">
                    ${log.photos.map((_, index) => `
                        <span class="indicator ${index === 0 ? 'active' : ''}" data-index="${index}"></span>
                    `).join('')}
                </div>
                <button class="favorite-toggle-btn-detail ${log.is_favorite ? 'active' : ''}" id="favoriteToggle" title="${log.is_favorite ? '즐겨찾기 해제' : '즐겨찾기 추가'}">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="${log.is_favorite ? '#ff6b6b' : 'none'}" stroke="${log.is_favorite ? '#ff6b6b' : '#666'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                    </svg>
                </button>
            `;
        }
        
        const header = document.querySelector('.detail-header');
        header.classList.add('transparent');
        header.after(photoSection);
        container?.classList.remove('no-photo');
        
        // 사진이 여러 개면 스와이프 초기화
        if (log.photos.length > 1) {
            initPhotoSwipe();
        }
        
        // 즐겨찾기 버튼 이벤트 리스너
        const favoriteBtn = document.getElementById('favoriteToggle');
        if (favoriteBtn) {
            favoriteBtn.addEventListener('click', async () => {
                await toggleFavoriteDetail();
            });
        }
    } else {
        // 사진 없음
        if (existingPhotoSection) {
            existingPhotoSection.remove();
        }
        container?.classList.add('no-photo');
        document.querySelector('.detail-header')?.classList.remove('transparent');
    }
    
    // 제목
    const titleEl = document.querySelector('.content-title');
    if (titleEl) {
        titleEl.textContent = log.title || '제목 없음';
    }
    
    // 날씨
    const weatherInfo = document.querySelector('.weather-info');
    if (weatherInfo) {
        weatherInfo.innerHTML = getWeatherIconSVG(log.weather || 'cloudy', 48);
        
        // 최저/최고 기온 표시
        if (log.weather_temp_min !== null && log.weather_temp_min !== undefined && 
            log.weather_temp_max !== null && log.weather_temp_max !== undefined) {
            weatherInfo.innerHTML += `
                <div class="temp-display">
                    <span class="temp-high">${Math.round(log.weather_temp_max)}°C</span>
                    <span class="temp-separator">/</span>
                    <span class="temp-low">${Math.round(log.weather_temp_min)}°C</span>
                </div>
            `;
        }
    }
    
    // 본문
    const contentBody = document.querySelector('.content-body');
    if (contentBody) {
        if (log.content) {
            contentBody.innerHTML = `<p>${log.content.replace(/\n/g, '<br>')}</p>`;
        } else {
            contentBody.innerHTML = '<p style="color: #999;">내용이 없습니다.</p>';
        }
    }
    
    // 태그
    const tagsContainer = document.querySelector('.tags');
    if (tagsContainer) {
        if (log.tags && log.tags.length > 0) {
            tagsContainer.innerHTML = log.tags.map(tag => 
                `<span class="tag">#${tag}</span>`
            ).join('');
        } else {
            tagsContainer.innerHTML = '';
        }
    }
}

// 사진 스와이프 초기화
function initPhotoSwipe() {
    const slider = document.querySelector('.photo-slider');
    const indicators = document.querySelectorAll('.indicator');
    
    if (!slider || indicators.length === 0) {
        console.log('⚠️ 스와이프 초기화 실패: slider 또는 indicators 없음');
        return;
    }
    
    console.log('✅ 사진 스와이프 초기화:', indicators.length, '개의 사진');
    
    let currentIndex = 0;
    let startX = 0;
    let currentX = 0;
    let isDragging = false;
    
    // 터치 시작
    slider.addEventListener('touchstart', (e) => {
        startX = e.touches[0].clientX;
        currentX = startX; // 초기화
        isDragging = true;
        slider.style.transition = 'none';
    }, { passive: true });
    
    // 터치 이동
    slider.addEventListener('touchmove', (e) => {
        if (!isDragging) return;
        currentX = e.touches[0].clientX;
        const diff = currentX - startX;
        const offset = -currentIndex * slider.offsetWidth + diff;
        slider.style.transform = `translateX(${offset}px)`;
    }, { passive: true });
    
    // 터치 끝
    slider.addEventListener('touchend', (e) => {
        if (!isDragging) return;
        isDragging = false;
        
        const diff = currentX - startX;
        const threshold = slider.offsetWidth / 4;
        
        slider.style.transition = 'transform 0.3s ease-out';
        
        if (diff > threshold && currentIndex > 0) {
            currentIndex--;
        } else if (diff < -threshold && currentIndex < indicators.length - 1) {
            currentIndex++;
        }
        
        updatePhotoSlider();
    });
    
    // 마우스 드래그 (데스크톱)
    slider.addEventListener('mousedown', (e) => {
        startX = e.clientX;
        currentX = startX; // 초기화
        isDragging = true;
        slider.style.transition = 'none';
        e.preventDefault();
    });
    
    slider.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        currentX = e.clientX;
        const diff = currentX - startX;
        const offset = -currentIndex * slider.offsetWidth + diff;
        slider.style.transform = `translateX(${offset}px)`;
    });
    
    slider.addEventListener('mouseup', (e) => {
        if (!isDragging) return;
        isDragging = false;
        
        const diff = currentX - startX;
        const threshold = slider.offsetWidth / 4;
        
        slider.style.transition = 'transform 0.3s ease-out';
        
        if (diff > threshold && currentIndex > 0) {
            currentIndex--;
        } else if (diff < -threshold && currentIndex < indicators.length - 1) {
            currentIndex++;
        }
        
        updatePhotoSlider();
    });
    
    slider.addEventListener('mouseleave', () => {
        if (isDragging) {
            isDragging = false;
            slider.style.transition = 'transform 0.3s ease-out';
            updatePhotoSlider();
        }
    });
    
    // 인디케이터 클릭
    indicators.forEach((indicator, index) => {
        indicator.addEventListener('click', () => {
            currentIndex = index;
            updatePhotoSlider();
        });
    });
    
    function updatePhotoSlider() {
        const offset = -currentIndex * slider.offsetWidth;
        slider.style.transform = `translateX(${offset}px)`;
        
        indicators.forEach((ind, idx) => {
            ind.classList.toggle('active', idx === currentIndex);
        });
        
        console.log('📸 사진 전환:', currentIndex + 1, '/', indicators.length);
    }
    
    // 초기 상태 설정
    updatePhotoSlider();
}

// 날짜 표시 업데이트
function updateDateDisplay(dateStr) {
    const dateLabel = document.querySelector('.date-label');
    if (dateLabel) {
        const date = new Date(dateStr);
        const daysKo = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
        
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const dayName = daysKo[date.getDay()];
        
        dateLabel.textContent = `${year}.${month}.${day} ${dayName}`;
    }
}

// 뒤로가기 버튼은 common.js에서 처리됨

// closeMenu 함수 정의 (common.js의 함수 사용)
function closeMenu() {
    const menuPopup = document.getElementById('menuPopup');
    if (menuPopup) {
        menuPopup.classList.remove('active');
        document.body.style.overflow = '';
    }
}

// 수정 버튼
document.querySelector('.edit-btn')?.addEventListener('click', () => {
    console.log('수정 모드로 전환');
    // 날씨 모달 열기
    openWeatherModal();
});

// 삭제 버튼
document.querySelector('.delete-btn')?.addEventListener('click', async () => {
    if (!currentLog) return;
    
    if (confirm('이 기록을 삭제하시겠습니까?')) {
        try {
            utils.showLoading();
            await StyleLogAPI.delete(currentLog.id);
            alert('삭제되었습니다.');
            window.history.back();
        } catch (error) {
            console.error('삭제 오류:', error);
            utils.showError('삭제에 실패했습니다.');
        } finally {
            utils.hideLoading();
        }
    }
});

// 날씨 모달 초기화
function initWeatherModal() {
    const modal = document.getElementById('weatherModal');
    const closeBtn = document.querySelector('.modal-close');
    
    // 닫기 버튼
    closeBtn?.addEventListener('click', () => {
        closeWeatherModal();
    });
    
    // 배경 클릭 시 닫기
    modal?.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeWeatherModal();
        }
    });
    
    // 날씨 선택
    const weatherOptions = document.querySelectorAll('.weather-option');
    weatherOptions.forEach(option => {
        option.addEventListener('click', () => {
            const input = option.querySelector('input[type="radio"]');
            input.checked = true;
            
            // 선택 후 모달 닫기
            setTimeout(() => {
                closeWeatherModal();
                updateWeatherDisplay(input.value);
            }, 300);
        });
    });
}

// 날씨 모달 열기
function openWeatherModal() {
    const modal = document.getElementById('weatherModal');
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

// 날씨 모달 닫기
function closeWeatherModal() {
    const modal = document.getElementById('weatherModal');
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
}

// 날씨 표시 업데이트
async function updateWeatherDisplay(weather) {
    if (!currentLog) return;
    
    try {
        // DB 업데이트
        await StyleLogAPI.update(currentLog.id, { weather });
        currentLog.weather = weather;
        
        // UI 업데이트
        const weatherInfo = document.querySelector('.weather-info');
        if (weatherInfo) {
            const tempDisplay = weatherInfo.querySelector('.temp-display');
            const tempHtml = tempDisplay ? tempDisplay.outerHTML : '';
            weatherInfo.innerHTML = getWeatherIconSVG(weather, 48) + tempHtml;
        }
        
        console.log('날씨 업데이트 완료:', weather);
        
    } catch (error) {
        console.error('날씨 업데이트 오류:', error);
        alert('날씨 정보 업데이트에 실패했습니다.');
    }
}

// 스크롤 효과
function initScrollEffect() {
    const header = document.querySelector('.detail-header');
    
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            header?.classList.remove('transparent');
            header?.classList.add('scrolled');
        } else {
            header?.classList.add('transparent');
            header?.classList.remove('scrolled');
        }
    });
}

// 이벤트 리스너 등록
function attachEventListeners() {
    // 뒤로가기 버튼은 common.js에서 처리됨
    
    // 메뉴 버튼 (중복 등록 방지)
    const menuBtn = document.querySelector('.menu-btn');
    if (menuBtn) {
        // 기존 이벤트 리스너 제거 후 새로 등록
        const newMenuBtn = menuBtn.cloneNode(true);
        menuBtn.parentNode.replaceChild(newMenuBtn, menuBtn);
        
        newMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (typeof openMenu === 'function') {
                openMenu();
            } else {
                // openMenu가 없으면 직접 처리
                const menuPopup = document.getElementById('menuPopup');
                if (menuPopup) {
                    menuPopup.classList.add('active');
                    document.body.style.overflow = 'hidden';
                }
            }
        });
    }
    
    // 메뉴 오버레이 클릭 시 닫기
    const menuOverlay = document.querySelector('.menu-overlay');
    if (menuOverlay) {
        menuOverlay.addEventListener('click', () => {
            closeMenu();
        });
    }
    
    // 취소 버튼
    const cancelBtn = document.querySelector('.cancel-menu-btn');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            closeMenu();
        });
    }
    
    // 수정 버튼
    const editBtn = document.querySelector('.edit-menu-btn');
    if (editBtn) {
        editBtn.addEventListener('click', () => {
            if (currentLog && currentLog.id) {
                window.location.href = `write.html?id=${currentLog.id}&date=${dateParam}`;
            } else {
                alert('로그 정보를 찾을 수 없습니다.');
            }
        });
    }
    
    // 삭제 버튼
    const deleteBtn = document.querySelector('.delete-menu-btn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', async () => {
            closeMenu();
            
            // 약간의 지연 후 삭제 확인
            setTimeout(async () => {
                if (confirm('정말 삭제하시겠습니까?')) {
                    try {
                        console.log('🗑️ 삭제 시작:', currentLog.id);
                        await StyleLogAPI.delete(currentLog.id);
                        console.log('✅ 삭제 성공');
                        alert('삭제되었습니다.');
                        window.history.back();
                    } catch (error) {
                        console.error('❌ 삭제 오류:', error);
                        alert('삭제에 실패했습니다.');
                    }
                }
            }, 300);
        });
    }
}

// 메뉴 열기
// openMenu/closeMenu는 common.js에서 관리

// 이미지 로딩 에러 처리
document.querySelectorAll('.photo-section img').forEach(img => {
    img.addEventListener('error', () => {
        img.parentElement.style.backgroundColor = '#e0e0e0';
        img.style.display = 'none';
    });
});

// 즐겨찾기 토글 (detail 페이지용)
async function toggleFavoriteDetail() {
    if (!currentLog || !currentLog.id) {
        alert('로그 정보를 찾을 수 없습니다.');
        return;
    }
    
    try {
        const newState = !currentLog.is_favorite;
        
        console.log('⭐ 즐겨찾기 업데이트:', { logId: currentLog.id, newState });
        
        // DB 업데이트
        await StyleLogAPI.update(currentLog.id, { is_favorite: newState });
        
        // currentLog 업데이트
        currentLog.is_favorite = newState;
        
        // 버튼 UI 업데이트
        const button = document.getElementById('favoriteToggle');
        if (button) {
            button.setAttribute('title', newState ? '즐겨찾기 해제' : '즐겨찾기 추가');
            
            if (newState) {
                button.classList.add('active');
            } else {
                button.classList.remove('active');
            }
            
            // SVG fill 색상 변경
            const svg = button.querySelector('svg');
            if (svg) {
                svg.setAttribute('fill', newState ? '#ff6b6b' : 'none');
                svg.setAttribute('stroke', newState ? '#ff6b6b' : '#666');
            }
        }
        
        console.log('✅ 즐겨찾기 토글 완료');
        
    } catch (error) {
        console.error('❌ 즐겨찾기 업데이트 오류:', error);
        alert('즐겨찾기 업데이트에 실패했습니다.');
    }
}

// 키보드 단축키
document.addEventListener('keydown', (e) => {
    // ESC: 모달 닫기
    if (e.key === 'Escape') {
        closeWeatherModal();
    }
    
    // E: 수정
    if (e.key === 'e' || e.key === 'E') {
        openWeatherModal();
    }
    
    // Backspace: 뒤로가기
    if (e.key === 'Backspace' && !e.target.matches('input, textarea')) {
        e.preventDefault();
        const referrer = urlParams.get('referrer');
        if (referrer === 'calendar') {
            window.location.href = 'calendar.html';
        } else {
            window.history.back();
        }
    }
});

// 페이지 로드 시 초기화
window.addEventListener('load', initPage);

