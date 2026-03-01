// 홈 화면 스크립트
// build: 20250302-thumb (photos 제외, thumb_url)
console.log('StyleLog home.js build 20250302-thumb');

// 상수
const PAGE_SIZE = 10;
const TEMP_FILTER_MIN = -20;
const TEMP_FILTER_MAX = 40;
const PX_PER_DAY_ITEM = 280;
const SCROLL_RESTORE_MAX_BATCH = 50;
const SCROLL_TOLERANCE = 10;
const INFINITE_SCROLL_ROOT_MARGIN = 400;
const WEATHER_API_DELAY_MS = 250;
const CONTENT_PREVIEW_LENGTH = 100;

// URL 파라미터에서 연도 가져오기
const urlParams = new URLSearchParams(window.location.search);
let initialYear = parseInt(urlParams.get('year')) || new Date().getFullYear();
let currentView = 'day';
let monthsWithData = [];
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
let filterFavoritesOnly = false;

function getDayListContainer() {
    return getDayListContainer();
}

// 페이지 초기화
async function initPage() {
    await loadYearsWithData();
    
    // 일별 리스트 모드용 클래스 추가
    const container = document.getElementById('homeView');
    if (container) {
        container.classList.add('day-view-active');
    }
    
    // 모든 연도의 데이터를 로드
    await loadAllDayList();
    
    // 스와이프 기능 초기화
    initSwipe();
    
    // 기온별 옷차림 캐러셀 스와이프 초기화
    initOutfitCarouselSwipe();
    
    // 필터 모달 초기화
    initFilterModal();

    // 상세에서 뒤로 왔을 때 스크롤 위치 복원 (완료될 때까지 await)
    await restoreHomeScrollPosition();
}

async function restoreHomeScrollPosition() {
    const saved = sessionStorage.getItem('homeScrollY');
    if (!saved) return;
    sessionStorage.removeItem('homeScrollY');
    const targetY = parseInt(saved, 10);
    if (isNaN(targetY) || targetY <= 0) {
        document.body.classList.remove('scroll-restore-pending');
        return;
    }

    const doScroll = () => window.scrollTo(0, targetY);

    await new Promise(resolve => {
        requestAnimationFrame(async () => {
            doScroll();
            while (hasMoreData && !isLoading) {
                const { scrollHeight, clientHeight } = document.documentElement;
                const maxScroll = scrollHeight - clientHeight;
                if (maxScroll >= targetY - SCROLL_TOLERANCE) break;
                const gap = targetY - maxScroll;
                const batchSize = Math.min(SCROLL_RESTORE_MAX_BATCH, Math.max(PAGE_SIZE, Math.ceil(gap / PX_PER_DAY_ITEM)));
                await loadMoreDayList(batchSize);
                doScroll();
            }
            resolve();
        });
    });

    document.body.classList.remove('scroll-restore-pending');
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

// (레거시 제거: initYearDropdown, loadMonthCards, loadDayList, view-toggle 등 - 현재 일별 리스트만 사용)
async function _legacyLoadMonthCardsPlaceholder() {
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
        const container = getDayListContainer();
        
        if (!container) {
            console.error('❌ .month-cards-container 요소를 찾을 수 없습니다');
            return;
        }
        
        // Month 뷰용 - 현재 호출되지 않음
        container.classList.remove('day-list-view');
        container.innerHTML = '';
        
        if (monthsWithData.length === 0) {
            console.log('📭 데이터 없음 - 안내 문구 표시');
            container.innerHTML = `
                <div class="util-empty util-empty--spacious">
                    <p>저장된 기록이 없습니다</p>
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
            
            // 이미지가 있는 첫 번째 로그 찾기 (thumb_url 사용 - photos 미포함)
            let representativeImage = null;
            for (const log of logs) {
                if (log.thumb_url) {
                    representativeImage = log.thumb_url;
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
        const container = getDayListContainer();
        if (container) {
            container.innerHTML = `
                <div class="util-error util-error--spacious">
                    <p class="util-error-title">데이터를 불러올 수 없습니다</p>
                    <p class="util-sub util-sub--spaced">Supabase 연결을 확인해주세요</p>
                    <p class="util-sub util-sub--sm">콘솔(F12)에서 에러를 확인하세요</p>
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
        const container = getDayListContainer();
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
            const container = getDayListContainer();
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
    
    // LEGACY: Month/Day 뷰 전환 - view-btn이 HTML에 없어 미호출
    if (container) {
        if (view === 'day') {
            container.classList.add('day-view-active');
        } else {
            container.classList.remove('day-view-active');
            document.body.classList.remove('header-scrolled-hidden');
            document.body.classList.remove('year-label-reached-top');
        }
    }
    
    switch(view) {
        case 'month':
            await loadMonthCards();
            break;
        case 'day':
            await loadDayList(year);
            break;
    }
}

// 일별 리스트 로드
async function loadDayList(year) {
    try {
        console.log('📅 일별 리스트 데이터 로딩:', year, '년');
        
        // 해당 연도의 모든 로그 가져오기
        const logs = await StyleLogAPI.getByYear(year);
        console.log('📊 받은 데이터:', logs);
        console.log('📊 데이터 개수:', logs ? logs.length : 0);
        
        const container = getDayListContainer();
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
                <div class="util-empty">
                    <p>이 연도에는 기록이 없습니다.</p>
                    <button class="util-btn-primary" onclick="window.location.href='write.html'">첫 기록 작성하기</button>
                </div>
            `;
            return;
        }
        
        // 날짜순으로 정렬 (최신순)
        logs.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        // 최저/최고 기온이 없는 로그들 순차 조회 (동시 요청 시 API 제한으로 실패할 수 있음)
        for (const log of logs) {
            if ((log.weather_temp_min === null || log.weather_temp_min === undefined) &&
                (log.weather_temp_max === null || log.weather_temp_max === undefined)) {
                const weatherData = await getWeatherByDate(log.date);
                
                if (weatherData?.unavailable && weatherData?.reason === 'future') {
                    continue; // 7일 이후 미래 날짜 → 스킵
                }
                if (weatherData && weatherData.tempMin != null && weatherData.tempMax != null) {
                    await StyleLogAPI.update(log.id, {
                        weather_temp_min: weatherData.tempMin,
                        weather_temp_max: weatherData.tempMax,
                        weather_temp: weatherData.temp
                    });
                    log.weather_temp_min = weatherData.tempMin;
                    log.weather_temp_max = weatherData.tempMax;
                    log.weather_temp = weatherData.temp;
                }
                await new Promise(r => setTimeout(r, WEATHER_API_DELAY_MS));
            }
        }
        
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
        console.log('✅ 일별 리스트 로딩 완료');
        
    } catch (error) {
        console.error('❌ 일별 리스트 데이터 로드 오류:', error);
        const container = getDayListContainer();
        if (container) {
            container.innerHTML = `
                <div class="util-error">
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
        
        const container = getDayListContainer();
        if (!container) {
            console.error('❌ .month-cards-container 요소를 찾을 수 없습니다');
            return;
        }
        
        // day-list 스타일 적용
        container.classList.add('day-list-view');
        container.innerHTML = '';
        
        // 스크롤 복원 시 초기 로드량 확대 (API 호출 1회로 커버)
        const savedY = parseInt(sessionStorage.getItem('homeScrollY') || '0', 10);
        const initialLimit = (savedY > 0)
            ? Math.min(SCROLL_RESTORE_MAX_BATCH, Math.max(PAGE_SIZE, Math.ceil(savedY / PX_PER_DAY_ITEM)))
            : PAGE_SIZE;
        await loadMoreDayList(initialLimit);
        
        // 무한 스크롤 이벤트 리스너 등록
        initInfiniteScroll();
        
        console.log('✅ 초기 데이터 로딩 완료');
        
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
async function loadMoreDayList(limit = PAGE_SIZE) {
    if (isLoading || !hasMoreData) {
        console.log('⏸️ 로딩 중이거나 더 이상 데이터 없음');
        return;
    }
    
    isLoading = true;
    
    // 로딩 인디케이터 표시
    showLoadingIndicator();
    
    try {
        console.log(`📊 데이터 로딩... offset: ${currentOffset}, limit: ${limit}`);
        
        // 페이지네이션으로 데이터 가져오기 (photos 제외, thumb_url만 - statement timeout 방지)
        const { data, error } = await supabaseClient
            .from('style_logs')
            .select('id,user_id,date,title,content,weather,weather_temp,weather_temp_min,weather_temp_max,weather_description,weather_fit,thumb_url,tags,is_favorite,created_at,updated_at')
            .order('date', { ascending: false })
            .range(currentOffset, currentOffset + limit - 1);
        
        if (error) throw error;
        
        console.log(`✅ ${data ? data.length : 0}개 로드됨`);
        
        // 더 이상 데이터가 없으면
        if (!data || data.length === 0) {
            hasMoreData = false;
            isLoading = false;
            hideLoadingIndicator();
            
            // 전체 데이터가 없으면 안내 메시지
            if (allLoadedLogs.length === 0) {
                const container = getDayListContainer();
                container.innerHTML = `
                    <div class="util-empty">
                        <p>저장된 기록이 없습니다.</p>
                        <button class="util-btn-primary" onclick="window.location.href='write.html'">첫 기록 작성하기</button>
                    </div>
                `;
            } else {
                // 모든 데이터를 불러온 경우 완료 메시지 표시 (필터 부합 항목이 있을 때만)
                if (getFilteredLogs().length > 0) showEndMessage();
            }
            return;
        }
        
        // 요청량보다 적게 받았으면 마지막 페이지
        if (data.length < limit) {
            hasMoreData = false;
        }
        
        // 로드된 데이터를 배열에 추가
        allLoadedLogs = [...allLoadedLogs, ...data];
        
        // 날씨 데이터 업데이트 (비동기로 백그라운드 처리)
        updateWeatherDataInBackground(data);
        
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
        hideLoadingIndicator();
    }
}

// 로딩 인디케이터 표시
function showLoadingIndicator() {
    // 이미 있으면 제거
    hideLoadingIndicator();
    
    const container = getDayListContainer();
    if (!container) return;
    
    const loader = document.createElement('div');
    loader.id = 'infinite-scroll-loader';
    loader.innerHTML = `
        <div class="util-infinite-loader">
            <div class="util-spinner"></div>
            <p>로딩 중...</p>
        </div>
    `;
    
    const sentinel = document.getElementById('infinite-scroll-sentinel');
    if (sentinel) container.insertBefore(loader, sentinel);
    else container.appendChild(loader);
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
    
    const container = getDayListContainer();
    if (!container) return;
    
    const endMsg = document.createElement('div');
    endMsg.id = 'end-message';
    endMsg.innerHTML = `
        <div class="util-end-message">
            <p>모든 기록을 불러왔습니다 ✨</p>
        </div>
    `;
    
    const sentinel = document.getElementById('infinite-scroll-sentinel');
    if (sentinel) container.insertBefore(endMsg, sentinel);
    else container.appendChild(endMsg);
}

// 날씨 데이터를 백그라운드에서 업데이트 (UI 렌더링을 차단하지 않음)
async function updateWeatherDataInBackground(logs) {
    const logsNeedingWeather = logs.filter(log => 
        (log.weather_temp_min === null || log.weather_temp_min === undefined) &&
        (log.weather_temp_max === null || log.weather_temp_max === undefined)
    );
    
    if (logsNeedingWeather.length === 0) return;
    
    // 순차 처리로 API 제한 회피 (동시 요청 시 일부 실패함)
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
                await new Promise(r => setTimeout(r, 250));
        } catch (error) {
            console.error(`❌ ${log.date} 날씨 업데이트 실패:`, error);
        }
        }
    })();
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

// 데이터를 UI에 렌더링 (DocumentFragment로 배치 reflow 최소화)
async function renderDayList(logs) {
    const container = getDayListContainer();
    if (!container) return;
    
    let previousYear = null;
    let previousMonth = null;
    const allYearLabels = container.querySelectorAll('.year-label-day-view');
    const allMonthLabels = container.querySelectorAll('.month-label-day-view');
    
    if (allYearLabels.length > 0) {
        previousYear = parseInt(allYearLabels[allYearLabels.length - 1].textContent);
    }
    if (allMonthLabels.length > 0) {
        previousMonth = parseInt(allMonthLabels[allMonthLabels.length - 1].textContent);
    }
    
    const fragment = document.createDocumentFragment();
    logs.forEach(log => {
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
    
    container.appendChild(fragment);
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

// 무한 스크롤 초기화 (IntersectionObserver 사용 - 빠른 스크롤 시에도 하단 감지)
let infiniteScrollObserver = null;

function initInfiniteScroll() {
    const container = getDayListContainer();
    if (!container) return;

    // 기존 관찰 해제
    if (infiniteScrollObserver) {
        infiniteScrollObserver.disconnect();
        infiniteScrollObserver = null;
    }

    // sentinel: 리스트 맨 아래에 두고 뷰포트에 들어오면 로드
    let sentinel = document.getElementById('infinite-scroll-sentinel');
    if (!sentinel) {
        sentinel = document.createElement('div');
        sentinel.id = 'infinite-scroll-sentinel';
        sentinel.style.cssText = 'height:1px;width:100%;pointer-events:none;';
        container.appendChild(sentinel);
    }

    infiniteScrollObserver = new IntersectionObserver(
        (entries) => {
            if (!entries[0]?.isIntersecting || isLoading || !hasMoreData) return;
            loadMoreDayList();
        },
        { root: null, rootMargin: `0px 0px ${INFINITE_SCROLL_ROOT_MARGIN}px 0px`, threshold: 0 }
    );
    infiniteScrollObserver.observe(sentinel);
}

// 일별 아이템 생성 (home.js용)
function createDayItemForHome(log) {
    const date = new Date(log.date);
    const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    
    const dayItem = document.createElement('div');
    dayItem.className = 'day-item';
    
    const weatherFitChip = (log.weather_fit && ['cold','good','hot'].includes(log.weather_fit))
        ? `<span class="day-weather-fit-chip day-weather-fit-chip--${log.weather_fit}">${log.weather_fit}</span>` : '';
    
    // 썸네일이 있는 경우 (thumb_url - 리스트용 소형 이미지)
    if (log.thumb_url) {
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
                    ${weatherFitChip}
                </div>
            </div>
            <div class="day-content photo">
                <img src="${log.thumb_url}" alt="착장" onerror="this.src='https://via.placeholder.com/600x400?text=No+Image'">
                <button class="favorite-toggle-btn ${log.is_favorite ? 'active' : ''}" title="${log.is_favorite ? '즐겨찾기 해제' : '즐겨찾기 추가'}">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="${log.is_favorite ? 'var(--color-favorite)' : 'none'}" stroke="${log.is_favorite ? 'var(--color-favorite)' : 'var(--color-icon-default)'}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
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
        const contentPreview = log.content ? log.content.substring(0, CONTENT_PREVIEW_LENGTH) + (log.content.length > CONTENT_PREVIEW_LENGTH ? '...' : '') : '';
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
                    ${weatherFitChip}
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
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="${log.is_favorite ? 'var(--color-favorite)' : 'none'}" stroke="${log.is_favorite ? 'var(--color-favorite)' : 'var(--color-icon-default)'}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
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
    
    if (!log.id) return dayItem;
    
    dayItem.dataset.logId = log.id;
    dayItem.dataset.date = log.date;
    
    const menuBtn = dayItem.querySelector('.item-menu-btn');
    if (menuBtn) {
        menuBtn.setAttribute('data-log-id', log.id);
        menuBtn.setAttribute('data-date', log.date);
    }
    
    // 즐겨찾기 버튼 찾아서 data 속성 설정
    const favoriteBtn = dayItem.querySelector('.favorite-toggle-btn');
    if (favoriteBtn) {
        favoriteBtn.setAttribute('data-log-id', log.id);
        favoriteBtn.setAttribute('data-is-favorite', log.is_favorite ? 'true' : 'false');
    }
    
    return dayItem;
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
            try {
                await StyleLogAPI.update(logId, { is_favorite: !isFavorite });
                favBtn.classList.toggle('active');
                favBtn.setAttribute('data-is-favorite', (!isFavorite).toString());
                favBtn.setAttribute('title', !isFavorite ? '즐겨찾기 해제' : '즐겨찾기 추가');
                const svg = favBtn.querySelector('svg');
                if (svg) {
                    svg.setAttribute('fill', !isFavorite ? 'var(--color-favorite)' : 'none');
                    svg.setAttribute('stroke', !isFavorite ? 'var(--color-favorite)' : 'var(--color-icon-default)');
                }
            } catch (err) {
                alert('즐겨찾기 변경에 실패했습니다.');
            }
                return;
            }
        
        // 메뉴 버튼
        const menuBtn = e.target.closest('.item-menu-btn');
        if (menuBtn) {
            e.stopPropagation();
            let logId = menuBtn.getAttribute('data-log-id');
            let date = menuBtn.getAttribute('data-date');
            if (!logId || logId === 'null' || logId === 'undefined') {
                logId = dayItem.getAttribute('data-log-id') || dayItem.dataset.logId;
                date = dayItem.getAttribute('data-date') || dayItem.dataset.date;
            }
            if (!logId || logId === 'null' || logId === 'undefined') {
                alert('로그 정보를 찾을 수 없습니다.');
                return;
            }
            if (typeof showItemMenu === 'function') {
                showItemMenu(logId, date,
                    (id, d) => { if (id) window.location.href = `write.html?id=${id}&date=${d}`; },
                    async (id) => {
                        if (confirm('정말 이 기록을 삭제하시겠습니까?')) {
                            try {
                                if (id && StyleLogAPI?.delete) {
                                    await StyleLogAPI.delete(id);
                                    alert('삭제되었습니다.');
                                    location.reload();
                                }
                            } catch (err) {
                                alert(`삭제에 실패했습니다: ${err?.message || '알 수 없는 오류'}`);
                            }
                        }
                    }
                );
            }
            return;
        }
        
        // day-item 클릭 (상세로 이동) - 메뉴/즐겨찾기 제외
        if (e.target.closest('.menu-popup')) return;
        const logId = dayItem.dataset.logId;
        if (logId) {
            sessionStorage.setItem('homeScrollY', String(window.scrollY || document.documentElement.scrollTop));
            window.location.href = `detail.html?id=${logId}`;
        }
    });
}

// 날씨 필터: 해당 날의 최저 ≥ low 이고 최고 ≤ high 인 기록만
function passesWeatherFilter(log) {
    const isFullRange = weatherFilterLow <= TEMP_FILTER_MIN && weatherFilterHigh >= TEMP_FILTER_MAX;
    if (!isFullRange) {
        if (log.weather_temp_min == null || log.weather_temp_max == null) return false;
        if (log.weather_temp_min < weatherFilterLow || log.weather_temp_max > weatherFilterHigh) return false;
    }
    if (filterYears.length > 0) {
        const y = new Date(log.date).getFullYear();
        if (!filterYears.includes(y)) return false;
    }
    if (filterMonths.length > 0) {
        const m = new Date(log.date).getMonth() + 1;
        if (!filterMonths.includes(m)) return false;
    }
    if (filterWeatherFit.length > 0) {
        const fit = log.weather_fit || 'good';
        if (!filterWeatherFit.includes(fit)) return false;
    }
    if (filterFavoritesOnly && !log.is_favorite) return false;
    return true;
}

// 필터 적용된 로그 목록
function getFilteredLogs() {
    return allLoadedLogs.filter(passesWeatherFilter);
}

// 적용된 필터 chip 목록 (표시용)
function getActiveFilterChips() {
    const chips = [];
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
    const isFullRange = weatherFilterLow <= TEMP_FILTER_MIN && weatherFilterHigh >= TEMP_FILTER_MAX;
    if (!isFullRange) chips.push({ key: 'temp', label: `${weatherFilterLow}°~${weatherFilterHigh}°`, value: 'temp' });
    if (filterFavoritesOnly) chips.push({ key: 'fav', label: '즐겨찾기만', value: 'fav' });
    return chips;
}

// 전체 리스트 클리어 후 재렌더링 (필터 변경 시, DocumentFragment 사용)
function renderFullDayList(logs) {
    const container = getDayListContainer();
    if (!container) return;
    
    container.innerHTML = '';
    
    if (logs.length === 0) {
        container.innerHTML = `<div class="util-empty"><p>해당 조건의 기록이 없습니다.</p></div>`;
        attachDayListEventListeners();
        return;
    }
    
    let previousYear = null;
    let previousMonth = null;
    const fragment = document.createDocumentFragment();
    
    logs.forEach(log => {
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
    
    container.appendChild(fragment);
    attachDayListEventListeners();
    if (container.classList.contains('day-list-view')) initInfiniteScroll();
}

// 필터 모달 초기화
function initFilterModal() {
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
    const yearOptions = document.getElementById('filterYearOptions');
    const monthOptions = document.getElementById('filterMonthOptions');
    const activeChipsEl = document.getElementById('filterActiveChips');
    const tabs = modal?.querySelectorAll('.filter-tab');
    const panels = modal?.querySelectorAll('.filter-tab-panel');
    const categoryChips = document.querySelectorAll('.filter-category-chip');

    function switchTab(tabId) {
        tabs?.forEach(t => {
            t.classList.toggle('active', t.dataset.tab === tabId);
        });
        panels?.forEach(p => {
            const panelId = p.id;
            const isActive = (tabId === 'year' && panelId === 'filterPanelYear') ||
                (tabId === 'month' && panelId === 'filterPanelMonth') ||
                (tabId === 'weatherFit' && panelId === 'filterPanelWeatherFit') ||
                (tabId === 'temp' && panelId === 'filterPanelTemp') ||
                (tabId === 'favorites' && panelId === 'filterPanelFavorites');
            p.classList.toggle('active', isActive);
        });
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
        const low = parseInt(sliderLow?.value ?? TEMP_FILTER_MIN);
        const high = parseInt(sliderHigh?.value ?? TEMP_FILTER_MAX);
        const favChecked = document.querySelector('input[name="filterFavorites"]:checked');
        const favOnly = favChecked?.value === 'only';
        return { years, months, weatherFit, low, high, favOnly };
    }

    function passesFilterWithState(log, state) {
        const { years, months, weatherFit, low, high, favOnly } = state;
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
        if (favOnly && !log.is_favorite) return false;
        return true;
    }

    function getFilteredCountFromModalUI() {
        const state = getFilterStateFromModalUI();
        return allLoadedLogs.filter(log => passesFilterWithState(log, state)).length;
    }

    function updateApplyButtonCount() {
        if (!applyBtn) return;
        const count = getFilteredCountFromModalUI();
        applyBtn.textContent = `${count}개 확인하기`;
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
            chips.push({ key: 'weatherFit', label: vals.join(', '), value: 'weatherFit' });
        }
        const low = parseInt(sliderLow?.value ?? TEMP_FILTER_MIN), high = parseInt(sliderHigh?.value ?? TEMP_FILTER_MAX);
        if (low > TEMP_FILTER_MIN || high < TEMP_FILTER_MAX) chips.push({ key: 'temp', label: `${low}°~${high}°`, value: 'temp' });
        const favChecked = document.querySelector('input[name="filterFavorites"]:checked');
        if (favChecked?.value === 'only') chips.push({ key: 'fav', label: '즐겨찾기만', value: 'fav' });
        return chips;
    }

    function updateModalChipsFromUI() {
        if (!modalActiveChipsEl) return;
        const chips = getChipsFromModalUI();
        filterModalEl?.classList.toggle('has-selection', chips.length > 0);
        updateApplyButtonCount();
        const chipsHTML = chips.map(c => `
            <span class="filter-active-chip" data-key="${c.key}">
                ${c.label}
                <button type="button" class="filter-active-chip-remove" data-key="${c.key}">×</button>
            </span>
        `).join('');
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
        } else if (key === 'temp') {
            if (sliderLow) sliderLow.value = TEMP_FILTER_MIN;
            if (sliderHigh) sliderHigh.value = TEMP_FILTER_MAX;
            if (valueLow) valueLow.textContent = `${TEMP_FILTER_MIN}° 이상`;
            if (valueHigh) valueHigh.textContent = `${TEMP_FILTER_MAX}° 이하`;
        } else if (key === 'fav') {
            const allRadio = document.querySelector('input[name="filterFavorites"][value=""]');
            if (allRadio) allRadio.checked = true;
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
        const yearChecks = document.querySelectorAll('#filterYearOptions input[type="checkbox"]');
        yearChecks.forEach(cb => { cb.checked = filterYears.includes(parseInt(cb.value)); });
        const monthChecks = document.querySelectorAll('#filterMonthOptions input');
        monthChecks.forEach(cb => { cb.checked = filterMonths.includes(parseInt(cb.value)); });
        document.querySelectorAll('#filterWeatherFitOptions input').forEach(cb => {
            cb.checked = filterWeatherFit.includes(cb.value);
        });
        document.querySelectorAll('input[name="filterFavorites"]').forEach(r => {
            r.checked = (r.value === 'only' && filterFavoritesOnly) || (r.value === '' && !filterFavoritesOnly);
        });
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
        const favChecked = document.querySelector('input[name="filterFavorites"]:checked');
        filterFavoritesOnly = favChecked?.value === 'only';
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
        const chipsHTML = chips.map(c => `
            <span class="filter-active-chip" data-key="${c.key}">
                ${c.label}
                <button type="button" class="filter-active-chip-remove" data-key="${c.key}">×</button>
            </span>
        `).join('');
        [activeChipsEl, modalActiveChipsEl].forEach(container => {
            if (!container) return;
            container.innerHTML = chipsHTML;
            container.querySelectorAll('.filter-active-chip, .filter-active-chip-remove').forEach(el => {
                el.addEventListener('click', () => {
                    const key = el.dataset.key || el.closest('.filter-active-chip')?.dataset.key;
                    removeFilterByKey(key);
                });
            });
        });
        const hasFilters = chips.length > 0;
        filterBar?.classList.toggle('has-active-filters', hasFilters);
        filterModalEl?.classList.toggle('has-active-filters', hasFilters);
        filterOpenBtn?.classList.toggle('has-active', hasFilters);
        const activeKeys = chips.map(c => c.key);
        categoryChips?.forEach(chip => {
            const tab = chip.dataset.tab;
            const keyMap = { year: 'year', month: 'months', weatherFit: 'weatherFit', temp: 'temp', favorites: 'fav' };
            chip.classList.toggle('has-filter', keyMap[tab] && activeKeys.includes(keyMap[tab]));
        });
    }

    function removeFilterByKey(key) {
        if (key === 'year') filterYears = [];
        else if (key === 'months') filterMonths = [];
        else if (key === 'weatherFit') filterWeatherFit = [];
        else if (key === 'temp') {
            weatherFilterLow = TEMP_FILTER_MIN;
            weatherFilterHigh = TEMP_FILTER_MAX;
            if (sliderLow) sliderLow.value = TEMP_FILTER_MIN;
            if (sliderHigh) sliderHigh.value = TEMP_FILTER_MAX;
        }
        else if (key === 'fav') filterFavoritesOnly = false;
        syncModalFromState();
        renderActiveChips();
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
            loadingEl.textContent = '필터 결과를 불러오는 중...';
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
                container.innerHTML = '<div class="util-filter-loading">필터 결과를 불러오는 중...</div>';
            }
            ensureAllDataLoadedForFilter(true).then(() => {
                const updated = getFilteredLogs();
                renderFullDayList(updated);
                if (updated.length > 0 && !hasMoreData) showEndMessage();
            });
        } else {
            const filtered = getFilteredLogs();
            renderFullDayList(filtered);
            if (filtered.length > 0 && !hasMoreData) showEndMessage();
        }
    }

    function doApply() {
        syncStateFromModal();
        closeModal();
        renderActiveChips();
        applyFilterAndRender();
    }

    function doResetModalOnly() {
        document.querySelectorAll('#filterYearOptions input').forEach(cb => { cb.checked = false; });
        document.querySelectorAll('#filterMonthOptions input').forEach(cb => { cb.checked = false; });
        document.querySelectorAll('#filterWeatherFitOptions input').forEach(cb => { cb.checked = false; });
        if (sliderLow) sliderLow.value = TEMP_FILTER_MIN;
        if (sliderHigh) sliderHigh.value = TEMP_FILTER_MAX;
        if (valueLow) valueLow.textContent = `${TEMP_FILTER_MIN}° 이상`;
        if (valueHigh) valueHigh.textContent = `${TEMP_FILTER_MAX}° 이하`;
        const allRadio = document.querySelector('input[name="filterFavorites"][value=""]');
        if (allRadio) allRadio.checked = true;
        updateModalChipsFromUI();
    }

    function doReset() {
        filterYears = [];
        filterMonths = [];
        filterWeatherFit = [];
        weatherFilterLow = TEMP_FILTER_MIN;
        weatherFilterHigh = TEMP_FILTER_MAX;
        filterFavoritesOnly = false;
        if (sliderLow) sliderLow.value = TEMP_FILTER_MIN;
        if (sliderHigh) sliderHigh.value = TEMP_FILTER_MAX;
        syncModalFromState();
        renderActiveChips();
        applyFilterAndRender();
        closeModal();
    }

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
        updateModalChipsFromUI();
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
        updateModalChipsFromUI();
    });

    modal?.addEventListener('change', (e) => {
        if (e.target.matches('#filterYearOptions input, #filterMonthOptions input, #filterWeatherFitOptions input, input[name="filterFavorites"]')) {
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

    // URL 파라미터 ?filter=fav → 즐겨찾기 필터 적용 (마이페이지 "즐겨찾기 보기" 링크용)
    if (new URLSearchParams(location.search).get('filter') === 'fav') {
        filterFavoritesOnly = true;
        syncModalFromState();
        renderActiveChips();
        applyFilterAndRender();
    }
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

// 기온별 옷차림 캐러셀 스와이프 (일기 상세 사진 스와이프와 동일 방식)
function initOutfitCarouselSwipe() {
    const slider = document.getElementById('outfitCarouselSlider');
    const indicators = document.querySelectorAll('#outfitCarouselIndicators .indicator');

    if (!slider || indicators.length === 0) return;

    let currentIndex = 0;
    let startX = 0;
    let currentX = 0;
    let isDragging = false;

    function updateSlider() {
        const offset = -currentIndex * slider.offsetWidth;
        slider.style.transform = `translateX(${offset}px)`;
        indicators.forEach((ind, idx) => ind.classList.toggle('active', idx === currentIndex));
    }

    const handleStart = (clientX) => {
        startX = clientX;
        currentX = clientX;
        isDragging = true;
        slider.style.transition = 'none';
    };

    const handleMove = (clientX) => {
        if (!isDragging) return;
        currentX = clientX;
        const diff = currentX - startX;
        const offset = -currentIndex * slider.offsetWidth + diff;
        slider.style.transform = `translateX(${offset}px)`;
    };

    const handleEnd = () => {
        if (!isDragging) return;
        isDragging = false;
        const diff = currentX - startX;
        const threshold = slider.offsetWidth / 4;
        slider.style.transition = 'transform 0.3s ease-out';
        if (diff > threshold && currentIndex > 0) currentIndex--;
        else if (diff < -threshold && currentIndex < indicators.length - 1) currentIndex++;
        updateSlider();
    };

    slider.addEventListener('touchstart', (e) => handleStart(e.touches[0].clientX), { passive: true });
    slider.addEventListener('touchmove', (e) => handleMove(e.touches[0].clientX), { passive: true });
    slider.addEventListener('touchend', handleEnd);

    slider.addEventListener('mousedown', (e) => {
        handleStart(e.clientX);
        e.preventDefault();
    });
    slider.addEventListener('mousemove', (e) => handleMove(e.clientX));
    slider.addEventListener('mouseup', handleEnd);
    slider.addEventListener('mouseleave', () => {
        if (isDragging) {
            isDragging = false;
            slider.style.transition = 'transform 0.3s ease-out';
            updateSlider();
        }
    });

    indicators.forEach((indicator, index) => {
        indicator.addEventListener('click', () => {
            currentIndex = index;
            updateSlider();
        });
    });

    updateSlider();
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
                <p class="util-sub" style="margin: 0;">로그인 중</p>
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
window.addEventListener('load', async () => {
    updateMenuUserInfo();
    await initPage();
    await updateTodayInfo();
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
                    iconContainer.outerHTML = getWeatherIconSVG(weather.weather, 24);
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
