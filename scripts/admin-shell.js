// 관리자 공통: 환경 배지(ALPHA·REAL) = 앱과 동일한 호스트 규칙(config.js 의 isTestEnvironment 와 맞춤)
// 관리자 사이드바 활성 항목 · 로그아웃(세션 쿠키 삭제)
document.addEventListener('DOMContentLoaded', () => {
    const h = window.location.hostname;
    const isTestAdmin =
        h === 'localhost' ||
        h === '127.0.0.1' ||
        h.includes('192.168.') ||
        h.includes('alpha') ||
        h.includes('-git-alpha-');

    document.querySelectorAll('.admin-env-badge').forEach((badge) => {
        if (isTestAdmin) {
            badge.textContent = 'ALPHA / LOCAL';
            badge.classList.remove('admin-env-badge--real');
        } else {
            badge.textContent = 'REAL';
            badge.classList.add('admin-env-badge--real');
        }
    });

    const page = document.body.dataset.adminPage;
    if (page) {
        document.querySelectorAll('[data-admin-nav]').forEach((el) => {
            if (el.getAttribute('data-admin-nav') === page) {
                el.classList.add('is-active');
            }
        });
    }

    const topbar = document.querySelector('.admin-topbar');
    if (topbar && !topbar.querySelector('[data-admin-logout]')) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.dataset.adminLogout = '';
        btn.className = 'admin-btn admin-btn-logout';
        btn.textContent = '로그아웃';
        btn.addEventListener('click', async () => {
            try {
                await fetch('/api/admin/session', { method: 'DELETE', credentials: 'same-origin' });
            } catch (_) {
                /* ignore */
            }
            window.location.reload();
        });
        topbar.appendChild(btn);
    }
});
