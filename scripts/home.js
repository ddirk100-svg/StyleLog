// 홈 화면 스크립트

// URL 파라미터에서 연도 가져오기
const urlParams = new URLSearchParams(window.location.search);
let initialYear = parseInt(urlParams.get('year')) || new Date().getFullYear();
let currentView = 'day'; // year, month, day
let monthsWithData = []; // 데이터가 있는 월 목록
let yearsWithData = []; // 일기가 있는 연도 목록

// 페이지네이션 상태
let currentOffset = 0;
const PAGE_SIZE = 10; // 한 번에 10개씩 로드
let isLoading = false;
let hasMoreData = true;
let allLoadedLogs = []; // 로드된 모든 로그 저장

// 페이지 초기화
async function initPage() {
    // 일기가 있는 연도 목록 로드
    await loadYearsWithData();
    
    // Day 뷰일 때 container에 클래스 추가
    const container = document.getElementById('homeView');
    if (container) {
        container.classList.add('day-view-active');
    }
    
    // 모든 연도의 데이터를 로드
    await loadAllDayList();
    
    // 스와이프 기능 초기화
    initSwipe();
}

// 일기가 있는 연도 목록 로드
async function loadYearsWithData() {
    try {
        console.log('📅 연도 목록 로딩 중...');
        
        // Supabase에서 연도만 가져오기 (distinct)
        // date 컬럼만 select하고 정렬하여 중복 제거
        const { data, error } = await supabaseClient
            .from('style_logs')
            .select('date')
            .order('date', { ascending: false })
            .limit(1000); // 최대 1000개만 조회
        
        if (error) throw error;
        
        if (data && data.length > 0) {
            // 중복 제거하여 연도 목록 생성
            const years = [...new Set(data.map(log => new Date(log.date).getFullYear()))];
            yearsWithData = years.sort((a, b) => b - a); // 최신 연도가 위로
            console.log('✅ 일기가 있는 연도:', yearsWithData);
        } else {
            yearsWithData = [new Date().getFullYear()]; // 데이터 없으면 현재 연도만
        }
    } catch (error) {
        console.error('❌ 연도 목록 로드 오류:', error);
        yearsWithData = [new Date().getFullYear()];
    }
}

// 연도 드롭다운 초기화
function initYearDropdown() {
    const yearBtnText = document.getElementById('yearBtnText');
    const yearSelector = document.querySelector('.year-selector');
    const yearDropdown = document.getElementById('yearDropdown');
    const currentYear = parseInt(yearBtnText ? yearBtnText.textContent : initialYear);
    
    // 드롭다운 메뉴 생성
    yearDropdown.innerHTML = '';
    yearsWithData.forEach(year => {
        const item = document.createElement('button');
        item.className = 'year-dropdown-item';
        if (year === currentYear) {
            item.classList.add('selected');
        }
        item.textContent = year;
        item.addEventListener('click', () => {
            selectYear(year);
        });
        yearDropdown.appendChild(item);
    });
    
    // 연도 버튼 클릭 이벤트
    if (yearBtnText) {
        yearBtnText.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleYearDropdown();
        });
    }
    
    // 드롭다운 외부 클릭 시 닫기
    document.addEventListener('click', (e) => {
        if (yearSelector && !yearSelector.contains(e.target) && !yearDropdown.contains(e.target)) {
            closeYearDropdown();
        }
    });
}

// 연도 드롭다운 토글
function toggleYearDropdown() {
    const yearBtnText = document.getElementById('yearBtnText');
    const yearDropdown = document.getElementById('yearDropdown');
    
    if (yearBtnText) {
        yearBtnText.classList.toggle('active');
    }
    yearDropdown.classList.toggle('active');
}

// 연도 드롭다운 닫기
function closeYearDropdown() {
    const yearBtnText = document.getElementById('yearBtnText');
    const yearDropdown = document.getElementById('yearDropdown');
    
    if (yearBtnText) {
        yearBtnText.classList.remove('active');
    }
    yearDropdown.classList.remove('active');
}

// 연도 선택
async function selectYear(year) {
    console.log('📅 연도 변경:', year);
    closeYearDropdown();
    
    // 연도 버튼 텍스트 업데이트
    const yearBtnText = document.getElementById('yearBtnText');
    if (yearBtnText) {
        yearBtnText.textContent = year;
    }
    
    // initialYear 업데이트
    initialYear = year;
    
    // 항상 Day 뷰로 데이터 다시 로드
    await loadDayList(year);
}

// 월 카드 데이터 로드 및 생성
async function loadMonthCards() {
    try {
        console.log('📊 데이터 로딩 시작...');
        console.log('📊 요청 연도:', initialYear);
        
        // 현재 로그인한 사용자 확인
        const { data: { user } } = await supabaseClient.auth.getUser();
        console.log('👤 현재 로그인 사용자:', user ? user.email : 'None');
        console.log('👤 사용자 ID:', user ? user.id : 'None');
        
        // 해당 연도의 모든 로그 가져오기
        const logs = await StyleLogAPI.getByYear(initialYear);
        console.log('📊 받은 데이터:', logs);
        console.log('📊 데이터 개수:', logs ? logs.length : 0);
        
        // 각 로그의 user_id 확인
        if (logs && logs.length > 0) {
            console.log('🔍 각 로그의 user_id 확인:');
            logs.forEach((log, index) => {
                console.log(`  ${index + 1}. ${log.date} - user_id: ${log.user_id || 'NULL'} ${log.user_id === user?.id ? '✅ 내꺼' : '❌ 다른 사람'}`);
            });
        }
        
        // 월별로 그룹화
        const monthGroups = {};
        if (logs && logs.length > 0) {
            logs.forEach(log => {
                const month = new Date(log.date).getMonth() + 1; // 1-12
                if (!monthGroups[month]) {
                    monthGroups[month] = [];
                }
                monthGroups[month].push(log);
            });
        }
        
        // 데이터가 있는 월 목록
        monthsWithData = Object.keys(monthGroups).map(m => parseInt(m)).sort((a, b) => a - b);
        console.log('📊 데이터 있는 월:', monthsWithData);
        
        // 월 카드 생성
        const container = document.querySelector('.month-cards-container');
        
        if (!container) {
            console.error('❌ .month-cards-container 요소를 찾을 수 없습니다');
            return;
        }
        
        // day-list-view 클래스 제거 (Month 뷰로 전환)
        container.classList.remove('day-list-view');
        container.innerHTML = '';
        
        if (monthsWithData.length === 0) {
            console.log('📭 데이터 없음 - 안내 문구 표시');
            container.innerHTML = `
                <div style="width: 100%; text-align: center; padding: 100px 20px; color: #999;">
                    <p style="font-size: 16px; color: #999;">저장된 기록이 없습니다</p>
                </div>
            `;
            return;
        }
        
        console.log('📊 카드 생성 중...');
        const monthNamesKo = ['1월', '2월', '3월', '4월', '5월', '6월', 
                              '7월', '8월', '9월', '10월', '11월', '12월'];
        
        monthsWithData.forEach(month => {
            const count = monthGroups[month].length;
            const logs = monthGroups[month];
            
            // 날짜순으로 정렬 (빠른 날짜가 먼저)
            logs.sort((a, b) => new Date(a.date) - new Date(b.date));
            
            console.log(`📊 ${month}월 로그:`, logs);
            
            // 이미지가 있는 첫 번째 로그 찾기
            let representativeImage = null;
            for (const log of logs) {
                console.log(`  - 날짜: ${log.date}, 사진:`, log.photos);
                if (log.photos && log.photos.length > 0) {
                    representativeImage = log.photos[0];
                    console.log(`  ✅ 대표 이미지 선택: ${representativeImage}`);
                    break;
                }
            }
            
            const card = createMonthCard(month, monthNamesKo[month - 1], count, representativeImage);
            container.appendChild(card);
        });
        
        // 카드 클릭 이벤트 등록
        attachCardEvents();
        
        // 현재 월로 즉시 스크롤 (애니메이션 없이)
        setTimeout(() => scrollToCurrentMonthInstant(), 50);
        
    } catch (error) {
        console.error('❌ 월 카드 로드 오류:', error);
        
        // 에러 시에도 안내 메시지 표시
        const container = document.querySelector('.month-cards-container');
        if (container) {
            container.innerHTML = `
                <div style="width: 100%; text-align: center; padding: 80px 20px; color: #999;">
                    <h3 style="font-size: 18px; font-weight: 600; color: #666; margin-bottom: 12px;">
                        데이터를 불러올 수 없습니다
                    </h3>
                    <p style="font-size: 14px; color: #999; margin-bottom: 24px;">
                        Supabase 연결을 확인해주세요
                    </p>
                    <p style="font-size: 13px; color: #ccc;">
                        콘솔(F12)에서 에러를 확인하세요
                    </p>
                </div>
            `;
        }
        utils.showError('데이터를 불러오는데 실패했습니다.');
    } finally {
        utils.hideLoading();
    }
}

// 월 카드 생성
function createMonthCard(month, monthName, count, imageUrl = null) {
    const card = document.createElement('div');
    card.className = 'month-card';
    card.dataset.month = month;
    
    console.log(`🎨 카드 생성: ${monthName}, 이미지:`, imageUrl);
    
    // 이미지가 있으면 배경 이미지로 설정 (그라데이션 없이)
    if (imageUrl) {
        card.classList.add('has-image');
        card.style.backgroundImage = `url("${imageUrl}")`;
        card.style.backgroundSize = 'cover';
        card.style.backgroundPosition = 'center';
    }
    
    card.innerHTML = `
        <div class="month-card-content ${imageUrl ? 'with-image' : ''}">
            <div class="month-info">
                <span class="month-name">${monthName}</span>
                ${count > 0 ? `<span class="month-count">${count}개</span>` : ''}
            </div>
        </div>
    `;
    
    return card;
}

// 카드 이벤트 등록
function attachCardEvents() {
    // 월 카드 클릭 이벤트
    document.querySelectorAll('.month-card').forEach(card => {
        card.addEventListener('click', (e) => {
            const month = card.dataset.month;
            const yearBtnText = document.getElementById('yearBtnText');
            const year = yearBtnText ? yearBtnText.textContent : initialYear;
            window.location.href = `month-detail.html?year=${year}&month=${month}`;
        });
    });
}

// 현재 월로 즉시 스크롤 (애니메이션 없이)
function scrollToCurrentMonthInstant() {
    const currentMonth = new Date().getMonth() + 1; // 1-12
    const targetCard = document.querySelector(`[data-month="${currentMonth}"]`);
    
    if (targetCard) {
        const container = document.querySelector('.month-cards-container');
        const cardLeft = targetCard.offsetLeft;
        const cardWidth = targetCard.offsetWidth;
        const containerWidth = container.offsetWidth;
        
        // 카드를 중앙에 위치시키기 위한 스크롤 위치 계산
        const scrollPosition = cardLeft - (containerWidth / 2) + (cardWidth / 2);
        
        // 즉시 스크롤 (애니메이션 없이)
        container.scrollLeft = scrollPosition;
    } else if (monthsWithData.length > 0) {
        // 현재 월 데이터가 없으면 가장 최근 월로
        const lastMonth = monthsWithData[monthsWithData.length - 1];
        const lastCard = document.querySelector(`[data-month="${lastMonth}"]`);
        
        if (lastCard) {
            const container = document.querySelector('.month-cards-container');
            const cardLeft = lastCard.offsetLeft;
            const cardWidth = lastCard.offsetWidth;
            const containerWidth = container.offsetWidth;
            const scrollPosition = cardLeft - (containerWidth / 2) + (cardWidth / 2);
            container.scrollLeft = scrollPosition;
        }
    }
}

// 뷰 모드 토글 초기화
function initViewToggle() {
    const viewBtns = document.querySelectorAll('.view-btn');
    
    viewBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const view = btn.dataset.view;
            switchView(view);
        });
    });
}

// 뷰 모드 전환
async function switchView(view) {
    currentView = view;
    const yearBtnText = document.getElementById('yearBtnText');
    const year = yearBtnText ? parseInt(yearBtnText.textContent) : initialYear;
    const container = document.getElementById('homeView');
    
    // 버튼 활성화 상태 변경
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.view === view) {
            btn.classList.add('active');
        }
    });
    
    // Day 뷰일 때 container에 클래스 추가/제거
    if (container) {
        if (view === 'day') {
            container.classList.add('day-view-active');
        } else {
            container.classList.remove('day-view-active');
        }
    }
    
    // 뷰에 따라 다른 렌더링
    switch(view) {
        case 'month':
            // 월별 카드 뷰
            console.log('Month 뷰 활성화');
            await loadMonthCards();
            break;
        case 'day':
            // 일별 리스트 뷰
            console.log('Day 뷰 활성화');
            await loadDayList(year);
            break;
    }
}

// 일별 리스트 로드 (Day 뷰)
async function loadDayList(year) {
    try {
        console.log('📅 Day 뷰 데이터 로딩:', year, '년');
        
        // 해당 연도의 모든 로그 가져오기
        const logs = await StyleLogAPI.getByYear(year);
        console.log('📊 받은 데이터:', logs);
        console.log('📊 데이터 개수:', logs ? logs.length : 0);
        
        const container = document.querySelector('.month-cards-container');
        if (!container) {
            console.error('❌ .month-cards-container 요소를 찾을 수 없습니다');
            return;
        }
        
        // day-list 스타일 적용
        container.classList.add('day-list-view');
        container.innerHTML = '';
        
        if (logs.length === 0) {
            console.log('📭 데이터 없음');
            container.innerHTML = `
                <div style="text-align: center; padding: 60px 20px; color: #999;">
                    <p>이 연도에는 기록이 없습니다.</p>
                    <button onclick="window.location.href='write.html'" 
                            style="margin-top: 20px; padding: 12px 24px; background: #67d5f5; color: white; border: none; border-radius: 8px; cursor: pointer;">
                        첫 기록 작성하기
                    </button>
                </div>
            `;
            return;
        }
        
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
        
        // 날짜순으로 정렬 (최신순)
        logs.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        // 이전 월을 추적하여 월이 바뀔 때만 월 텍스트 표시
        let previousMonth = null;
        
        // 날짜별로 렌더링
        logs.forEach(log => {
            const date = new Date(log.date);
            const currentMonth = date.getMonth() + 1;
            
            // 월이 바뀌면 월 텍스트 표시
            if (previousMonth !== currentMonth) {
                const monthLabel = document.createElement('div');
                monthLabel.className = 'month-label-day-view';
                monthLabel.textContent = `${currentMonth}월`;
                container.appendChild(monthLabel);
                previousMonth = currentMonth;
            }
            
            const dayItem = createDayItemForHome(log);
            container.appendChild(dayItem);
        });
        
        // 이벤트 리스너 등록
        attachDayListEventListeners();
        console.log('✅ Day 뷰 로딩 완료');
        
    } catch (error) {
        console.error('❌ Day 뷰 데이터 로드 오류:', error);
        const container = document.querySelector('.month-cards-container');
        if (container) {
            container.innerHTML = `
                <div style="text-align: center; padding: 60px 20px; color: #ff3b30;">
                    <p>데이터를 불러오는데 실패했습니다.</p>
                </div>
            `;
        }
    }
}

// 모든 연도의 일별 리스트 로드 (초기 로드)
async function loadAllDayList() {
    try {
        console.log('📅 초기 데이터 로딩 중...');
        
        // 상태 초기화
        currentOffset = 0;
        hasMoreData = true;
        allLoadedLogs = [];
        
        const container = document.querySelector('.month-cards-container');
        if (!container) {
            console.error('❌ .month-cards-container 요소를 찾을 수 없습니다');
            return;
        }
        
        // day-list 스타일 적용
        container.classList.add('day-list-view');
        container.innerHTML = '';
        
        // 첫 페이지 로드
        await loadMoreDayList();
        
        // 무한 스크롤 이벤트 리스너 등록
        initInfiniteScroll();
        
        console.log('✅ 초기 데이터 로딩 완료');
        
    } catch (error) {
        console.error('❌ 데이터 로드 오류:', error);
        const container = document.querySelector('.month-cards-container');
        if (container) {
            container.innerHTML = `
                <div style="text-align: center; padding: 60px 20px; color: #ff3b30;">
                    <p style="font-size: 16px; margin-bottom: 12px;">데이터를 불러오는데 실패했습니다.</p>
                    <p style="font-size: 14px; color: #999;">${error.message || '알 수 없는 오류'}</p>
                    <button onclick="location.reload()" 
                            style="margin-top: 20px; padding: 12px 24px; background: #67d5f5; color: white; border: none; border-radius: 8px; cursor: pointer;">
                        다시 시도
                    </button>
                </div>
            `;
        }
    }
}

// 추가 데이터 로드 (페이지네이션)
async function loadMoreDayList() {
    if (isLoading || !hasMoreData) {
        console.log('⏸️ 로딩 중이거나 더 이상 데이터 없음');
        return;
    }
    
    isLoading = true;
    
    // 로딩 인디케이터 표시
    showLoadingIndicator();
    
    try {
        console.log(`📊 데이터 로딩... offset: ${currentOffset}, limit: ${PAGE_SIZE}`);
        
        // 페이지네이션으로 데이터 가져오기
        const { data, error } = await supabaseClient
            .from('style_logs')
            .select('*')
            .order('date', { ascending: false })
            .range(currentOffset, currentOffset + PAGE_SIZE - 1);
        
        if (error) throw error;
        
        console.log(`✅ ${data ? data.length : 0}개 로드됨`);
        
        // 더 이상 데이터가 없으면
        if (!data || data.length === 0) {
            hasMoreData = false;
            isLoading = false;
            hideLoadingIndicator();
            
            // 전체 데이터가 없으면 안내 메시지
            if (allLoadedLogs.length === 0) {
                const container = document.querySelector('.month-cards-container');
                container.innerHTML = `
                    <div style="text-align: center; padding: 60px 20px; color: #999;">
                        <p>저장된 기록이 없습니다.</p>
                        <button onclick="window.location.href='write.html'" 
                                style="margin-top: 20px; padding: 12px 24px; background: #67d5f5; color: white; border: none; border-radius: 8px; cursor: pointer;">
                            첫 기록 작성하기
                        </button>
                    </div>
                `;
            } else {
                // 모든 데이터를 불러온 경우 완료 메시지 표시
                showEndMessage();
            }
            return;
        }
        
        // 페이지 크기보다 적게 받았으면 마지막 페이지
        if (data.length < PAGE_SIZE) {
            hasMoreData = false;
        }
        
        // 로드된 데이터를 배열에 추가
        allLoadedLogs = [...allLoadedLogs, ...data];
        
        // 날씨 데이터 업데이트 (비동기로 백그라운드 처리)
        updateWeatherDataInBackground(data);
        
        // UI에 렌더링
        await renderDayList(data);
        
        // 다음 페이지를 위해 offset 증가
        currentOffset += PAGE_SIZE;
        
        // 마지막 페이지면 완료 메시지 표시
        if (!hasMoreData) {
            showEndMessage();
        }
        
    } catch (error) {
        console.error('❌ 추가 데이터 로드 오류:', error);
        hasMoreData = false;
    } finally {
        isLoading = false;
        hideLoadingIndicator();
    }
}

// 로딩 인디케이터 표시
function showLoadingIndicator() {
    // 이미 있으면 제거
    hideLoadingIndicator();
    
    const container = document.querySelector('.month-cards-container');
    if (!container) return;
    
    const loader = document.createElement('div');
    loader.id = 'infinite-scroll-loader';
    loader.innerHTML = `
        <div style="
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 40px 20px;
            gap: 12px;
        ">
            <div style="
                width: 40px;
                height: 40px;
                border: 3px solid #f3f3f3;
                border-top: 3px solid #67d5f5;
                border-radius: 50%;
                animation: spin 1s linear infinite;
            "></div>
            <p style="
                font-size: 14px;
                color: #999;
                margin: 0;
            ">로딩 중...</p>
        </div>
        <style>
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        </style>
    `;
    
    container.appendChild(loader);
}

// 로딩 인디케이터 숨기기
function hideLoadingIndicator() {
    const loader = document.getElementById('infinite-scroll-loader');
    if (loader) {
        loader.remove();
    }
}

// 끝 메시지 표시
function showEndMessage() {
    // 이미 있으면 제거
    const existingMsg = document.getElementById('end-message');
    if (existingMsg) return;
    
    const container = document.querySelector('.month-cards-container');
    if (!container) return;
    
    const endMsg = document.createElement('div');
    endMsg.id = 'end-message';
    endMsg.innerHTML = `
        <div style="
            text-align: center;
            padding: 40px 20px;
            color: #999;
            font-size: 14px;
        ">
            <p style="margin: 0;">모든 기록을 불러왔습니다 ✨</p>
        </div>
    `;
    
    container.appendChild(endMsg);
}

// 날씨 데이터를 백그라운드에서 업데이트 (UI 렌더링을 차단하지 않음)
async function updateWeatherDataInBackground(logs) {
    // 최저/최고 기온이 없는 로그들만 필터링
    const logsNeedingWeather = logs.filter(log => 
        (log.weather_temp_min === null || log.weather_temp_min === undefined) &&
        (log.weather_temp_max === null || log.weather_temp_max === undefined)
    );
    
    if (logsNeedingWeather.length === 0) return;
    
    console.log(`⚠️ ${logsNeedingWeather.length}개 로그의 날씨 데이터 업데이트 시작...`);
    
    // 백그라운드에서 비동기로 처리 (await 하지 않음)
    Promise.all(logsNeedingWeather.map(async (log) => {
        try {
            // 2025년 이전 데이터는 날씨 API에서 가져올 수 없으므로 스킵
            const logYear = new Date(log.date).getFullYear();
            if (logYear < 2025) {
                console.log(`⏭️ ${log.date} - 2025년 이전 데이터, 날씨 업데이트 스킵`);
                return;
            }
            
            const weatherData = await getWeatherByDate(log.date);
            
            if (weatherData && weatherData.tempMin !== null && weatherData.tempMax !== null) {
                // DB 업데이트
                await StyleLogAPI.update(log.id, {
                    weather_temp_min: weatherData.tempMin,
                    weather_temp_max: weatherData.tempMax,
                    weather_temp: weatherData.temp
                });
                
                // 메모리의 log 객체도 업데이트
                log.weather_temp_min = weatherData.tempMin;
                log.weather_temp_max = weatherData.tempMax;
                log.weather_temp = weatherData.temp;
                
                // UI 업데이트 (해당 아이템만)
                updateDayItemWeather(log.id, weatherData);
                
                console.log(`✅ ${log.date} - 날씨 데이터 업데이트 완료`);
            }
        } catch (error) {
            console.error(`❌ ${log.date} 날씨 업데이트 실패:`, error);
        }
    })).then(() => {
        console.log('✅ 백그라운드 날씨 업데이트 완료');
    });
}

// 특정 아이템의 날씨 정보만 업데이트
function updateDayItemWeather(logId, weatherData) {
    const dayItem = document.querySelector(`[data-log-id="${logId}"]`);
    if (!dayItem) return;
    
    const weatherInfo = dayItem.querySelector('.weather-info-compact');
    if (!weatherInfo) return;
    
    const tempCompact = weatherInfo.querySelector('.temp-compact');
    if (tempCompact && weatherData.tempMin !== null && weatherData.tempMax !== null) {
        tempCompact.innerHTML = `
            <span class="temp-high">${Math.round(weatherData.tempMax)}°</span>
            <span class="temp-low">${Math.round(weatherData.tempMin)}°</span>
        `;
    }
}

// 데이터를 UI에 렌더링
async function renderDayList(logs) {
    const container = document.querySelector('.month-cards-container');
    if (!container) return;
    
    // 이전 연도와 월을 추적하여 연도/월이 바뀔 때 레이블 표시
    let previousYear = null;
    let previousMonth = null;
    
    // 이미 렌더링된 마지막 항목의 연도/월 확인
    const allYearLabels = container.querySelectorAll('.year-label-day-view');
    const allMonthLabels = container.querySelectorAll('.month-label-day-view');
    
    if (allYearLabels.length > 0) {
        const lastYearLabel = allYearLabels[allYearLabels.length - 1];
        previousYear = parseInt(lastYearLabel.textContent);
    }
    if (allMonthLabels.length > 0) {
        const lastMonthLabel = allMonthLabels[allMonthLabels.length - 1];
        previousMonth = parseInt(lastMonthLabel.textContent);
    }
    
    // 날짜별로 렌더링
    logs.forEach(log => {
        const date = new Date(log.date);
        const currentYear = date.getFullYear();
        const currentMonth = date.getMonth() + 1;
        
        // 연도가 바뀌면 연도 레이블 표시
        if (previousYear !== currentYear) {
            const yearLabel = document.createElement('div');
            yearLabel.className = 'year-label-day-view';
            yearLabel.textContent = `${currentYear}년`;
            container.appendChild(yearLabel);
            previousYear = currentYear;
            previousMonth = null; // 연도가 바뀌면 월도 리셋
        }
        
        // 월이 바뀌면 월 텍스트 표시
        if (previousMonth !== currentMonth) {
            const monthLabel = document.createElement('div');
            monthLabel.className = 'month-label-day-view';
            monthLabel.textContent = `${currentMonth}월`;
            container.appendChild(monthLabel);
            previousMonth = currentMonth;
        }
        
        const dayItem = createDayItemForHome(log);
        container.appendChild(dayItem);
    });
    
    // 이벤트 리스너 등록
    attachDayListEventListeners();
}

// 무한 스크롤 초기화
function initInfiniteScroll() {
    // Day 뷰에서는 window(body)가 스크롤 컨테이너
    // 기존 이벤트 리스너 제거 (중복 방지)
    window.removeEventListener('scroll', handleInfiniteScroll);
    
    // 새 이벤트 리스너 등록
    window.addEventListener('scroll', handleInfiniteScroll);
    
    console.log('✅ 무한 스크롤 초기화 완료 (window scroll)');
}

// 무한 스크롤 핸들러
function handleInfiniteScroll() {
    // body의 스크롤 위치 사용
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollHeight = document.documentElement.scrollHeight;
    const clientHeight = window.innerHeight;
    
    const distanceFromBottom = scrollHeight - (scrollTop + clientHeight);
    
    if (distanceFromBottom < 500 && !isLoading && hasMoreData) {
        console.log('📜 스크롤 바닥 근처 - 추가 데이터 로드');
        loadMoreDayList();
    }
}

// 일별 아이템 생성 (home.js용)
function createDayItemForHome(log) {
    const date = new Date(log.date);
    const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    
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
    
    // innerHTML 후에 dataset과 버튼 속성 설정
    if (!log.id) {
        console.error('❌ 로그 ID가 없습니다:', log);
        return dayItem;
    }
    
    dayItem.dataset.logId = log.id;
    dayItem.dataset.date = log.date;
    
    // 메뉴 버튼 찾아서 data 속성 설정
    const menuBtn = dayItem.querySelector('.item-menu-btn');
    if (menuBtn) {
        menuBtn.setAttribute('data-log-id', log.id);
        menuBtn.setAttribute('data-date', log.date);
        console.log('✅ 메뉴 버튼 속성 설정:', { id: log.id, date: log.date });
    } else {
        console.error('❌ 메뉴 버튼을 찾을 수 없습니다');
    }
    
    // 즐겨찾기 버튼 찾아서 data 속성 설정
    const favoriteBtn = dayItem.querySelector('.favorite-toggle-btn');
    if (favoriteBtn) {
        favoriteBtn.setAttribute('data-log-id', log.id);
        favoriteBtn.setAttribute('data-is-favorite', log.is_favorite ? 'true' : 'false');
    }
    
    return dayItem;
}

// Day 뷰 이벤트 리스너 등록
function attachDayListEventListeners() {
    // 일별 아이템 클릭 - detail 페이지로 이동
    document.querySelectorAll('.day-item').forEach(item => {
        item.addEventListener('click', (e) => {
            // 메뉴 버튼이나 팝업, 즐겨찾기 버튼 클릭은 무시
            if (e.target.closest('.item-menu-btn') || 
                e.target.closest('.menu-popup') ||
                e.target.closest('.favorite-toggle-btn')) {
                return;
            }
            const logId = item.dataset.logId;
            if (logId) {
                window.location.href = `detail.html?id=${logId}`;
            } else {
                console.error('❌ 로그 ID 없음:', item);
            }
        });
    });
    
    // 즐겨찾기 버튼 클릭
    document.querySelectorAll('.favorite-toggle-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            
            const logId = btn.getAttribute('data-log-id');
            const isFavorite = btn.getAttribute('data-is-favorite') === 'true';
            
            if (!logId) {
                console.error('❌ 로그 ID 없음');
                return;
            }
            
            try {
                await StyleLogAPI.update(logId, { is_favorite: !isFavorite });
                
                // UI 업데이트
                btn.classList.toggle('active');
                btn.setAttribute('data-is-favorite', (!isFavorite).toString());
                btn.setAttribute('title', !isFavorite ? '즐겨찾기 해제' : '즐겨찾기 추가');
                
                // SVG fill 업데이트
                const svg = btn.querySelector('svg');
                if (svg) {
                    svg.setAttribute('fill', !isFavorite ? '#ff6b6b' : 'none');
                    svg.setAttribute('stroke', !isFavorite ? '#ff6b6b' : '#666');
                }
                
                console.log('✅ 즐겨찾기 토글 완료');
            } catch (error) {
                console.error('❌ 즐겨찾기 토글 오류:', error);
                alert('즐겨찾기 변경에 실패했습니다.');
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
            let logId = newBtn.getAttribute('data-log-id');
            let date = newBtn.getAttribute('data-date');
            
            console.log('🔍 메뉴 버튼 클릭:', { logId, date, button: newBtn });
            
            // 만약 버튼에 없으면 부모 day-item에서 읽기
            if (!logId || logId === 'null' || logId === 'undefined') {
                const dayItem = newBtn.closest('.day-item');
                if (dayItem) {
                    logId = dayItem.getAttribute('data-log-id') || dayItem.dataset.logId;
                    date = dayItem.getAttribute('data-date') || dayItem.dataset.date;
                }
                
                console.log('🔍 부모에서 읽기:', { logId, date });
            }
            
            if (!logId || logId === 'null' || logId === 'undefined') {
                console.error('❌ 유효하지 않은 로그 ID:', logId);
                alert('로그 정보를 찾을 수 없습니다.');
                return;
            }
            
            // common.js의 showItemMenu 사용
            if (typeof showItemMenu === 'function') {
                console.log('📋 메뉴 열기:', { logId, date });
                showItemMenu(logId, date, 
                    // 수정 버튼 클릭 시
                    (id, date) => {
                        console.log('✏️ 수정 콜백 호출:', { id, date });
                        if (!id || id === 'null' || id === 'undefined') {
                            console.error('❌ 유효하지 않은 로그 ID:', id);
                            alert('로그 정보를 찾을 수 없습니다.');
                            return;
                        }
                        window.location.href = `write.html?id=${id}&date=${date}`;
                    },
                    // 삭제 버튼 클릭 시
                    async (id) => {
                        if (confirm('정말 이 기록을 삭제하시겠습니까?')) {
                            try {
                                console.log('🗑️ 삭제 시작:', id);
                                
                                if (!id || id === 'null' || id === 'undefined') {
                                    throw new Error('유효하지 않은 로그 ID입니다.');
                                }
                                
                                if (typeof StyleLogAPI === 'undefined' || !StyleLogAPI.delete) {
                                    throw new Error('StyleLogAPI가 정의되지 않았습니다.');
                                }
                                
                                const result = await StyleLogAPI.delete(id);
                                console.log('✅ 삭제 성공:', result);
                                alert('삭제되었습니다.');
                                location.reload();
                            } catch (error) {
                                console.error('❌ 삭제 오류:', error);
                                console.error('오류 상세:', {
                                    message: error.message,
                                    code: error.code,
                                    details: error.details,
                                    hint: error.hint
                                });
                                alert(`삭제에 실패했습니다: ${error.message || '알 수 없는 오류'}`);
                            }
                        }
                    }
                );
            } else {
                console.error('❌ showItemMenu 함수를 찾을 수 없습니다.');
            }
        });
    });
}

// 스와이프 기능 초기화
function initSwipe() {
    const container = document.querySelector('.month-cards-container');
    if (!container) return;
    
    // day-list-view일 때는 스와이프 비활성화
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
            menuUserInfo.innerHTML = `
                <p style="font-weight: 600; margin-bottom: 4px;">${user.email}</p>
                <p style="font-size: 14px; color: #999;">로그인 중</p>
            `;
        }
    } catch (error) {
        console.error('사용자 정보 로드 오류:', error);
        menuUserInfo.innerHTML = `<p>사용자 정보를 불러올 수 없습니다.</p>`;
    }
}

// 페이지 로드 시 사용자 정보 업데이트
window.addEventListener('load', () => {
    updateMenuUserInfo();
});

// 작성 버튼
document.querySelector('.write-btn')?.addEventListener('click', () => {
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];
    window.location.href = `write.html?date=${dateStr}`;
});

// 즐겨찾기 버튼
document.querySelector('.favorite-btn')?.addEventListener('click', () => {
    window.location.href = 'favorite.html';
});

// 캘린더 버튼
document.querySelector('.calendar-btn')?.addEventListener('click', () => {
    const year = document.querySelector('.year-btn span').textContent;
    const currentMonth = new Date().getMonth() + 1;
    window.location.href = `calendar.html?year=${year}&month=${currentMonth}`;
});

// 페이지 로드 시 초기화
window.addEventListener('load', () => {
    initPage();
    updateTodayInfo(); // 오늘 날짜와 날씨 업데이트
});

// 오늘 날짜와 날씨 정보 업데이트
async function updateTodayInfo() {
    console.log('📅 날짜/날씨 업데이트 시작');
    
    // 날짜 업데이트
    const todayDateEl = document.getElementById('todayDate');
    if (todayDateEl) {
        const today = new Date();
        const days = ['일', '월', '화', '수', '목', '금', '토'];
        const month = today.getMonth() + 1;
        const date = today.getDate();
        const day = days[today.getDay()];
        
        todayDateEl.textContent = `${month}월 ${date}일 ${day}요일`;
        console.log('📅 날짜:', todayDateEl.textContent);
    }
    
    // 날씨 업데이트
    try {
        const weather = await getCurrentWeather();
        console.log('🌤️ 날씨 데이터:', weather);
        
        if (weather) {
            const weatherDisplay = document.getElementById('weatherDisplay');
            const bottomSection = document.querySelector('.bottom-section');
            
            if (weatherDisplay) {
                const iconContainer = weatherDisplay.querySelector('.weather-icon');
                const tempSpan = weatherDisplay.querySelector('.weather-temp');
                
                if (iconContainer) {
                    iconContainer.outerHTML = getWeatherIconSVG(weather.weather, 32);
                }
                
                if (tempSpan) {
                    // 최저/최고 기온만 표시
                    if (weather.tempMin !== null && weather.tempMax !== null) {
                        tempSpan.innerHTML = `<span class="temp-low">${Math.round(weather.tempMin)}°</span> / <span class="temp-high">${Math.round(weather.tempMax)}°</span>`;
                    } else {
                        tempSpan.textContent = '--°C';
                    }
                }
                
                // 날씨에 따라 배경 색상 클래스 추가
                if (bottomSection) {
                    // 기존 날씨 클래스 제거
                    bottomSection.classList.remove('weather-sunny', 'weather-cloudy', 'weather-rainy', 'weather-snowy', 'weather-lightning');
                    // 새로운 날씨 클래스 추가
                    const weatherClass = `weather-${weather.weather}`;
                    bottomSection.classList.add(weatherClass);
                }
                
                console.log('✅ 날씨 표시 완료');
            }
        } else {
            console.warn('⚠️ 날씨 데이터 없음');
        }
    } catch (error) {
        console.error('❌ 날씨 로드 오류:', error);
    }
}
