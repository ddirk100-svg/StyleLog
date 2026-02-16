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
    const totalEl = document.getElementById('statTotalCount');
    const favEl = document.getElementById('statFavoriteCount');
    try {
        const user = await getCurrentUser();
        if (!user?.id) {
            totalEl.textContent = '0';
            favEl.textContent = '0';
            return;
        }

        // id만 조회 후 length로 카운트 (HEAD/count API 500 이슈 회피)
        const { data: totalData, error: err1 } = await supabaseClient
            .from('style_logs')
            .select('id')
            .eq('user_id', user.id);
        const { data: favData, error: err2 } = await supabaseClient
            .from('style_logs')
            .select('id')
            .eq('user_id', user.id)
            .eq('is_favorite', true);

        const totalCount = err1 ? null : (totalData?.length ?? 0);
        const favCount = err2 ? null : (favData?.length ?? 0);

        totalEl.textContent = totalCount != null ? totalCount : '-';
        favEl.textContent = favCount != null ? favCount : '-';
    } catch (error) {
        console.error('통계 로드 오류:', error);
        totalEl.textContent = '-';
        favEl.textContent = '-';
    }
}

function attachEventListeners() {
    document.getElementById('logoutBtn')?.addEventListener('click', async () => {
        if (confirm('로그아웃 하시겠습니까?')) {
            await logout();
        }
    });
}
