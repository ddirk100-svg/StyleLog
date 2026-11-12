/**
 * 하단 네비 단일 정의 — 각 페이지: <div data-stylelog-bottom-nav data-active="home|write|mypage"></div>
 */
(function () {
  const NAV = `
<nav class="bottom-nav" aria-label="주요 메뉴">
  <a href="home.html" class="bottom-nav-item" data-nav="home">
    <div class="bottom-nav-icon">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
        <polyline points="9 22 9 12 15 12 15 22"></polyline>
      </svg>
    </div>
    <span class="bottom-nav-label">홈</span>
  </a>
  <a href="write.html" class="bottom-nav-item write-btn" data-nav="write">
    <div class="bottom-nav-icon">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
        <line x1="12" y1="5" x2="12" y2="19"></line>
        <line x1="5" y1="12" x2="19" y2="12"></line>
      </svg>
    </div>
    <span class="bottom-nav-label">코디 추가</span>
  </a>
  <a href="mypage.html" class="bottom-nav-item" data-nav="mypage">
    <div class="bottom-nav-icon">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
        <circle cx="12" cy="7" r="4"></circle>
      </svg>
    </div>
    <span class="bottom-nav-label">마이</span>
  </a>
</nav>`;

  function activeKeyFromPage() {
    const mount = document.querySelector('[data-stylelog-bottom-nav]');
    if (mount?.dataset?.active) return mount.dataset.active;
    const path = (location.pathname || '').split('/').pop() || '';
    if (path === 'home.html' || path === '' || path === 'index.html') return 'home';
    if (path === 'write.html') return 'write';
    if (
      path === 'mypage.html' ||
      path === 'combinations.html' ||
      path === 'wardrobe.html' ||
      path === 'assistant.html'
    ) {
      return 'mypage';
    }
    return '';
  }

  function mount() {
    const mountEl = document.querySelector('[data-stylelog-bottom-nav]');
    if (!mountEl) return;
    const wrap = document.createElement('div');
    wrap.innerHTML = NAV.trim();
    const nav = wrap.firstElementChild;
    if (!nav) return;
    const active = activeKeyFromPage();
    nav.querySelectorAll('.bottom-nav-item').forEach((a) => {
      const key = a.getAttribute('data-nav');
      if (key === active) a.classList.add('active');
    });
    mountEl.replaceWith(nav);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();
