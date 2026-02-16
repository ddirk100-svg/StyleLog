// 마이페이지 스크립트

async function initPage() {
    await loadUserProfile();
    await loadStats();
    attachEventListeners();
}

async function loadUserProfile() {
    const user = await getCurrentUser();
    const emailEl = document.getElementById('profileEmail');
    const avatarEl = document.getElementById('profileAvatar');
    const metaEl = document.getElementById('profileMeta');

    if (!user) {
        if (emailEl) emailEl.textContent = '로그인 필요';
        if (metaEl) metaEl.textContent = '';
        return;
    }

    const email = user.email || user.user_metadata?.email || '사용자';
    const name = user.user_metadata?.full_name || user.user_metadata?.name;

    if (emailEl) emailEl.textContent = email;
    if (metaEl) metaEl.textContent = name || '스타일로그와 함께 착장을 기록해보세요';
    if (avatarEl) {
        avatarEl.textContent = (name || email).charAt(0).toUpperCase();
    }
}

async function loadStats() {
    try {
        const { count: totalCount, error: err1 } = await supabaseClient
            .from('style_logs')
            .select('*', { count: 'exact', head: true });
        const { count: favCount, error: err2 } = await supabaseClient
            .from('style_logs')
            .select('*', { count: 'exact', head: true })
            .eq('is_favorite', true);

        if (err1 || err2) throw err1 || err2;
        document.getElementById('statTotalCount').textContent = totalCount ?? 0;
        document.getElementById('statFavoriteCount').textContent = favCount ?? 0;
    } catch (error) {
        console.error('통계 로드 오류:', error);
        document.getElementById('statTotalCount').textContent = '-';
        document.getElementById('statFavoriteCount').textContent = '-';
    }
}

function attachEventListeners() {
    document.getElementById('logoutBtn')?.addEventListener('click', async () => {
        if (confirm('로그아웃 하시겠습니까?')) {
            await logout();
        }
    });
}
