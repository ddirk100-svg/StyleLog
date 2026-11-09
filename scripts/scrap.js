async function initScrapPage() {
    const listEl = document.getElementById('scrapGroupList');
    if (!listEl) return;

    const user = await getCurrentUser();
    if (!user?.id) {
        listEl.innerHTML = '<p class="scrap-empty">로그인이 필요해요.</p>';
        return;
    }

    try {
        const groups = await fetchDistinctScrapGroups(user.id);
        listEl.setAttribute('aria-busy', 'false');

        if (!groups.length) {
            listEl.innerHTML =
                '<div class="scrap-empty"><p>아직 스크랩 묶음이 없어요.</p><p class="util-sub util-sub--spaced">레퍼런스 기록에 묶음 이름을 넣으면 여기에 모여요.</p><a class="util-btn-primary" href="write.html?mode=reference">레퍼런스 남기기</a></div>';
            return;
        }

        listEl.innerHTML = '';
        groups.forEach((row) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'scrap-row';
            btn.setAttribute('role', 'listitem');
            const label =
                typeof escapeHtml === 'function' ? escapeHtml(row.name) : String(row.name);
            btn.innerHTML = `<span class="scrap-row-label">${label}</span><span class="scrap-row-count">${row.count}<span>개</span></span>`;
            btn.addEventListener('click', () => {
                window.location.href = `home.html?scrapGroup=${encodeURIComponent(row.name)}`;
            });
            listEl.appendChild(btn);
        });
    } catch (e) {
        console.error('scrap', e);
        listEl.setAttribute('aria-busy', 'false');
        const missing =
            typeof isLogKindColumnError === 'function' && isLogKindColumnError(e);
        listEl.innerHTML = missing
            ? '<p class="scrap-empty">레퍼런스 기능을 아직 불러올 수 없어요. 잠시 후 다시 시도해 주세요.</p>'
            : '<p class="scrap-empty">스크랩 묶음을 불러오지 못했어요. 네트워크를 확인해 주세요.</p>';
    }
}

async function fetchDistinctScrapGroups(userId) {
    const pageSize = 400;
    let offset = 0;
    const counts = new Map();
    let selectCols = 'scrap_group, log_kind';
    let withKind = true;
    for (;;) {
        let { data, error } = await supabaseClient
            .from('style_logs')
            .select(selectCols)
            .eq('user_id', userId)
            .not('scrap_group', 'is', null)
            .order('updated_at', { ascending: false })
            .range(offset, offset + pageSize - 1);

        if (error && withKind && typeof isLogKindColumnError === 'function' && isLogKindColumnError(error)) {
            withKind = false;
            selectCols = 'scrap_group';
            ({ data, error } = await supabaseClient
                .from('style_logs')
                .select(selectCols)
                .eq('user_id', userId)
                .not('scrap_group', 'is', null)
                .order('updated_at', { ascending: false })
                .range(offset, offset + pageSize - 1));
        }
        if (error) throw error;

        (data || []).forEach((row) => {
            if (withKind && typeof normalizeLogKind === 'function') {
                if (normalizeLogKind(row.log_kind) !== 'reference') return;
            }
            const name = String(row.scrap_group || '').trim();
            if (!name) return;
            counts.set(name, (counts.get(name) || 0) + 1);
        });

        if (!data || data.length < pageSize) break;
        offset += pageSize;
    }

    return [...counts.entries()]
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'ko'));
}
