// 공통 기능 스크립트
// 모든 페이지에서 공통으로 사용되는 기능들을 관리

/**
 * 로고 클릭 이벤트 초기화
 * 모든 페이지의 로고를 클릭하면 홈으로 이동
 */
function initLogoClick() {
    const logoElements = document.querySelectorAll('.logo');
    logoElements.forEach(logo => {
        logo.addEventListener('click', () => {
            window.location.href = 'index.html';
        });
    });
}

/**
 * 메뉴 팝업 초기화
 * 메뉴 버튼과 오버레이 클릭 시 메뉴 열기/닫기
 */
function initMenuPopup() {
    const menuBtn = document.querySelector('.menu-btn');
    const menuPopup = document.getElementById('menuPopup');
    const menuOverlay = document.querySelector('.menu-overlay');
    const closeMenuBtn = document.querySelector('.close-menu-btn');
    
    if (!menuPopup) return;
    
    // 메뉴 열기
    if (menuBtn) {
        menuBtn.addEventListener('click', async () => {
            await openMenu();
        });
    }
    
    // 메뉴 닫기
    function closeMenu() {
        menuPopup.classList.remove('active');
        document.body.style.overflow = '';
    }
    
    if (menuOverlay) {
        menuOverlay.addEventListener('click', closeMenu);
    }
    
    if (closeMenuBtn) {
        closeMenuBtn.addEventListener('click', closeMenu);
    }
}

/**
 * 메뉴 열기
 */
async function openMenu() {
    const menuPopup = document.getElementById('menuPopup');
    const menuUserInfo = document.getElementById('menuUserInfo');
    
    if (!menuPopup) return;
    
    // 사용자 정보 표시
    if (typeof getCurrentUser === 'function') {
        const user = await getCurrentUser();
        if (user && menuUserInfo) {
            menuUserInfo.innerHTML = `
                <p><strong>${user.email}</strong></p>
                <p style="font-size: 12px; color: #999;">가입일: ${new Date(user.created_at).toLocaleDateString()}</p>
            `;
        }
    }
    
    menuPopup.classList.add('active');
    document.body.style.overflow = 'hidden';
}

/**
 * 뒤로가기 버튼 초기화
 * referrer 파라미터에 따라 적절한 페이지로 이동
 */
function initBackButton() {
    const backBtn = document.querySelector('.back-btn');
    if (!backBtn) return;
    
    backBtn.addEventListener('click', () => {
        const urlParams = new URLSearchParams(window.location.search);
        const referrer = urlParams.get('referrer');
        
        if (referrer === 'calendar') {
            window.location.href = 'calendar.html';
        } else {
            window.history.back();
        }
    });
}

/**
 * 페이지 초기화
 * DOMContentLoaded 시 공통 기능들을 초기화
 */
function initCommonFeatures() {
    initLogoClick();
    initMenuPopup();
    initBackButton();
}

/**
 * 아이템 메뉴 (바텀시트) 관리
 * 여러 페이지에서 사용되는 로그 아이템의 메뉴 팝업
 */
let currentSelectedLog = { id: null, date: null };

/**
 * 아이템 메뉴 열기
 * @param {string} logId - 로그 ID
 * @param {string} date - 날짜
 * @param {Function} onEdit - 수정 버튼 클릭 시 실행할 함수
 * @param {Function} onDelete - 삭제 버튼 클릭 시 실행할 함수
 */
function showItemMenu(logId, date, onEdit, onDelete) {
    if (!logId || logId === 'null' || logId === 'undefined') {
        console.error('❌ showItemMenu: 유효하지 않은 로그 ID:', logId);
        alert('로그 정보를 찾을 수 없습니다.');
        return;
    }
    
    currentSelectedLog = { id: logId, date: date };
    
    const menuPopup = document.getElementById('itemMenuPopup');
    if (!menuPopup) {
        console.error('❌ 메뉴 팝업을 찾을 수 없음');
        return;
    }
    
    menuPopup.classList.add('active');
    
    const overlay = menuPopup.querySelector('.menu-overlay');
    const cancelBtn = menuPopup.querySelector('.cancel-menu-btn');
    const editBtn = menuPopup.querySelector('.edit-menu-btn');
    const deleteBtn = menuPopup.querySelector('.delete-menu-btn');
    
    // 기존 이벤트 리스너 제거
    const newOverlay = overlay.cloneNode(true);
    overlay.parentNode.replaceChild(newOverlay, overlay);
    
    const newCancelBtn = cancelBtn.cloneNode(true);
    cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
    
    const newEditBtn = editBtn.cloneNode(true);
    editBtn.parentNode.replaceChild(newEditBtn, editBtn);
    
    const newDeleteBtn = deleteBtn.cloneNode(true);
    deleteBtn.parentNode.replaceChild(newDeleteBtn, deleteBtn);
    
    // 새 이벤트 리스너 등록
    newOverlay.onclick = closeItemMenu;
    newCancelBtn.onclick = closeItemMenu;
    
    newEditBtn.onclick = () => {
        closeItemMenu();
        if (onEdit) {
            onEdit(currentSelectedLog.id, currentSelectedLog.date);
        } else {
            // 기본 동작: write.html로 이동
            window.location.href = `write.html?id=${currentSelectedLog.id}&date=${currentSelectedLog.date}`;
        }
    };
    
    newDeleteBtn.onclick = () => {
        closeItemMenu();
        if (onDelete) {
            onDelete(currentSelectedLog.id);
        } else {
            // 기본 동작: 확인 후 삭제
            if (confirm('정말 이 기록을 삭제하시겠습니까?')) {
                if (typeof StyleLogAPI !== 'undefined' && StyleLogAPI.delete) {
                    StyleLogAPI.delete(currentSelectedLog.id)
                        .then(() => {
                            location.reload();
                        })
                        .catch(error => {
                            console.error('❌ 삭제 오류:', error);
                            alert('삭제에 실패했습니다.');
                        });
                }
            }
        }
    };
}

/**
 * 아이템 메뉴 닫기
 */
function closeItemMenu() {
    const menuPopup = document.getElementById('itemMenuPopup');
    if (menuPopup) {
        menuPopup.classList.remove('active');
    }
    currentSelectedLog = { id: null, date: null };
}

/**
 * 즐겨찾기 토글
 * @param {string} logId - 로그 ID
 * @param {boolean} currentState - 현재 즐겨찾기 상태
 * @param {HTMLElement} button - 버튼 요소 (선택사항)
 * @returns {Promise<boolean>} - 새로운 즐겨찾기 상태
 */
async function toggleFavorite(logId, currentState, button = null) {
    try {
        const newState = !currentState;
        
        if (typeof StyleLogAPI === 'undefined' || !StyleLogAPI.update) {
            throw new Error('StyleLogAPI가 정의되지 않았습니다.');
        }
        
        await StyleLogAPI.update(logId, { is_favorite: newState });
        
        // 버튼 상태 업데이트
        if (button) {
            if (newState) {
                button.classList.add('active');
                const svg = button.querySelector('svg');
                if (svg) {
                    svg.setAttribute('fill', 'currentColor');
                }
            } else {
                button.classList.remove('active');
                const svg = button.querySelector('svg');
                if (svg) {
                    svg.setAttribute('fill', 'none');
                }
            }
        }
        
        return newState;
    } catch (error) {
        console.error('❌ 즐겨찾기 토글 오류:', error);
        alert('즐겨찾기 상태 변경에 실패했습니다.');
        throw error;
    }
}

// DOMContentLoaded 시 초기화
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCommonFeatures);
} else {
    // 이미 로드된 경우 즉시 실행
    initCommonFeatures();
}

