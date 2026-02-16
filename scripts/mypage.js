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

        // user_id로 명시적 필터링 (RLS와 동일하지만 프로덕션 호환성 확보)
        let totalCount = null;
        let favCount = null;

        const { count: c1, error: err1 } = await supabaseClient
            .from('style_logs')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id);
        const { count: c2, error: err2 } = await supabaseClient
            .from('style_logs')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .eq('is_favorite', true);

        if (!err1) totalCount = c1;
        if (!err2) favCount = c2;

        // count API 실패 시 select로 폴백 (id만 조회 후 length)
        if (totalCount == null && !err1) {
            const { data: totalData } = await supabaseClient
                .from('style_logs')
                .select('id')
                .eq('user_id', user.id);
            totalCount = totalData?.length ?? 0;
        }
        if (favCount == null && !err2) {
            const { data: favData } = await supabaseClient
                .from('style_logs')
                .select('id')
                .eq('user_id', user.id)
                .eq('is_favorite', true);
            favCount = favData?.length ?? 0;
        }

        totalEl.textContent = (totalCount != null ? totalCount : (err1 ? '-' : 0));
        favEl.textContent = (favCount != null ? favCount : (err2 ? '-' : 0));
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
