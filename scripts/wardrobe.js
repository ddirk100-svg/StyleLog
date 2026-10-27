let wardrobeCatalog = [];
let wardrobeFilterCat = '';
let wardrobeMode = 'closet';
let wardrobeBusy = false;
let wardrobeAddCat = '상의';

function formatWardrobeLastWorn(ymd) {
    const s = String(ymd || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return { label: '', title: '' };
    const [y, m, d] = s.split('-');
    return {
        label: `최근 착장일: ${y.slice(2)}.${m}.${d}`,
        title: `최근 착장일 ${y}.${m}.${d}`
    };
}

function splitWardrobeCatalog(list) {
    const blocked = getOutfitSuggestionBlockedMap();
    const active = [];
    const hidden = [];
    (list || []).forEach((it) => {
        if (isOutfitItemHiddenInMap(blocked, it.category, it.value)) hidden.push(it);
        else active.push(it);
    });
    const byCatThenName = (a, b) => {
        const ra = outfitCategorySortRank(a.category);
        const rb = outfitCategorySortRank(b.category);
        if (ra !== rb) return ra - rb;
        return String(a.value).localeCompare(String(b.value), 'ko');
    };
    active.sort(byCatThenName);
    hidden.sort(byCatThenName);
    return { active, hidden };
}

function groupedByCategory(items) {
    const map = new Map();
    items.forEach((it) => {
        const c = it.category;
        if (!map.has(c)) map.set(c, []);
        map.get(c).push(it);
    });
    const cats = [...map.keys()].sort((a, b) => {
        const d = outfitCategorySortRank(a) - outfitCategorySortRank(b);
        if (d !== 0) return d;
        return String(a).localeCompare(String(b), 'ko');
    });
    return cats.map((category) => ({ category, items: map.get(category) }));
}

function categoryIconHtml(cat) {
    return getOutfitCategoryIconMarkup(cat);
}

function appendChip(wrap, label, catKey, iconHtml) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'wardrobe-cat-chip' + (wardrobeFilterCat === catKey ? ' is-active' : '');
    const icon = document.createElement('span');
    icon.className = 'wardrobe-cat-chip-icon';
    icon.innerHTML = iconHtml || '';
    const text = document.createElement('span');
    text.textContent = label;
    btn.appendChild(icon);
    btn.appendChild(text);
    btn.addEventListener('click', () => {
        wardrobeFilterCat = catKey;
        renderWardrobe();
    });
    wrap.appendChild(btn);
}

function renderWardrobeChips(sourceItems) {
    const wrap = document.getElementById('wardrobeCatChips');
    if (!wrap) return;
    const cats = [];
    const seen = new Set();
    OUTFIT_CATEGORY_SORT_ORDER.forEach((c) => {
        cats.push(c);
        seen.add(c);
    });
    sourceItems.forEach((it) => {
        if (!seen.has(it.category)) {
            cats.push(it.category);
            seen.add(it.category);
        }
    });
    wrap.innerHTML = '';
    appendChip(wrap, '전체', '', categoryIconHtml(''));
    cats.forEach((c) => appendChip(wrap, c, c, categoryIconHtml(c)));
}

function wardrobeLogsUrl(category, value) {
    const q = new URLSearchParams();
    q.set('outfitCat', category);
    q.set('outfitVal', value);
    return `home.html?${q.toString()}`;
}

function makeTextAction(label, extraClass, onClick) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'wardrobe-action-btn' + (extraClass ? ` ${extraClass}` : '');
    btn.textContent = label;
    btn.addEventListener('click', () => onClick(btn));
    return btn;
}

function createWardrobeCard(it, { hidden }) {
    const card = document.createElement('article');
    card.className = 'wardrobe-card';

    const main = document.createElement('div');
    main.className = 'wardrobe-card-main';

    const titles = document.createElement('div');
    titles.className = 'wardrobe-card-titles';

    const name = document.createElement('div');
    name.className = 'wardrobe-card-name';
    name.textContent = it.value;
    titles.appendChild(name);

    const stats = document.createElement('div');
    stats.className = 'wardrobe-card-stats';
    const wear = document.createElement('div');
    wear.className = 'wardrobe-card-wear';
    const last = document.createElement('div');
    last.className = 'wardrobe-card-last';
    if (it.wearCount > 0) {
        wear.textContent = `${it.wearCount}회 착용`;
        const worn = formatWardrobeLastWorn(it.lastWorn);
        last.textContent = worn.label;
        if (worn.title) last.title = worn.title;
    } else {
        wear.textContent = '아직 안 입음';
    }
    stats.appendChild(wear);
    if (last.textContent) stats.appendChild(last);

    main.appendChild(titles);
    main.appendChild(stats);

    const actions = document.createElement('div');
    actions.className = 'wardrobe-card-actions';
    const hasLogs = it.wearCount > 0;

    if (hidden) {
        if (hasLogs) {
            actions.appendChild(
                makeTextAction('착장 이력', '', () => {
                    window.location.href = wardrobeLogsUrl(it.category, it.value);
                })
            );
        }
        actions.appendChild(
            makeTextAction('옷장에 넣기', 'wardrobe-action-btn--primary', () => {
                restoreWardrobeItem(it);
            })
        );
    } else {
        actions.appendChild(
            makeTextAction('이름 바꾸기', '', (btn) => {
                renameWardrobeItem(it, btn);
            })
        );
        if (hasLogs) {
            actions.appendChild(
                makeTextAction('착장 이력', '', () => {
                    window.location.href = wardrobeLogsUrl(it.category, it.value);
                })
            );
        }
        actions.appendChild(
            makeTextAction('옷 빼기', 'wardrobe-action-btn--danger', () => {
                hideWardrobeItem(it);
            })
        );
    }

    card.appendChild(main);
    card.appendChild(actions);
    return card;
}

function appendCategorySection(listEl, group, hidden) {
    const head = document.createElement('div');
    head.className = 'wardrobe-section-head';
    const icon = document.createElement('span');
    icon.className = 'wardrobe-section-icon';
    icon.innerHTML = categoryIconHtml(group.category);
    const h = document.createElement('h2');
    h.className = 'wardrobe-section-title';
    h.textContent = group.category;
    const count = document.createElement('span');
    count.className = 'wardrobe-section-count';
    count.textContent = `${group.items.length}`;
    head.appendChild(icon);
    head.appendChild(h);
    head.appendChild(count);
    listEl.appendChild(head);
    group.items.forEach((it) => listEl.appendChild(createWardrobeCard(it, { hidden })));
}

function syncWardrobeStickyOffset() {
    const view = document.getElementById('wardrobeView');
    const header = view?.querySelector('.write-header');
    if (!view || !header) return;
    view.style.setProperty('--wardrobe-sticky-top', `${header.offsetHeight}px`);
}

function syncModeTabs(activeCount, asideCount) {
    const closetBtn = document.getElementById('wardrobeTabCloset');
    const asideBtn = document.getElementById('wardrobeTabAside');
    const closetN = document.getElementById('wardrobeCountCloset');
    const asideN = document.getElementById('wardrobeCountAside');
    if (closetN) closetN.textContent = String(activeCount);
    if (asideN) asideN.textContent = String(asideCount);
    const closetOn = wardrobeMode === 'closet';
    closetBtn?.classList.toggle('is-active', closetOn);
    asideBtn?.classList.toggle('is-active', !closetOn);
    closetBtn?.setAttribute('aria-selected', closetOn ? 'true' : 'false');
    asideBtn?.setAttribute('aria-selected', closetOn ? 'false' : 'true');
}

function renderWardrobe() {
    const { active, hidden } = splitWardrobeCatalog(wardrobeCatalog);
    const source = wardrobeMode === 'aside' ? hidden : active;
    const filtered = wardrobeFilterCat
        ? source.filter((it) => it.category === wardrobeFilterCat)
        : source;

    syncWardrobeStickyOffset();
    syncModeTabs(active.length, hidden.length);
    renderWardrobeChips(source);

    const listEl = document.getElementById('wardrobeActiveList');
    const emptyEl = document.getElementById('wardrobeEmpty');
    const addBtn = document.getElementById('wardrobeAddBtn');
    if (listEl) listEl.innerHTML = '';
    if (addBtn) addBtn.hidden = wardrobeMode !== 'closet';

    if (filtered.length === 0) {
        if (emptyEl) {
            emptyEl.hidden = false;
            if (wardrobeMode === 'aside') {
                emptyEl.textContent = hidden.length === 0
                    ? '빼 둔 옷이 없어요.'
                    : '이 구분에 빼 둔 옷이 없어요.';
            } else if (active.length === 0) {
                emptyEl.textContent = '아직 옷이 없어요.';
            } else {
                emptyEl.textContent = '이 구분에 옷이 없어요.';
            }
        }
        return;
    }

    if (emptyEl) emptyEl.hidden = true;
    if (!listEl) return;
    groupedByCategory(filtered).forEach((group) => {
        appendCategorySection(listEl, group, wardrobeMode === 'aside');
    });
}

async function reloadWardrobeCatalog() {
    wardrobeCatalog = mergeWardrobeCatalogWithExtras(await StyleLogAPI.getWardrobeCatalog());
    renderWardrobe();
}

async function renameWardrobeItem(it, btn) {
    if (wardrobeBusy) return;
    const next = await showPrompt('품목 이름을 수정할까요?', {
        defaultValue: it.value,
        confirmText: '변경',
        hint: '이름을 바꾸면 지난 기록에도 반영돼요.',
        maxLength: OUTFIT_ITEM_VALUE_MAX_LEN
    });
    if (next == null) return;
    const newVal = String(next).trim();
    if (!newVal) {
        await showAlert('품목명을 입력해 주세요.');
        return;
    }
    if (newVal === it.value) return;
    wardrobeBusy = true;
    if (btn) btn.disabled = true;
    try {
        persistOutfitSuggestionBlocked(it.category, it.value);
        removeOutfitSuggestionExtraPersisted(it.category, it.value);
        removeOutfitSuggestionBlockedValue(it.category, newVal);
        persistOutfitSuggestionExtra(it.category, newVal);
        await StyleLogAPI.renameOutfitItemValueAcrossLogs({
            category: it.category,
            oldValue: it.value,
            newValue: newVal
        });
        await reloadWardrobeCatalog();
    } catch (e) {
        console.error(e);
        await showAlert('이름을 바꾸지 못했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
        wardrobeBusy = false;
        if (btn) btn.disabled = false;
    }
}

async function hideWardrobeItem(it) {
    const ok = await showConfirm(
        '옷장과 품목 후보에서만 빼요. 지난 기록에서는 사라지지 않아요.',
        { confirmText: '빼기', cancelText: '취소' }
    );
    if (!ok) return;
    persistOutfitSuggestionBlocked(it.category, it.value);
    if (it.wearCount > 0) {
        removeOutfitSuggestionExtraPersisted(it.category, it.value);
    } else {
        persistOutfitSuggestionExtra(it.category, it.value);
    }
    renderWardrobe();
}

function restoreWardrobeItem(it) {
    removeOutfitSuggestionBlockedValue(it.category, it.value);
    if (it.wearCount === 0) persistOutfitSuggestionExtra(it.category, it.value);
    renderWardrobe();
}

function setWardrobeMode(mode) {
    if (mode !== 'closet' && mode !== 'aside') return;
    if (wardrobeMode === mode) return;
    wardrobeMode = mode;
    wardrobeFilterCat = '';
    closeWardrobeAddSheet();
    renderWardrobe();
}

function syncWardrobeAddGrid() {
    const grid = document.getElementById('wardrobeAddGrid');
    if (!grid) return;
    if (!grid.childElementCount) {
        OUTFIT_CATEGORY_SORT_ORDER.forEach((cat) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'outfit-category-pill';
            btn.dataset.category = cat;
            const icon = document.createElement('span');
            icon.className = 'outfit-category-pill-icon';
            icon.innerHTML = categoryIconHtml(cat);
            const label = document.createElement('span');
            label.textContent = cat;
            btn.appendChild(icon);
            btn.appendChild(label);
            grid.appendChild(btn);
        });
    }
    grid.querySelectorAll('.outfit-category-pill').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.category === wardrobeAddCat);
    });
}

function openWardrobeAddSheet() {
    if (wardrobeMode !== 'closet') return;
    if (wardrobeFilterCat && OUTFIT_CATEGORY_SORT_ORDER.includes(wardrobeFilterCat)) {
        wardrobeAddCat = wardrobeFilterCat;
    } else if (!OUTFIT_CATEGORY_SORT_ORDER.includes(wardrobeAddCat)) {
        wardrobeAddCat = '상의';
    }
    const sheet = document.getElementById('wardrobeAddSheet');
    const input = document.getElementById('wardrobeAddName');
    if (!sheet) return;
    syncWardrobeAddGrid();
    if (input) input.value = '';
    sheet.classList.add('active');
    sheet.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    setTimeout(() => input?.focus(), 80);
}

function closeWardrobeAddSheet() {
    const sheet = document.getElementById('wardrobeAddSheet');
    if (!sheet || !sheet.classList.contains('active')) return;
    sheet.classList.remove('active');
    sheet.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
}

async function submitWardrobeAdd() {
    if (wardrobeBusy) return;
    const cat = String(wardrobeAddCat || '').trim();
    const input = document.getElementById('wardrobeAddName');
    const name = String(input?.value || '').trim();
    if (!cat || !OUTFIT_CATEGORY_SORT_ORDER.includes(cat)) {
        await showAlert('구분을 골라 주세요.');
        return;
    }
    if (!name) {
        await showAlert('이름을 입력해 주세요.');
        input?.focus();
        return;
    }
    if (name.length > OUTFIT_ITEM_VALUE_MAX_LEN) {
        await showAlert(`이름은 ${OUTFIT_ITEM_VALUE_MAX_LEN}자 이하로 입력해 주세요.`);
        return;
    }

    const { active, hidden } = splitWardrobeCatalog(wardrobeCatalog);
    if (active.some((it) => it.category === cat && it.value === name)) {
        await showAlert('이미 지금 옷장에 있는 이름이에요.');
        return;
    }

    const wasAside = hidden.some((it) => it.category === cat && it.value === name);
    if (wasAside) removeOutfitSuggestionBlockedValue(cat, name);
    persistOutfitSuggestionExtra(cat, name);

    wardrobeMode = 'closet';
    wardrobeFilterCat = cat;
    closeWardrobeAddSheet();
    await reloadWardrobeCatalog();
}

async function initPage() {
    document.getElementById('wardrobeTabCloset')?.addEventListener('click', () => {
        setWardrobeMode('closet');
    });
    document.getElementById('wardrobeTabAside')?.addEventListener('click', () => {
        setWardrobeMode('aside');
    });
    document.getElementById('wardrobeAddBtn')?.addEventListener('click', openWardrobeAddSheet);
    document.getElementById('wardrobeAddSheetOverlay')?.addEventListener('click', closeWardrobeAddSheet);
    document.getElementById('wardrobeAddGrid')?.addEventListener('click', (e) => {
        const btn = e.target.closest('.outfit-category-pill');
        if (!btn?.dataset.category) return;
        wardrobeAddCat = btn.dataset.category;
        syncWardrobeAddGrid();
    });
    document.getElementById('wardrobeAddSubmit')?.addEventListener('click', () => {
        submitWardrobeAdd();
    });
    document.getElementById('wardrobeAddName')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            submitWardrobeAdd();
        }
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeWardrobeAddSheet();
    });
    window.addEventListener('resize', syncWardrobeStickyOffset);
    syncWardrobeStickyOffset();

    try {
        await reloadWardrobeCatalog();
    } catch (e) {
        console.error(e);
        const emptyEl = document.getElementById('wardrobeEmpty');
        if (emptyEl) {
            emptyEl.hidden = false;
            emptyEl.textContent = '옷장을 불러오지 못했어요.';
        }
    }
}
