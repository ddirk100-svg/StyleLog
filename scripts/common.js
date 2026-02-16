// 공통 함수들
const WEATHER_FIT_LABELS = { cold: 'cold', good: 'good', hot: 'hot' };

// 아이템 메뉴 표시
function showItemMenu(logId, date, onEdit, onDelete) {
    console.log('📋 showItemMenu 호출:', { logId, date });
    
    const menuPopup = document.getElementById('itemMenuPopup');
    if (!menuPopup) {
        console.error('❌ itemMenuPopup을 찾을 수 없습니다');
        return;
    }
    
    // 팝업 열기
    menuPopup.classList.add('active');
    document.body.style.overflow = 'hidden';
    
    // 기존 이벤트 리스너 제거 (중복 방지)
    const editBtn = menuPopup.querySelector('.edit-menu-btn');
    const deleteBtn = menuPopup.querySelector('.delete-menu-btn');
    const cancelBtn = menuPopup.querySelector('.cancel-menu-btn');
    const overlay = menuPopup.querySelector('.menu-overlay');
    
    // 버튼들을 복제하여 이벤트 리스너 초기화
    if (editBtn) {
        const newEditBtn = editBtn.cloneNode(true);
        editBtn.parentNode.replaceChild(newEditBtn, editBtn);
        
        newEditBtn.addEventListener('click', () => {
            console.log('✏️ 수정 버튼 클릭:', { logId, date });
            closeItemMenu();
            if (onEdit) onEdit(logId, date);
        });
    }
    
    if (deleteBtn) {
        const newDeleteBtn = deleteBtn.cloneNode(true);
        deleteBtn.parentNode.replaceChild(newDeleteBtn, deleteBtn);
        
        newDeleteBtn.addEventListener('click', () => {
            console.log('🗑️ 삭제 버튼 클릭:', logId);
            closeItemMenu();
            if (onDelete) onDelete(logId);
        });
    }
    
    if (cancelBtn) {
        const newCancelBtn = cancelBtn.cloneNode(true);
        cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
        
        newCancelBtn.addEventListener('click', () => {
            console.log('❌ 취소 버튼 클릭');
            closeItemMenu();
        });
    }
    
    if (overlay) {
        const newOverlay = overlay.cloneNode(true);
        overlay.parentNode.replaceChild(newOverlay, overlay);
        
        newOverlay.addEventListener('click', () => {
            console.log('📱 오버레이 클릭 - 메뉴 닫기');
            closeItemMenu();
        });
    }
}

// 아이템 메뉴 닫기
function closeItemMenu() {
    const menuPopup = document.getElementById('itemMenuPopup');
    if (menuPopup) {
        menuPopup.classList.remove('active');
        document.body.style.overflow = '';
    }
}

// 날씨 아이콘 SVG 반환
function getWeatherIconSVG(weather, size = 24) {
    const icons = {
        sunny: `<svg class="weather-icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <circle cx="12" cy="12" r="4"></circle>
            <path d="M12 2v4M12 18v4M22 12h-4M6 12H2M19.07 4.93l-2.83 2.83M7.76 16.24l-2.83 2.83M19.07 19.07l-2.83-2.83M7.76 7.76L4.93 4.93"></path>
        </svg>`,
        clear: `<svg class="weather-icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <circle cx="12" cy="12" r="4"></circle>
            <path d="M12 2v4M12 18v4M22 12h-4M6 12H2M19.07 4.93l-2.83 2.83M7.76 16.24l-2.83 2.83M19.07 19.07l-2.83-2.83M7.76 7.76L4.93 4.93"></path>
        </svg>`,
        cloudy: `<svg class="weather-icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"></path>
        </svg>`,
        rainy: `<svg class="weather-icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"></path>
            <line x1="8" y1="19" x2="8" y2="21"></line>
            <line x1="13" y1="19" x2="13" y2="21"></line>
            <line x1="16" y1="19" x2="16" y2="21"></line>
        </svg>`,
        snowy: `<svg class="weather-icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"></path>
            <circle cx="8" cy="20" r="1"></circle>
            <circle cx="13" cy="20" r="1"></circle>
            <circle cx="16" cy="20" r="1"></circle>
        </svg>`,
        lightning: `<svg class="weather-icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
        </svg>`
    };
    
    return icons[weather] || icons.cloudy;
}

// 날씨 관련 함수들은 config.js에 이미 정의되어 있음:
// - getWeatherByDate(date): 특정 날짜의 날씨 조회
// - getCurrentWeather(): 현재 날씨 조회
// - getWeatherByCoords(lat, lon): 좌표 기반 현재 날씨 조회
// - getWeatherByDateAndCoords(lat, lon, date): 좌표 + 날짜 기반 날씨 조회

// 유틸리티 함수 추가 (config.js의 utils 객체에 추가)
if (typeof utils !== 'undefined') {
    utils.showLoading = utils.showLoading || function() {
        // 로딩 표시 (필요시 구현)
    };
    
    utils.hideLoading = utils.hideLoading || function() {
        // 로딩 숨기기 (필요시 구현)
    };
    
    utils.showError = utils.showError || function(message) {
        console.error('❌', message);
        alert(message);
    };
    
    utils.showSuccess = utils.showSuccess || function(message) {
        console.log('✅', message);
    };
}

