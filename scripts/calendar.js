// 캘린더 화면 스크립트

// URL 파라미터에서 연도와 월 가져오기 (초기값: 최신 연도/현재 월)
const urlParams = new URLSearchParams(window.location.search);
let currentYear = parseInt(urlParams.get('year')) || new Date().getFullYear();
let currentMonth = parseInt(urlParams.get('month')) || (new Date().getMonth() + 1);

// 해당 월의 로그 데이터 저장
let monthLogs = [];
let yearsWithData = []; // 일기가 있는 연도 목록

// 캘린더 초기화
async function initCalendar(year, month) {
    currentYear = year;
    currentMonth = month;
    
    // 일기가 있는 연도 목록 로드
    await loadYearsWithData();
    
    // 연도 버튼 업데이트
    updateYearButton();
    
    // 연도 드롭다운 초기화
    initYearDropdown();
    
    // 해당 월의 로그 데이터 불러오기
    await loadMonthLogs();
    
    // 캘린더 렌더링
    renderCalendar();
}

// 일기가 있는 연도 목록 로드
async function loadYearsWithData() {
    try {
        console.log('📅 연도 목록 로딩 중...');
        
        // Supabase에서 모든 로그의 날짜를 가져와서 연도 추출
        const { data, error } = await supabaseClient
            .from('style_logs')
            .select('date')
            .order('date', { ascending: false });
        
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

// 연도 버튼 업데이트
function updateYearButton() {
    const yearBtn = document.querySelector('.year-btn span');
    if (yearBtn) {
        yearBtn.textContent = currentYear;
    }
}

// 연도 드롭다운 초기화
function initYearDropdown() {
    const yearBtn = document.querySelector('.year-btn');
    
    // 드롭다운이 없으면 생성
    let yearDropdown = document.getElementById('yearDropdown');
    if (!yearDropdown) {
        yearDropdown = document.createElement('div');
        yearDropdown.id = 'yearDropdown';
        yearDropdown.className = 'year-dropdown';
        document.querySelector('.year-selector').appendChild(yearDropdown);
    }
    
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
    
    // 기존 이벤트 리스너 제거 후 재등록
    const newYearBtn = yearBtn.cloneNode(true);
    yearBtn.parentNode.replaceChild(newYearBtn, yearBtn);
    
    // 연도 버튼 클릭 이벤트
    newYearBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleYearDropdown();
    });
    
    // 드롭다운 외부 클릭 시 닫기
    document.addEventListener('click', (e) => {
        if (!newYearBtn.contains(e.target) && !yearDropdown.contains(e.target)) {
            closeYearDropdown();
        }
    });
}

// 연도 드롭다운 토글
function toggleYearDropdown() {
    const yearBtn = document.querySelector('.year-btn');
    const yearDropdown = document.getElementById('yearDropdown');
    
    yearBtn.classList.toggle('active');
    yearDropdown.classList.toggle('active');
}

// 연도 드롭다운 닫기
function closeYearDropdown() {
    const yearBtn = document.querySelector('.year-btn');
    const yearDropdown = document.getElementById('yearDropdown');
    
    if (yearBtn) yearBtn.classList.remove('active');
    if (yearDropdown) yearDropdown.classList.remove('active');
}

// 연도 선택
function selectYear(year) {
    console.log('📅 연도 변경:', year);
    closeYearDropdown();
    
    // 페이지 리로드하여 선택한 연도의 데이터 표시 (현재 월 유지)
    window.location.href = `calendar.html?year=${year}&month=${currentMonth}`;
}

// 해당 월의 로그 데이터 불러오기
async function loadMonthLogs() {
    try {
        console.log(`📅 ${currentYear}년 ${currentMonth}월 로그 로딩 중...`);
        monthLogs = await StyleLogAPI.getByMonth(currentYear, currentMonth);
        console.log('✅ 로그 데이터:', monthLogs);
    } catch (error) {
        console.error('❌ 로그 로드 오류:', error);
        monthLogs = [];
    }
}

// 특정 날짜에 로그가 있는지 확인
function hasLogOnDate(day) {
    const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return monthLogs.some(log => log.date === dateStr);
}

// 캘린더 렌더링
function renderCalendar() {
    // 월 이름 업데이트
    const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 
                       'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    
    document.querySelector('.current-month').textContent = currentMonth;
    document.querySelector('.calendar-header .month-name').textContent = monthNames[currentMonth - 1];
    
    // 날짜 계산
    const firstDay = new Date(currentYear, currentMonth - 1, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
    
    // 날짜 컨테이너 비우기
    const datesContainer = document.querySelector('.dates');
    datesContainer.innerHTML = '';
    
    // 빈 셀 추가 (첫 날 이전)
    for (let i = 0; i < firstDay; i++) {
        const emptyCell = document.createElement('div');
        emptyCell.className = 'date-cell empty';
        datesContainer.appendChild(emptyCell);
    }
    
    // 날짜 셀 생성
    for (let day = 1; day <= daysInMonth; day++) {
        const dateCell = document.createElement('button');
        dateCell.className = 'date-cell';
        dateCell.textContent = day;
        
        // 요일 계산 (일요일: 0, 토요일: 6)
        const dayOfWeek = new Date(currentYear, currentMonth - 1, day).getDay();
        if (dayOfWeek === 0) dateCell.classList.add('sunday');
        if (dayOfWeek === 6) dateCell.classList.add('saturday');
        
        // 로그가 있는 날짜 표시
        if (hasLogOnDate(day)) {
            dateCell.classList.add('has-entry');
        }
        
        // 클릭 이벤트
        dateCell.addEventListener('click', () => handleDateClick(day, dateCell.classList.contains('has-entry')));
        
        datesContainer.appendChild(dateCell);
    }
    
    // 오늘 날짜 하이라이트
    highlightToday();
    
    console.log(`✅ ${currentYear}년 ${currentMonth}월 캘린더 렌더링 완료`);
}

// 날짜 클릭 핸들러
function handleDateClick(day, hasEntry) {
    const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    
    if (hasEntry) {
        // 일기가 있는 경우 - 해당 일기로 이동
        window.location.href = `detail.html?date=${dateStr}&referrer=calendar`;
    } else {
        // 일기가 없는 경우 - 확인 후 작성 화면으로
        const confirmed = confirm('이 날짜에 일기가 없습니다.\n새로 작성하시겠습니까?');
        if (confirmed) {
            window.location.href = `write.html?date=${dateStr}`;
        }
    }
}

// 검색 버튼
document.querySelector('.search-btn')?.addEventListener('click', () => {
    console.log('검색 모달 열기');
});

// 메뉴 관련 기능은 common.js로 이동됨

// 연도 선택 버튼
document.querySelector('.year-btn')?.addEventListener('click', () => {
    console.log('연도 선택 열기');
    showYearPicker();
});

// 작성 버튼
document.querySelector('.write-btn')?.addEventListener('click', () => {
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];
    window.location.href = `write.html?date=${dateStr}`;
});

// 캘린더 버튼 (토글)
document.querySelector('.calendar-btn')?.addEventListener('click', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const year = urlParams.get('year') || currentYear;
    window.location.href = `index.html?year=${year}`;
});

// 연도 선택 모달
function showYearPicker() {
    const years = [];
    for (let y = 2015; y <= new Date().getFullYear(); y++) {
        years.push(y);
    }
    
    // 연도 선택 UI 표시
    console.log('연도 선택:', years);
}

// 월 변경 (스와이프로 구현 가능)
async function changeMonth(direction) {
    currentMonth += direction;
    
    if (currentMonth > 12) {
        currentMonth = 1;
        currentYear++;
    } else if (currentMonth < 1) {
        currentMonth = 12;
        currentYear--;
    }
    
    // 새로운 월의 데이터 로드 및 렌더링
    await loadMonthLogs();
    renderCalendar();
}

// 스와이프 제스처 추가 (터치 이벤트)
let touchStartX = 0;
let touchEndX = 0;

const calendarCard = document.querySelector('.calendar-card');

calendarCard?.addEventListener('touchstart', (e) => {
    touchStartX = e.changedTouches[0].screenX;
});

calendarCard?.addEventListener('touchend', (e) => {
    touchEndX = e.changedTouches[0].screenX;
    handleSwipe();
});

function handleSwipe() {
    const swipeThreshold = 50;
    
    if (touchEndX < touchStartX - swipeThreshold) {
        // 왼쪽 스와이프 - 다음 월
        changeMonth(1);
        console.log('다음 월로 이동');
    }
    
    if (touchEndX > touchStartX + swipeThreshold) {
        // 오른쪽 스와이프 - 이전 월
        changeMonth(-1);
        console.log('이전 월로 이동');
    }
}

// 키보드 단축키
document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') {
        changeMonth(-1);
    } else if (e.key === 'ArrowRight') {
        changeMonth(1);
    }
});

// 오늘 날짜 하이라이트
function highlightToday() {
    const today = new Date();
    
    if (today.getMonth() + 1 === currentMonth && 
        today.getFullYear() === currentYear) {
        const todayDate = today.getDate();
        const cells = document.querySelectorAll('.date-cell');
        
        cells.forEach(cell => {
            if (parseInt(cell.textContent) === todayDate) {
                cell.style.border = '2px solid #67d5f5';
            }
        });
    }
}

// 페이지 로드 시
window.addEventListener('load', async () => {
    await initCalendar(currentYear, currentMonth);
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
            if (weatherDisplay) {
                const iconContainer = weatherDisplay.querySelector('.weather-icon');
                const tempSpan = weatherDisplay.querySelector('.weather-temp');
                
                if (iconContainer) {
                    iconContainer.outerHTML = getWeatherIconSVG(weather.weather, 24);
                }
                
                if (tempSpan) {
                    if (weather.temp !== null && weather.temp !== undefined) {
                        tempSpan.textContent = `${Math.round(weather.temp)}°C`;
                    }
                    
                    // 최저/최고 기온 추가
                    if (weather.tempMin !== null && weather.tempMax !== null) {
                        const existingRange = weatherDisplay.querySelector('.temp-range-inline');
                        if (existingRange) existingRange.remove();
                        
                        const tempRange = document.createElement('span');
                        tempRange.className = 'temp-range-inline';
                        tempRange.textContent = ` (${Math.round(weather.tempMin)}° ~ ${Math.round(weather.tempMax)}°)`;
                        tempSpan.after(tempRange);
                    }
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

