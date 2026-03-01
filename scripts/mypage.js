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

function formatStatCount(n) {
    if (n == null) return '-';
    if (n > 1000) return '1000+';
    return String(n);
}

async function loadStats() {
    const totalEl = document.getElementById('statTotalCount');
    const favEl = document.getElementById('statFavoriteCount');
    totalEl.textContent = '...';
    favEl.textContent = '...';
    try {
        const user = await getCurrentUser();
        if (!user?.id) {
            totalEl.textContent = '0';
            favEl.textContent = '0';
            return;
        }

        // real(프로덕션) DB는 count API 500 이슈 → select만 사용. alpha/localhost는 count API 시도
        const isProd = !/alpha|localhost|127\.0\.0\.1/.test(window.location.hostname);
        let totalCount = null;
        let favCount = null;

        if (!isProd) {
            const { count: tc, error: err1 } = await supabaseClient
                .from('style_logs')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', user.id);
            const { count: fc, error: err2 } = await supabaseClient
                .from('style_logs')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', user.id)
                .eq('is_favorite', true);
            if (!err1 && tc != null) totalCount = tc;
            if (!err2 && fc != null) favCount = fc;
        }

        if (totalCount == null || favCount == null) {
            const [totalRes, favRes] = await Promise.all([
                totalCount == null ? supabaseClient.from('style_logs').select('id').eq('user_id', user.id).limit(1001) : Promise.resolve({ data: null }),
                favCount == null ? supabaseClient.from('style_logs').select('id').eq('user_id', user.id).eq('is_favorite', true).limit(1001) : Promise.resolve({ data: null })
            ]);
            if (totalCount == null) {
                const len = totalRes.data?.length ?? 0;
                totalCount = len >= 1001 ? 1001 : len;
            }
            if (favCount == null) {
                const len = favRes.data?.length ?? 0;
                favCount = len >= 1001 ? 1001 : len;
            }
        }

        totalEl.textContent = formatStatCount(totalCount);
        favEl.textContent = formatStatCount(favCount);
    } catch (error) {
        console.error('통계 로드 오류:', error);
        totalEl.textContent = formatStatCount(null);
        favEl.textContent = formatStatCount(null);
    }
}

function attachEventListeners() {
    document.getElementById('logoutBtn')?.addEventListener('click', async () => {
        if (confirm('로그아웃 하시겠습니까?')) {
            await logout();
        }
    });
}
