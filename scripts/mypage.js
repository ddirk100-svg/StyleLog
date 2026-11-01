// 마이페이지 스크립트

async function initPage() {
    const verEl = document.querySelector('.app-version');
    if (verEl && typeof APP_VERSION !== 'undefined' && APP_VERSION) {
        verEl.textContent = `스타일로그 ${APP_VERSION}`;
    }
    const user = await getCurrentUser();
    await loadUserProfile(user);
    attachEventListeners();
    if (user?.id) {
        loadStats(user).catch(() => {});
    } else {
        loadStats(null).catch(() => {});
    }
}

async function loadUserProfile(userArg) {
    const user = userArg ?? (await getCurrentUser());
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

function countFromLimitedRows(data, limit = 1001) {
    const len = data?.length ?? 0;
    return len >= limit ? limit : len;
}

async function loadStats(user) {
    const totalEl = document.getElementById('statTotalCount');
    const favEl = document.getElementById('statFavoriteCount');
    const wardrobeEl = document.getElementById('statWardrobeCount');
    if (totalEl) totalEl.textContent = '-';
    if (favEl) favEl.textContent = '-';
    if (wardrobeEl) wardrobeEl.textContent = '-';

    if (!user?.id) {
        if (totalEl) totalEl.textContent = '0';
        if (favEl) favEl.textContent = '0';
        if (wardrobeEl) wardrobeEl.textContent = '0';
        return;
    }

    const today = new Date().toISOString().slice(0, 10);
    const wardrobePromise =
        typeof StyleLogAPI?.getWardrobeCatalog === 'function'
            ? StyleLogAPI.getWardrobeCatalog().catch(() => null)
            : Promise.resolve(null);

    try {
        const [totalRes, favRes, todayRes, catalog] = await Promise.all([
            supabaseClient.from('style_logs').select('id').eq('user_id', user.id).limit(1001),
            supabaseClient
                .from('style_logs')
                .select('id')
                .eq('user_id', user.id)
                .eq('is_favorite', true)
                .limit(1001),
            supabaseClient
                .from('style_logs')
                .select('id')
                .eq('user_id', user.id)
                .eq('date', today)
                .limit(1),
            wardrobePromise
        ]);

        const totalCount = countFromLimitedRows(totalRes.data);
        const favCount = countFromLimitedRows(favRes.data);
        const hasTodayLog = (todayRes.data?.length ?? 0) > 0;

        if (totalEl) totalEl.textContent = formatStatCount(totalCount);
        if (favEl) favEl.textContent = formatStatCount(favCount);
        updateMypageProfileMeta(totalCount, favCount);
        applyMypageTodayNudge(totalCount, hasTodayLog, today);

        if (wardrobeEl) {
            wardrobeEl.textContent = formatStatCount(
                catalog ? countActiveWardrobeItems(catalog) : null
            );
        }
    } catch (error) {
        console.error('통계 로드 오류:', error);
        if (totalEl) totalEl.textContent = formatStatCount(null);
        if (favEl) favEl.textContent = formatStatCount(null);
        if (wardrobeEl) wardrobeEl.textContent = formatStatCount(null);
    }
}

function updateMypageProfileMeta(totalCount, favCount) {
    const metaEl = document.getElementById('profileMeta');
    if (!metaEl) return;
    const total = totalCount ?? 0;
    const fav = favCount ?? 0;
    if (total <= 0) {
        metaEl.textContent = '하루 한 번씩 쌓으면 비슷한 날씨에 다시 꺼낼 수 있어요.';
        return;
    }
    if (fav > 0) {
        metaEl.textContent = `코디 ${formatStatCount(total)}개 · 즐겨찾기 ${formatStatCount(fav)}개`;
    } else {
        metaEl.textContent = `코디 ${formatStatCount(total)}개 · ♡로 마음에 드는 코디만 모아요`;
    }
}

function applyMypageTodayNudge(totalCount, hasTodayLog, todayIso) {
    const nudge = document.getElementById('mypageNudge');
    const textEl = document.getElementById('mypageNudgeText');
    const btn = document.getElementById('mypageNudgeBtn');
    if (!nudge || !textEl || !btn) return;

    btn.href = `write.html?date=${todayIso}`;

    if ((totalCount ?? 0) <= 0) {
        textEl.textContent = '아직 코디가 없어요. 오늘 입은 차림부터 남겨 보세요.';
        nudge.hidden = false;
        btn.textContent = '첫 코디 기록하기';
        return;
    }

    if (hasTodayLog) {
        nudge.hidden = true;
        return;
    }

    textEl.textContent = '오늘 코디가 아직 없어요. 사진 한 장이면 충분해요.';
    nudge.hidden = false;
    btn.textContent = '오늘 코디 남기기';
}

function attachEventListeners() {
    document.getElementById('logoutBtn')?.addEventListener('click', async () => {
        const ok = await showConfirm('로그아웃 하시겠습니까?');
        if (ok) await logout();
    });
}
