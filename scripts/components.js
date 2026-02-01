// 공통 컴포넌트 생성 함수들

/**
 * 하단 네비게이션 바 생성
 * @param {string} activePage - 현재 활성화된 페이지 ('home', 'write', 'favorite')
 * @returns {string} HTML 문자열
 */
function createBottomNav(activePage = 'home') {
    const pages = {
        home: { href: 'index.html', label: '홈', icon: 'home' },
        write: { href: 'write.html', label: '작성', icon: 'plus' },
        favorite: { href: 'favorite.html', label: '즐겨찾기', icon: 'star' }
    };
    
    const icons = {
        home: `<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
               <polyline points="9 22 9 12 15 12 15 22"></polyline>`,
        plus: `<line x1="12" y1="5" x2="12" y2="19"></line>
               <line x1="5" y1="12" x2="19" y2="12"></line>`,
        star: `<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>`
    };
    
    return `
        <nav class="bottom-nav">
            ${Object.entries(pages).map(([key, page]) => `
                <a href="${page.href}" class="bottom-nav-item ${key === 'write' ? 'write-btn' : ''} ${activePage === key ? 'active' : ''}">
                    <div class="bottom-nav-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            ${icons[page.icon]}
                        </svg>
                    </div>
                    <span class="bottom-nav-label">${page.label}</span>
                </a>
            `).join('')}
        </nav>
    `;
}

/**
 * 아이템 메뉴 팝업 생성
 * @returns {string} HTML 문자열
 */
function createItemMenuPopup() {
    return `
        <div class="menu-popup" id="itemMenuPopup">
            <div class="menu-overlay"></div>
            <div class="menu-content">
                <button class="menu-item edit-menu-btn">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
                    </svg>
                    <span>수정</span>
                </button>
                <button class="menu-item delete-menu-btn">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                    <span>삭제</span>
                </button>
                <button class="menu-item cancel-menu-btn">
                    <span>취소</span>
                </button>
            </div>
        </div>
    `;
}

/**
 * 뒤로가기 버튼이 있는 헤더 생성
 * @param {string} title - 헤더 타이틀
 * @param {boolean} showMenu - 메뉴 버튼 표시 여부
 * @returns {string} HTML 문자열
 */
function createHeader(title, showMenu = false) {
    return `
        <header class="header">
            <button class="icon-btn back-btn" style="margin-right: auto;">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M19 12H5M12 19l-7-7 7-7"></path>
                </svg>
            </button>
            <h1 class="header-title" style="position: absolute; left: 50%; transform: translateX(-50%); font-size: 18px; font-weight: 600;">${title}</h1>
            ${showMenu ? `
                <button class="icon-btn menu-btn">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="5" r="1.5"></circle>
                        <circle cx="12" cy="12" r="1.5"></circle>
                        <circle cx="12" cy="19" r="1.5"></circle>
                    </svg>
                </button>
            ` : '<div style="width: 44px;"></div>'}
        </header>
    `;
}

/**
 * SVG 아이콘 생성
 * @param {string} iconName - 아이콘 이름
 * @param {number} size - 아이콘 크기 (기본값: 24)
 * @returns {string} SVG HTML 문자열
 */
function createIcon(iconName, size = 24) {
    const icons = {
        // 네비게이션 아이콘
        home: `<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline>`,
        plus: `<line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line>`,
        star: `<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>`,
        
        // 액션 아이콘
        back: `<path d="M19 12H5M12 19l-7-7 7-7"></path>`,
        close: `<line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>`,
        menu: `<line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="18" x2="21" y2="18"></line>`,
        dots: `<circle cx="12" cy="5" r="1.5"></circle><circle cx="12" cy="12" r="1.5"></circle><circle cx="12" cy="19" r="1.5"></circle>`,
        
        // 편집 아이콘
        edit: `<path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>`,
        delete: `<polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>`,
        
        // 날씨 아이콘
        sunny: `<circle cx="16" cy="16" r="4"></circle><path d="M16 2v4M16 26v4M30 16h-4M6 16H2M25.5 6.5l-2.8 2.8M9.3 22.7l-2.8 2.8M25.5 25.5l-2.8-2.8M9.3 9.3L6.5 6.5"></path>`,
        cloudy: `<path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"></path>`,
        rainy: `<path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"></path><line x1="8" y1="20" x2="8" y2="24"></line><line x1="13" y1="20" x2="13" y2="24"></line><line x1="18" y1="20" x2="18" y2="24"></line>`,
        snowy: `<path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"></path><circle cx="8" cy="23" r="1"></circle><circle cx="13" cy="23" r="1"></circle><circle cx="18" cy="23" r="1"></circle>`,
        lightning: `<polygon points="16 2 6 18 16 18 16 30 26 14 16 14 16 2"></polygon>`,
        
        // 기타 아이콘
        heart: `<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>`,
        check: `<polyline points="20 6 9 17 4 12"></polyline>`,
        photo: `<rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline>`
    };
    
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor">${icons[iconName] || ''}</svg>`;
}

/**
 * 빈 상태 컴포넌트 생성
 * @param {string} title - 제목
 * @param {string} text - 설명 텍스트
 * @param {string} buttonText - 버튼 텍스트 (선택)
 * @param {string} buttonHref - 버튼 링크 (선택)
 * @returns {string} HTML 문자열
 */
function createEmptyState(title, text, buttonText = '', buttonHref = '') {
    return `
        <div class="empty-state">
            <svg class="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <h2 class="empty-state-title">${title}</h2>
            <p class="empty-state-text">${text}</p>
            ${buttonText && buttonHref ? `
                <button onclick="window.location.href='${buttonHref}'" 
                        class="btn-primary" style="margin-top: var(--spacing-xl);">
                    ${buttonText}
                </button>
            ` : ''}
        </div>
    `;
}

/**
 * 로딩 오버레이 생성
 * @returns {string} HTML 문자열
 */
function createLoadingOverlay() {
    return `
        <div class="loading-overlay">
            <div class="loading-spinner"></div>
        </div>
    `;
}

/**
 * 페이지 로드 시 공통 컴포넌트 초기화
 * @param {Object} config - 설정 객체
 * @param {string} config.activePage - 현재 활성 페이지
 * @param {boolean} config.showItemMenu - 아이템 메뉴 표시 여부
 */
function initCommonComponents(config = {}) {
    const { activePage = 'home', showItemMenu = false } = config;
    
    // Bottom Navigation 추가
    const bottomNavContainer = document.querySelector('.bottom-nav');
    if (bottomNavContainer) {
        bottomNavContainer.outerHTML = createBottomNav(activePage);
    }
    
    // Item Menu Popup 추가
    if (showItemMenu) {
        const existingMenu = document.getElementById('itemMenuPopup');
        if (!existingMenu) {
            document.body.insertAdjacentHTML('beforeend', createItemMenuPopup());
        }
    }
}

// Export for use in other scripts (if using modules)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        createBottomNav,
        createItemMenuPopup,
        createHeader,
        createIcon,
        createEmptyState,
        createLoadingOverlay,
        initCommonComponents
    };
}

