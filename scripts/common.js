// 공통 함수들
const WEATHER_FIT_LABELS = { cold: 'cold', good: 'good', hot: 'hot' };

// 다이얼로그 CSS 로드 (한 번만)
(function loadDialogStyles() {
    if (document.getElementById('stylelog-dialog-styles')) return;
    const link = document.createElement('link');
    link.id = 'stylelog-dialog-styles';
    link.rel = 'stylesheet';
    link.href = 'styles/dialog.css';
    document.head.appendChild(link);
})();

/** 알럿 표시 (확인 버튼만) */
function showAlert(message) {
    return new Promise((resolve) => {
        const backdrop = document.createElement('div');
        backdrop.className = 'stylelog-dialog-backdrop';
        backdrop.innerHTML = `
            <div class="stylelog-dialog" role="alertdialog" aria-modal="true" aria-labelledby="stylelog-dialog-msg">
                <div class="stylelog-dialog-body">
                    <p class="stylelog-dialog-message" id="stylelog-dialog-msg">${escapeHtml(message)}</p>
                </div>
                <div class="stylelog-dialog-actions single">
                    <button type="button" class="stylelog-dialog-btn stylelog-dialog-btn-confirm">확인</button>
                </div>
            </div>
        `;
        const btn = backdrop.querySelector('button');
        const close = () => {
            document.removeEventListener('keydown', onKey);
            backdrop.remove();
            document.body.style.overflow = '';
            resolve();
        };
        const onKey = (e) => { if (e.key === 'Escape') close(); };
        btn.addEventListener('click', close);
        backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });
        document.addEventListener('keydown', onKey);
        document.body.style.overflow = 'hidden';
        document.body.appendChild(backdrop);
    });
}

/** 확인 대화상자 (확인/취소) - true: 확인, false: 취소 */
function showConfirm(message, options = {}) {
    const { confirmText = '확인', cancelText = '취소', danger = false } = options;
    return new Promise((resolve) => {
        const backdrop = document.createElement('div');
        backdrop.className = 'stylelog-dialog-backdrop';
        const confirmCls = danger ? 'stylelog-dialog-btn-danger' : 'stylelog-dialog-btn-confirm';
        backdrop.innerHTML = `
            <div class="stylelog-dialog" role="alertdialog" aria-modal="true" aria-labelledby="stylelog-dialog-msg">
                <div class="stylelog-dialog-body">
                    <p class="stylelog-dialog-message" id="stylelog-dialog-msg">${escapeHtml(message)}</p>
                </div>
                <div class="stylelog-dialog-actions">
                    <button type="button" class="stylelog-dialog-btn stylelog-dialog-btn-cancel">${escapeHtml(cancelText)}</button>
                    <button type="button" class="stylelog-dialog-btn ${confirmCls}">${escapeHtml(confirmText)}</button>
                </div>
            </div>
        `;
        const [cancelBtn, confirmBtn] = backdrop.querySelectorAll('button');
        const close = (result) => {
            document.removeEventListener('keydown', onKey);
            backdrop.remove();
            document.body.style.overflow = '';
            resolve(result);
        };
        const onKey = (e) => { if (e.key === 'Escape') close(false); };
        cancelBtn.addEventListener('click', () => close(false));
        confirmBtn.addEventListener('click', () => close(true));
        backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(false); });
        document.addEventListener('keydown', onKey);
        document.body.style.overflow = 'hidden';
        document.body.appendChild(backdrop);
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/** 기온 직접 입력 다이얼로그 - { low, high } 또는 null 반환 */
function showTempInputDialog(currentLow, currentHigh, options = {}) {
    const { minVal = -20, maxVal = 40 } = options;
    return new Promise((resolve) => {
        const backdrop = document.createElement('div');
        backdrop.className = 'stylelog-dialog-backdrop';
        backdrop.innerHTML = `
            <div class="stylelog-dialog" role="dialog" aria-modal="true" aria-labelledby="stylelog-dialog-msg">
                <div class="stylelog-dialog-body" style="text-align: center;">
                    <p class="stylelog-dialog-message" id="stylelog-dialog-msg">기온 직접 입력</p>
                    <div class="stylelog-dialog-input-group">
                        <div class="stylelog-dialog-input-row">
                            <label class="stylelog-dialog-input-label" for="stylelog-temp-low">최저</label>
                            <input type="number" id="stylelog-temp-low" class="stylelog-dialog-input" 
                                min="${minVal}" max="${maxVal}" value="${currentLow}" inputmode="numeric">
                        </div>
                        <div class="stylelog-dialog-input-row">
                            <label class="stylelog-dialog-input-label" for="stylelog-temp-high">최고</label>
                            <input type="number" id="stylelog-temp-high" class="stylelog-dialog-input" 
                                min="${minVal}" max="${maxVal}" value="${currentHigh}" inputmode="numeric">
                        </div>
                        <p class="stylelog-dialog-input-hint">${minVal}° ~ ${maxVal}° 사이 숫자를 입력하세요</p>
                    </div>
                </div>
                <div class="stylelog-dialog-actions">
                    <button type="button" class="stylelog-dialog-btn stylelog-dialog-btn-cancel">취소</button>
                    <button type="button" class="stylelog-dialog-btn stylelog-dialog-btn-confirm">확인</button>
                </div>
            </div>
        `;
        const inputLow = backdrop.querySelector('#stylelog-temp-low');
        const inputHigh = backdrop.querySelector('#stylelog-temp-high');
        const [cancelBtn, confirmBtn] = backdrop.querySelectorAll('.stylelog-dialog-btn');

        const close = (result) => {
            document.removeEventListener('keydown', onKey);
            backdrop.remove();
            document.body.style.overflow = '';
            resolve(result);
        };

        const onKey = (e) => {
            if (e.key === 'Escape') close(null);
        };

        const doConfirm = () => {
            const low = parseInt(inputLow.value, 10);
            const high = parseInt(inputHigh.value, 10);
            if (isNaN(low) || isNaN(high)) {
                if (typeof showAlert === 'function') showAlert('숫자를 입력해 주세요.');
                return;
            }
            const clampedLow = Math.max(minVal, Math.min(maxVal, low));
            const clampedHigh = Math.max(minVal, Math.min(maxVal, high));
            if (clampedLow > clampedHigh) {
                if (typeof showAlert === 'function') showAlert('최저 기온은 최고 기온보다 낮아야 해요.');
                return;
            }
            close({ low: clampedLow, high: clampedHigh });
        };

        cancelBtn.addEventListener('click', () => close(null));
        confirmBtn.addEventListener('click', doConfirm);
        inputLow.addEventListener('keydown', (e) => { if (e.key === 'Enter') inputHigh.focus(); });
        inputHigh.addEventListener('keydown', (e) => { if (e.key === 'Enter') doConfirm(); });
        backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(null); });
        document.addEventListener('keydown', onKey);
        document.body.style.overflow = 'hidden';
        document.body.appendChild(backdrop);
        requestAnimationFrame(() => inputLow?.select());
    });
}

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
    
    // 빠른 탭 시 오버레이가 즉시 닫는 것 방지 (열린 직후 같은 탭이 오버레이에 전달될 수 있음)
    const openTime = Date.now();
    const CLOSE_GUARD_MS = 350;
    
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
            if (Date.now() - openTime < CLOSE_GUARD_MS) return; /* 빠른 탭 시 무시 */
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
    
    utils.showError = function(message) {
        console.error('❌', message);
        showAlert(message);
    };
    
    utils.showSuccess = utils.showSuccess || function(message) {
        console.log('✅', message);
    };
}

