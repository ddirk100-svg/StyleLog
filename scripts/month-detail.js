// 월별 상세 화면 스크립트

// URL 파라미터에서 연도와 월 가져오기
const urlParams = new URLSearchParams(window.location.search);
const currentYear = parseInt(urlParams.get('year')) || new Date().getFullYear();
const currentMonth = urlParams.get('month') ? parseInt(urlParams.get('month')) : null; // month가 없으면 전체 연도

console.log('📅 URL 파라미터:', { year: currentYear, month: currentMonth });

// 페이지 초기화
async function initPage() {
    // 헤더 타이틀 업데이트
    const monthTitle = document.querySelector('.month-title');
    if (monthTitle) {
        if (currentMonth) {
            // 특정 월: "2025년 12월"
            monthTitle.textContent = `${currentYear}년 ${currentMonth}월`;
        } else {
            // 전체 연도: "2025년 전체"
            monthTitle.textContent = `${currentYear}년 전체`;
        }
    }
    
    // 페이지 title 동적 업데이트
    if (currentMonth) {
        document.title = `스타일로그 - ${currentMonth}월`;
    } else {
        document.title = `스타일로그 - ${currentYear}년`;
    }
    
    // 실제 데이터 로드
    await loadMonthData();
}

// 월별 데이터 로드
async function loadMonthData() {
    try {
        console.log('📅 데이터 로딩:', currentYear, '년', currentMonth ? `${currentMonth}월` : '전체');
        
        let logs;
        if (currentMonth) {
            // 특정 월의 데이터만
            logs = await StyleLogAPI.getByMonth(currentYear, currentMonth);
        } else {
            // 전체 연도의 데이터
            logs = await StyleLogAPI.getByYear(currentYear);
        }
        
        console.log('📊 받은 데이터:', logs);
        console.log('📊 데이터 개수:', logs ? logs.length : 0);
        
        // 기존 리스트 비우기
        const dayList = document.querySelector('.day-list');
        dayList.innerHTML = '';
        
        if (logs.length === 0) {
            console.log('📭 데이터 없음');
            dayList.innerHTML = `
                <div style="text-align: center; padding: 60px 20px; color: #999;">
                    <p>이 ${currentMonth ? '달' : '연도'}에는 기록이 없습니다.</p>
                    <button onclick="window.location.href='write.html?date=${currentYear}-${String(currentMonth || new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}'" 
                            style="margin-top: 20px; padding: 12px 24px; background: #67d5f5; color: white; border: none; border-radius: 8px; cursor: pointer;">
                        첫 기록 작성하기
                    </button>
                </div>
            `;
            return;
        }
        
        console.log('✅ 아이템 생성 중...');
        
        // 날짜순으로 정렬 (최신순)
        logs.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        // 최저/최고 기온이 없는 로그들을 찾아서 업데이트
        const updatePromises = logs.map(async (log) => {
            if ((log.weather_temp_min === null || log.weather_temp_min === undefined) &&
                (log.weather_temp_max === null || log.weather_temp_max === undefined)) {
                console.log(`⚠️ ${log.date} - 최저/최고 기온 없음. 날씨 API 재조회...`);
                const weatherData = await getWeatherByDate(log.date);
                
                if (weatherData && weatherData.tempMin !== null && weatherData.tempMax !== null) {
                    // DB 업데이트
                    await StyleLogAPI.update(log.id, {
                        weather_temp_min: weatherData.tempMin,
                        weather_temp_max: weatherData.tempMax,
                        weather_temp: weatherData.temp
                    });
                    
                    // log 객체 업데이트
                    log.weather_temp_min = weatherData.tempMin;
                    log.weather_temp_max = weatherData.tempMax;
                    log.weather_temp = weatherData.temp;
                    
                    console.log(`✅ ${log.date} - 날씨 데이터 업데이트 완료:`, weatherData);
                }
            }
        });
        
        // 모든 업데이트가 완료될 때까지 대기
        await Promise.all(updatePromises);
        
        // 날짜별로 그룹화하고 렌더링
        logs.forEach(log => {
            const dayItem = createDayItem(log);
            dayList.appendChild(dayItem);
        });
        
        // 이벤트 리스너 다시 등록
        attachEventListeners();
        console.log('✅ 로딩 완료');
        
    } catch (error) {
        console.error('❌ 데이터 로드 오류:', error);
        alert('데이터를 불러오는데 실패했습니다.');
    }
}

// 일별 아이템 생성
function createDayItem(log) {
    const date = new Date(log.date);
    const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    
    console.log('🔨 아이템 생성:', { id: log.id, date: log.date });
    
    const dayItem = document.createElement('div');
    dayItem.className = 'day-item';
    
    // 사진이 있는 경우
    if (log.photos && log.photos.length > 0) {
        dayItem.innerHTML = `
            <div class="day-left">
                <div class="day-date">
                    <div class="day-number">${date.getDate()}</div>
                    <div class="day-week">${days[date.getDay()]}</div>
                </div>
                <div class="weather-info-compact">
                    ${getWeatherIconSVG(log.weather || 'cloudy', 24)}
                    ${log.weather_temp_min !== null && log.weather_temp_max !== null ? 
                        `<div class="temp-compact">
                            <span class="temp-high">${Math.round(log.weather_temp_max)}°</span>
                            <span class="temp-low">${Math.round(log.weather_temp_min)}°</span>
                        </div>` : ''}
                </div>
            </div>
            <div class="day-content photo">
                <img src="${log.photos[0]}" alt="착장" onerror="this.src='https://via.placeholder.com/600x400?text=No+Image'">
                <button class="favorite-toggle-btn ${log.is_favorite ? 'active' : ''}" title="${log.is_favorite ? '즐겨찾기 해제' : '즐겨찾기 추가'}">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="${log.is_favorite ? '#ff6b6b' : 'none'}" stroke="${log.is_favorite ? '#ff6b6b' : '#666'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                    </svg>
                </button>
                <button class="item-menu-btn">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="5" r="1.5"></circle>
                        <circle cx="12" cy="12" r="1.5"></circle>
                        <circle cx="12" cy="19" r="1.5"></circle>
                    </svg>
                </button>
            </div>
        `;
    }
    // 텍스트만 있는 경우
    else {
        const contentPreview = log.content ? log.content.substring(0, 100) + (log.content.length > 100 ? '...' : '') : '';
        dayItem.innerHTML = `
            <div class="day-left">
                <div class="day-date">
                    <div class="day-number">${date.getDate()}</div>
                    <div class="day-week">${days[date.getDay()]}</div>
                </div>
                <div class="weather-info-compact">
                    ${getWeatherIconSVG(log.weather || 'cloudy', 24)}
                    ${log.weather_temp_min !== null && log.weather_temp_max !== null ? 
                        `<div class="temp-compact">
                            <span class="temp-high">${Math.round(log.weather_temp_max)}°</span>
                            <span class="temp-low">${Math.round(log.weather_temp_min)}°</span>
                        </div>` : ''}
                </div>
            </div>
            <div class="day-content text">
                <div class="quote-mark">"</div>
                <div class="memo-text">
                    <h3>${log.title || '제목 없음'}</h3>
                    <p>${contentPreview}</p>
                </div>
                <div class="quote-mark">"</div>
                <button class="favorite-toggle-btn ${log.is_favorite ? 'active' : ''}" title="${log.is_favorite ? '즐겨찾기 해제' : '즐겨찾기 추가'}">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="${log.is_favorite ? '#ff6b6b' : 'none'}" stroke="${log.is_favorite ? '#ff6b6b' : '#666'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                    </svg>
                </button>
                <button class="item-menu-btn">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="5" r="1.5"></circle>
                        <circle cx="12" cy="12" r="1.5"></circle>
                        <circle cx="12" cy="19" r="1.5"></circle>
                    </svg>
                </button>
            </div>
        `;
    }
    
    // innerHTML 후에 dataset과 버튼 속성 설정 (중요!)
    dayItem.dataset.logId = log.id;
    dayItem.dataset.date = log.date;
    
    // 메뉴 버튼 찾아서 data 속성 설정
    const menuBtn = dayItem.querySelector('.item-menu-btn');
    if (menuBtn) {
        menuBtn.setAttribute('data-log-id', log.id);
        menuBtn.setAttribute('data-date', log.date);
        console.log('✅ 버튼 속성 설정:', { id: log.id, date: log.date });
    } else {
        console.error('❌ 메뉴 버튼을 찾을 수 없음');
    }
    
    // 즐겨찾기 버튼 찾아서 data 속성 설정
    const favoriteBtn = dayItem.querySelector('.favorite-toggle-btn');
    if (favoriteBtn) {
        favoriteBtn.setAttribute('data-log-id', log.id);
        favoriteBtn.setAttribute('data-is-favorite', log.is_favorite ? 'true' : 'false');
    }
    
    return dayItem;
}

// 이벤트 리스너 등록
function attachEventListeners() {
    // 일별 아이템 클릭 - detail 페이지로 이동
    document.querySelectorAll('.day-item').forEach(item => {
        item.addEventListener('click', (e) => {
            // 메뉴 버튼이나 팝업, 즐겨찾기 버튼 클릭은 무시
            if (e.target.closest('.item-menu-btn') || 
                e.target.closest('.menu-popup') ||
                e.target.closest('.favorite-toggle-btn')) {
                return;
            }
            const date = item.dataset.date;
            window.location.href = `detail.html?date=${date}`;
        });
    });
    
    // 즐겨찾기 버튼 클릭
    document.querySelectorAll('.favorite-toggle-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            
            const logId = btn.getAttribute('data-log-id');
            const isFavorite = btn.getAttribute('data-is-favorite') === 'true';
            
            console.log('⭐ 즐겨찾기 토글:', { logId, currentState: isFavorite });
            
            if (!logId || logId === 'null') {
                alert('로그 정보를 찾을 수 없습니다.');
                return;
            }
            
            try {
                const newState = await toggleFavorite(logId, isFavorite, btn);
                // 버튼의 data-is-favorite 속성 업데이트
                btn.setAttribute('data-is-favorite', newState ? 'true' : 'false');
                btn.title = newState ? '즐겨찾기 해제' : '즐겨찾기 추가';
            } catch (error) {
                console.error('❌ 즐겨찾기 토글 오류:', error);
            }
        });
    });
    
    // 메뉴 버튼 클릭 - 이벤트 위임 방식으로 변경
    document.querySelectorAll('.item-menu-btn').forEach(btn => {
        // 기존 이벤트 리스너 제거 (중복 방지)
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        
        newBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            
            // 버튼에서 직접 읽기
            const logId = newBtn.getAttribute('data-log-id');
            const date = newBtn.getAttribute('data-date');
            
            console.log('🔍 메뉴 버튼 클릭:', { logId, date, button: newBtn });
            
            // 만약 버튼에 없으면 부모 day-item에서 읽기
            if (!logId || logId === 'null') {
                const dayItem = newBtn.closest('.day-item');
                const parentLogId = dayItem?.getAttribute('data-log-id');
                const parentDate = dayItem?.getAttribute('data-date');
                
                console.log('🔍 부모에서 읽기:', { parentLogId, parentDate });
                
                if (parentLogId && parentLogId !== 'null') {
                    showItemMenu(parentLogId, parentDate);
                    return;
                }
            }
            
            if (!logId || logId === 'null' || logId === 'undefined') {
                console.error('❌ 유효하지 않은 로그 ID:', logId);
                alert('로그 정보를 찾을 수 없습니다.');
                return;
            }
            
            showItemMenu(logId, date);
        });
    });
    
    console.log('✅ 이벤트 리스너 등록 완료, 버튼 개수:', document.querySelectorAll('.item-menu-btn').length);
}

// toggleFavorite, showItemMenu, closeItemMenu는 common.js에서 관리

// month-detail.js 전용 삭제 함수
async function deleteLogFromMenu(logId) {
    if (!logId || logId === 'null') {
        console.error('❌ 유효하지 않은 로그 ID:', logId);
        return;
    }
    
    if (!confirm('정말 이 기록을 삭제하시겠습니까?')) {
        return;
    }
    
    try {
        await StyleLogAPI.delete(logId);
        // 페이지 새로고침 또는 목록 업데이트
        const urlParams = new URLSearchParams(window.location.search);
        const year = urlParams.get('year') || new Date().getFullYear();
        const month = urlParams.get('month');
        
        if (month) {
            await loadMonthLogs(parseInt(year), parseInt(month));
        } else {
            await loadMonthLogs(parseInt(year), null);
        }
    } catch (error) {
        console.error('❌ 삭제 오류:', error);
        alert('삭제에 실패했습니다.');
    }
}

// 로그 삭제 (메뉴에서 호출)
async function deleteLogFromMenu(logId) {
    console.log('🗑️ 삭제 함수 호출:', logId);
    
    if (!logId || logId === 'null' || logId === 'undefined') {
        console.error('❌ 유효하지 않은 로그 ID:', logId);
        alert('로그 정보를 찾을 수 없습니다.');
        return;
    }
    
    if (!confirm('이 기록을 삭제하시겠습니까?')) {
        return;
    }
    
    try {
        console.log('🗑️ 삭제 시작:', logId);
        
        await StyleLogAPI.delete(logId);
        
        console.log('✅ 삭제 성공');
        
        // 화면에서 해당 아이템 찾기
        const dayItems = document.querySelectorAll('.day-item');
        let targetItem = null;
        
        dayItems.forEach(item => {
            const itemId = item.getAttribute('data-log-id');
            console.log('🔍 아이템 확인:', { itemId, searchId: logId, match: itemId === logId });
            if (itemId === logId) {
                targetItem = item;
            }
        });
        
        if (targetItem) {
            console.log('✅ 삭제할 아이템 찾음:', targetItem);
            // 애니메이션 후 제거
            targetItem.style.transition = 'opacity 0.3s, transform 0.3s';
            targetItem.style.opacity = '0';
            targetItem.style.transform = 'translateX(-20px)';
            
            setTimeout(() => {
                targetItem.remove();
                
                // 리스트가 비었는지 확인
                const dayList = document.querySelector('.day-list');
                if (dayList.children.length === 0) {
                    loadMonthData();
                }
            }, 300);
        } else {
            // 아이템을 찾지 못한 경우 페이지 새로고침
            console.log('⚠️ 아이템을 찾지 못함, 페이지 새로고침');
            window.location.reload();
        }
        
    } catch (error) {
        console.error('❌ 삭제 오류:', error);
        alert('삭제에 실패했습니다.');
    }
}

// 페이지 초기화는 month-detail.html의 인증 체크 후 실행됨
// initPage는 requireAuth() 완료 후 호출됨

// 뒤로가기 버튼
document.querySelector('.back-btn')?.addEventListener('click', () => {
    const year = urlParams.get('year') || new Date().getFullYear();
    window.location.href = `index.html?year=${year}`;
});

// 스크롤 시 헤더 그림자 효과
window.addEventListener('scroll', () => {
    const header = document.querySelector('.detail-header');
    if (header && window.scrollY > 10) {
        header.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)';
    } else if (header) {
        header.style.boxShadow = 'none';
    }
});

