// 공통 함수들
const WEATHER_FIT_LABELS = { cold: 'cold', good: 'good', hot: 'hot' };

/** 착장 품목 구분 표시·저장 정렬 순 (아우터 → 상의 → …) */
const OUTFIT_CATEGORY_SORT_ORDER = Object.freeze([
    '아우터',
    '상의',
    '하의',
    '신발',
    '액세서리',
    '가방'
]);

/** 정렬 키: 미선택은 맨 아래, 기본 외 구분은 가방 뒤에서 가나다 2차 정렬 */
function outfitCategorySortRank(category) {
    const c = String(category || '').trim();
    if (!c) return 1e9;
    const idx = OUTFIT_CATEGORY_SORT_ORDER.indexOf(c);
    if (idx !== -1) return idx;
    return OUTFIT_CATEGORY_SORT_ORDER.length;
}

/** 착장 품목 배열을 구분 순으로 정렬한 새 배열 (안정 정렬: 같은 구분 내 입력 순 유지) */
function sortOutfitItemsByCategory(items) {
    if (!Array.isArray(items) || items.length < 2) return items ? [...items] : [];
    return [...items].sort((a, b) => {
        const ca = String(a.category || '').trim();
        const cb = String(b.category || '').trim();
        const ra = outfitCategorySortRank(ca);
        const rb = outfitCategorySortRank(cb);
        if (ra !== rb) return ra - rb;
        if (ra === OUTFIT_CATEGORY_SORT_ORDER.length) {
            return ca.localeCompare(cb, 'ko');
        }
        return 0;
    });
}

const OUTFIT_ITEM_VALUE_MAX_LEN = 200;
/** 옷장·작성 후보에서 뺀 품목명 (기록 DB는 그대로) */
const LS_OUTFIT_SUGGESTION_BLOCKED = 'stylelog_outfit_suggestion_blocked_v1';
/** 이름 변경 등으로 직접 추가한 품목명 */
const LS_OUTFIT_SUGGESTION_EXTRAS = 'stylelog_outfit_suggestion_extras_v1';

function normalizeOutfitCategoryKey(cat) {
    return String(cat || '').trim();
}

function readOutfitSuggestionLsObject(key) {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return {};
        const o = JSON.parse(raw);
        return o && typeof o === 'object' && !Array.isArray(o) ? o : {};
    } catch (_) {
        return {};
    }
}

function writeOutfitSuggestionLsObject(key, obj) {
    try {
        localStorage.setItem(key, JSON.stringify(obj));
    } catch (_) {
        /* 용량·프라이빗 모드 등 */
    }
}

function outfitSuggestionStringsForCategory(obj, cat) {
    const k = normalizeOutfitCategoryKey(cat);
    const arr = obj[k];
    return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string') : [];
}

function upsertOutfitSuggestionLsValue(storageKey, category, value) {
    const c = normalizeOutfitCategoryKey(category);
    const v = String(value || '').trim();
    if (!c || !v) return;
    const o = readOutfitSuggestionLsObject(storageKey);
    o[c] = [...new Set([...outfitSuggestionStringsForCategory(o, c), v])];
    writeOutfitSuggestionLsObject(storageKey, o);
}

function removeOutfitSuggestionLsValue(storageKey, category, value) {
    const c = normalizeOutfitCategoryKey(category);
    const v = String(value || '').trim();
    if (!c || !v) return;
    const o = readOutfitSuggestionLsObject(storageKey);
    const list = outfitSuggestionStringsForCategory(o, c).filter((x) => String(x).trim() !== v);
    if (list.length > 0) o[c] = list;
    else delete o[c];
    writeOutfitSuggestionLsObject(storageKey, o);
}

function getOutfitSuggestionBlockedMap() {
    const o = readOutfitSuggestionLsObject(LS_OUTFIT_SUGGESTION_BLOCKED);
    const map = new Map();
    Object.keys(o).forEach((cat) => {
        const set = new Set();
        outfitSuggestionStringsForCategory(o, cat).forEach((s) => {
            const t = String(s || '').trim();
            if (t) set.add(t);
        });
        if (set.size) map.set(normalizeOutfitCategoryKey(cat), set);
    });
    return map;
}

function getOutfitSuggestionBlockedSet(category) {
    return getOutfitSuggestionBlockedMap().get(normalizeOutfitCategoryKey(category)) || new Set();
}

function persistOutfitSuggestionBlocked(category, value) {
    upsertOutfitSuggestionLsValue(LS_OUTFIT_SUGGESTION_BLOCKED, category, value);
}

function removeOutfitSuggestionBlockedValue(category, value) {
    removeOutfitSuggestionLsValue(LS_OUTFIT_SUGGESTION_BLOCKED, category, value);
}

function persistOutfitSuggestionExtra(category, value) {
    upsertOutfitSuggestionLsValue(LS_OUTFIT_SUGGESTION_EXTRAS, category, value);
}

function removeOutfitSuggestionExtraPersisted(category, value) {
    removeOutfitSuggestionLsValue(LS_OUTFIT_SUGGESTION_EXTRAS, category, value);
}

function isOutfitItemHiddenInMap(blockedMap, category, value) {
    const v = String(value || '').trim();
    if (!v) return false;
    return blockedMap.get(normalizeOutfitCategoryKey(category))?.has(v) === true;
}

function isOutfitItemHiddenFromWardrobe(category, value) {
    return isOutfitItemHiddenInMap(getOutfitSuggestionBlockedMap(), category, value);
}

function getOutfitCategoryIconMarkup(categoryLabel) {
    const key = String(categoryLabel || '').trim();
    const svgs = {
        아우터: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.2 8.5c0-3.4 7.6-3.4 7.6 0"></path><path d="M8.2 8.5h7.6V21H8.2V8.5z"></path><path d="M8.2 9.2L3.6 12.2v5.2l3.2.8 1.4-3.4"></path><path d="M15.8 9.2l4.6 3v5.2l-3.2.8-1.4-3.4"></path><path d="M12 8.5v12.5"></path></svg>',
        상의: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6L3 9.5 5.5 13 8 11.2V20h8V11.2L18.5 13 21 9.5 16 6H8z"></path></svg>',
        하의: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.6" y="3.5" width="6.8" height="17" rx="1.2"></rect><rect x="13.6" y="3.5" width="6.8" height="17" rx="1.2"></rect><path d="M10.4 3.5h3.2"></path></svg>',
        신발: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 18.2V13.5h7.2c1.2 0 2.2-3.6 6-3.6h3.6L22 18.2"></path><path d="M3 18.2h19"></path><path d="M3 18.2v2.4h19v-2.4"></path><path d="M10.2 13.5h3.4"></path></svg>',
        액세서리: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="2.2" width="6" height="3.6" rx="1"></rect><circle cx="12" cy="12" r="5"></circle><rect x="9" y="18.2" width="6" height="3.6" rx="1"></rect><path d="M12 9.8v2.4l1.6 1"></path></svg>',
        가방: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="8" width="12" height="13" rx="1.5"></rect><path d="M9 8V6.2A3 3 0 0 1 15 6.2V8"></path></svg>'
    };
    return svgs[key] || '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="3.5" width="16" height="17" rx="1.5"></rect><path d="M12 3.5v17"></path><circle cx="9.3" cy="12.5" r="1"></circle><circle cx="14.7" cy="12.5" r="1"></circle></svg>';
}

/** 기록 집계 + 직접 추가한 품목을 옷장 목록으로 합칩니다. */
function mergeWardrobeCatalogWithExtras(catalog) {
    const list = [];
    const seen = new Set();
    (catalog || []).forEach((it) => {
        const c = String(it?.category || '').trim();
        const v = String(it?.value || '').trim();
        if (!c || !v) return;
        const k = `${c}\0${v}`;
        if (seen.has(k)) return;
        seen.add(k);
        list.push({
            category: c,
            value: v,
            wearCount: Number(it.wearCount) || 0,
            lastWorn: typeof it.lastWorn === 'string' ? it.lastWorn : ''
        });
    });
    const extras = readOutfitSuggestionLsObject(LS_OUTFIT_SUGGESTION_EXTRAS);
    Object.keys(extras).forEach((cat) => {
        outfitSuggestionStringsForCategory(extras, cat).forEach((raw) => {
            const c = normalizeOutfitCategoryKey(cat);
            const v = String(raw || '').trim();
            if (!c || !v) return;
            const k = `${c}\0${v}`;
            if (seen.has(k)) return;
            seen.add(k);
            list.push({ category: c, value: v, wearCount: 0, lastWorn: '' });
        });
    });
    return list;
}

function countActiveWardrobeItems(catalog) {
    const blocked = getOutfitSuggestionBlockedMap();
    return mergeWardrobeCatalogWithExtras(catalog)
        .filter((it) => !isOutfitItemHiddenInMap(blocked, it.category, it.value)).length;
}

// 다이얼로그 CSS 로드 (한 번만)
(function loadDialogStyles() {
    if (document.getElementById('stylelog-dialog-styles')) return;
    const link = document.createElement('link');
    link.id = 'stylelog-dialog-styles';
    link.rel = 'stylesheet';
    link.href = 'styles/dialog.css';
    document.head.appendChild(link);
})();

/** 알럿 표시 (확인 버튼만) */
function showAlert(message) {
    return new Promise((resolve) => {
        const backdrop = document.createElement('div');
        backdrop.className = 'stylelog-dialog-backdrop';
        backdrop.innerHTML = `
            <div class="stylelog-dialog" role="alertdialog" aria-modal="true" aria-labelledby="stylelog-dialog-msg">
                <div class="stylelog-dialog-body">
                    <p class="stylelog-dialog-message" id="stylelog-dialog-msg">${escapeHtml(message)}</p>
                </div>
                <div class="stylelog-dialog-actions single">
                    <button type="button" class="stylelog-dialog-btn stylelog-dialog-btn-confirm">확인</button>
                </div>
            </div>
        `;
        const btn = backdrop.querySelector('button');
        const close = () => {
            document.removeEventListener('keydown', onKey);
            backdrop.remove();
            document.body.style.overflow = '';
            resolve();
        };
        const onKey = (e) => { if (e.key === 'Escape') close(); };
        btn.addEventListener('click', close);
        backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });
        document.addEventListener('keydown', onKey);
        document.body.style.overflow = 'hidden';
        document.body.appendChild(backdrop);
    });
}

/** 확인 대화상자 (확인/취소) - true: 확인, false: 취소 */
function showConfirm(message, options = {}) {
    const { confirmText = '확인', cancelText = '취소', danger = false } = options;
    return new Promise((resolve) => {
        const backdrop = document.createElement('div');
        backdrop.className = 'stylelog-dialog-backdrop';
        const confirmCls = danger ? 'stylelog-dialog-btn-danger' : 'stylelog-dialog-btn-confirm';
        backdrop.innerHTML = `
            <div class="stylelog-dialog" role="alertdialog" aria-modal="true" aria-labelledby="stylelog-dialog-msg">
                <div class="stylelog-dialog-body">
                    <p class="stylelog-dialog-message" id="stylelog-dialog-msg">${escapeHtml(message)}</p>
                </div>
                <div class="stylelog-dialog-actions">
                    <button type="button" class="stylelog-dialog-btn stylelog-dialog-btn-cancel">${escapeHtml(cancelText)}</button>
                    <button type="button" class="stylelog-dialog-btn ${confirmCls}">${escapeHtml(confirmText)}</button>
                </div>
            </div>
        `;
        const [cancelBtn, confirmBtn] = backdrop.querySelectorAll('button');
        const close = (result) => {
            document.removeEventListener('keydown', onKey);
            backdrop.remove();
            document.body.style.overflow = '';
            resolve(result);
        };
        const onKey = (e) => { if (e.key === 'Escape') close(false); };
        cancelBtn.addEventListener('click', () => close(false));
        confirmBtn.addEventListener('click', () => close(true));
        backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(false); });
        document.addEventListener('keydown', onKey);
        document.body.style.overflow = 'hidden';
        document.body.appendChild(backdrop);
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/** 입력 대화상자 — 확인 시 문자열, 취소 시 null */
function showPrompt(message, options = {}) {
    const {
        defaultValue = '',
        confirmText = '확인',
        cancelText = '취소',
        maxLength = OUTFIT_ITEM_VALUE_MAX_LEN,
        hint = ''
    } = options;
    return new Promise((resolve) => {
        const backdrop = document.createElement('div');
        backdrop.className = 'stylelog-dialog-backdrop';
        const hintHtml = hint
            ? `<p class="stylelog-dialog-hint">${escapeHtml(hint)}</p>`
            : '';
        backdrop.innerHTML = `
            <div class="stylelog-dialog" role="dialog" aria-modal="true" aria-labelledby="stylelog-dialog-msg">
                <div class="stylelog-dialog-body">
                    <p class="stylelog-dialog-message" id="stylelog-dialog-msg">${escapeHtml(message)}</p>
                    ${hintHtml}
                    <input type="text" class="stylelog-dialog-input" maxlength="${Number(maxLength) || 200}" autocomplete="off">
                </div>
                <div class="stylelog-dialog-actions">
                    <button type="button" class="stylelog-dialog-btn stylelog-dialog-btn-cancel">${escapeHtml(cancelText)}</button>
                    <button type="button" class="stylelog-dialog-btn stylelog-dialog-btn-confirm">${escapeHtml(confirmText)}</button>
                </div>
            </div>
        `;
        const input = backdrop.querySelector('.stylelog-dialog-input');
        const [cancelBtn, confirmBtn] = backdrop.querySelectorAll('button');
        input.value = String(defaultValue || '');
        const close = (result) => {
            document.removeEventListener('keydown', onKey);
            backdrop.remove();
            document.body.style.overflow = '';
            resolve(result);
        };
        const submit = () => close(input.value);
        const onKey = (e) => {
            if (e.key === 'Escape') close(null);
            if (e.key === 'Enter') {
                e.preventDefault();
                submit();
            }
        };
        cancelBtn.addEventListener('click', () => close(null));
        confirmBtn.addEventListener('click', submit);
        backdrop.addEventListener('click', (e) => {
            if (e.target === backdrop) close(null);
        });
        document.addEventListener('keydown', onKey);
        document.body.style.overflow = 'hidden';
        document.body.appendChild(backdrop);
        setTimeout(() => {
            input.focus();
            input.select();
        }, 0);
    });
}

/** support_inquiries 테이블 없음·스키마 캐시 오류 등 (다른 DB 오류와 구분) */
function isSupportInquiriesTableMissingError(err) {
    const code = String(err?.code || '');
    const msg = String(err?.message || '');
    const lower = msg.toLowerCase();
    if (code === '42P01' && lower.includes('support_inquiries')) return true;
    if (lower.includes('relation') && lower.includes('support_inquiries') && lower.includes('does not exist')) return true;
    if (code === 'PGRST204' && (lower.includes('support_inquiries') || lower.includes('could not find'))) return true;
    if (lower.includes('support_inquiries') && (lower.includes('schema cache') || lower.includes('not found in the schema cache'))) return true;
    return false;
}

function getInquiryListErrorMessage(err) {
    if (isSupportInquiriesTableMissingError(err)) {
        return '문의 테이블이 이 프로젝트에 없거나 캐시 미갱신일 수 있습니다. support_inquiries.sql 실행·Table Editor 확인·잠시 후 재시도.';
    }
    const c = err?.code ? ` [${err.code}]` : '';
    return `${err?.message || '알 수 없는 오류'}${c}`;
}

function getInquiryWriteErrorMessage(err) {
    if (isSupportInquiriesTableMissingError(err)) {
        return [
            '문의를 저장하는 DB 테이블이 연결된 프로젝트에 아직 없거나, 방금 만든 직후 캐시가 갱신되지 않았을 수 있어요.',
            '1) 앱이 쓰는 Supabase(테스트/리얼)에 support_inquiries.sql 을 실행했는지 확인',
            '2) Table Editor에 public.support_inquiries 가 보이는지 확인',
            '3) 1~2분 뒤 다시 시도 (여전하면 Dashboard에서 API 재시작 등)'
        ].join('\n');
    }
    const code = err?.code ? ` [${err.code}]` : '';
    const details = err?.details ? `\n${err.details}` : '';
    const hint = err?.hint ? `\n힌트: ${err.hint}` : '';
    const body = err?.message || '알 수 없는 오류';
    if (String(err?.code) === '42501' || /row-level security|rls/i.test(body)) {
        return `저장이 거부되었습니다(권한·RLS).${code}\n\n${body}${details}${hint}`;
    }
    return `전송에 실패했습니다.${code}\n\n${body}${details}${hint}`;
}

/** 기온 직접 입력 다이얼로그 - { low, high } 또는 null 반환 */
function showTempInputDialog(currentLow, currentHigh, options = {}) {
    const { minVal = -20, maxVal = 40 } = options;
    return new Promise((resolve) => {
        const backdrop = document.createElement('div');
        backdrop.className = 'stylelog-dialog-backdrop';
        backdrop.innerHTML = `
            <div class="stylelog-dialog" role="dialog" aria-modal="true" aria-labelledby="stylelog-dialog-msg">
                <div class="stylelog-dialog-body" style="text-align: center;">
                    <p class="stylelog-dialog-message" id="stylelog-dialog-msg">기온 직접 입력</p>
                    <div class="stylelog-dialog-input-group">
                        <div class="stylelog-dialog-input-row">
                            <label class="stylelog-dialog-input-label" for="stylelog-temp-low">최저</label>
                            <input type="number" id="stylelog-temp-low" class="stylelog-dialog-input" 
                                min="${minVal}" max="${maxVal}" value="${currentLow}" inputmode="numeric">
                        </div>
                        <div class="stylelog-dialog-input-row">
                            <label class="stylelog-dialog-input-label" for="stylelog-temp-high">최고</label>
                            <input type="number" id="stylelog-temp-high" class="stylelog-dialog-input" 
                                min="${minVal}" max="${maxVal}" value="${currentHigh}" inputmode="numeric">
                        </div>
                        <p class="stylelog-dialog-input-hint">${minVal}° ~ ${maxVal}° 사이 숫자를 입력하세요</p>
                    </div>
                </div>
                <div class="stylelog-dialog-actions">
                    <button type="button" class="stylelog-dialog-btn stylelog-dialog-btn-cancel">취소</button>
                    <button type="button" class="stylelog-dialog-btn stylelog-dialog-btn-confirm">확인</button>
                </div>
            </div>
        `;
        const inputLow = backdrop.querySelector('#stylelog-temp-low');
        const inputHigh = backdrop.querySelector('#stylelog-temp-high');
        const [cancelBtn, confirmBtn] = backdrop.querySelectorAll('.stylelog-dialog-btn');

        const close = (result) => {
            document.removeEventListener('keydown', onKey);
            backdrop.remove();
            document.body.style.overflow = '';
            resolve(result);
        };

        const onKey = (e) => {
            if (e.key === 'Escape') close(null);
        };

        const doConfirm = () => {
            const low = parseInt(inputLow.value, 10);
            const high = parseInt(inputHigh.value, 10);
            if (isNaN(low) || isNaN(high)) {
                if (typeof showAlert === 'function') showAlert('숫자를 입력해 주세요.');
                return;
            }
            const clampedLow = Math.max(minVal, Math.min(maxVal, low));
            const clampedHigh = Math.max(minVal, Math.min(maxVal, high));
            if (clampedLow > clampedHigh) {
                if (typeof showAlert === 'function') showAlert('최저 기온은 최고 기온보다 낮아야 해요.');
                return;
            }
            close({ low: clampedLow, high: clampedHigh });
        };

        cancelBtn.addEventListener('click', () => close(null));
        confirmBtn.addEventListener('click', doConfirm);
        inputLow.addEventListener('keydown', (e) => { if (e.key === 'Enter') inputHigh.focus(); });
        inputHigh.addEventListener('keydown', (e) => { if (e.key === 'Enter') doConfirm(); });
        backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(null); });
        document.addEventListener('keydown', onKey);
        document.body.style.overflow = 'hidden';
        document.body.appendChild(backdrop);
        requestAnimationFrame(() => inputLow?.select());
    });
}

// 아이템 메뉴 표시
function showItemMenu(logId, date, onEdit, onDelete) {
    debugLog('📋 showItemMenu 호출:', { logId, date });
    
    const menuPopup = document.getElementById('itemMenuPopup');
    if (!menuPopup) {
        console.error('❌ itemMenuPopup을 찾을 수 없습니다');
        return;
    }
    
    // 팝업 열기
    menuPopup.classList.add('active');
    document.body.style.overflow = 'hidden';
    
    // 빠른 탭 시 오버레이가 즉시 닫는 것 방지 (열린 직후 같은 탭이 오버레이에 전달될 수 있음)
    const openTime = Date.now();
    const CLOSE_GUARD_MS = 350;
    
    // 기존 이벤트 리스너 제거 (중복 방지)
    const editBtn = menuPopup.querySelector('.edit-menu-btn');
    const deleteBtn = menuPopup.querySelector('.delete-menu-btn');
    const cancelBtn = menuPopup.querySelector('.cancel-menu-btn');
    const overlay = menuPopup.querySelector('.menu-overlay');
    
    // 버튼들을 복제하여 이벤트 리스너 초기화
    if (editBtn) {
        const newEditBtn = editBtn.cloneNode(true);
        editBtn.parentNode.replaceChild(newEditBtn, editBtn);
        
        newEditBtn.addEventListener('click', () => {
            debugLog('✏️ 수정 버튼 클릭:', { logId, date });
            closeItemMenu();
            if (onEdit) onEdit(logId, date);
        });
    }
    
    if (deleteBtn) {
        const newDeleteBtn = deleteBtn.cloneNode(true);
        deleteBtn.parentNode.replaceChild(newDeleteBtn, deleteBtn);
        
        newDeleteBtn.addEventListener('click', () => {
            debugLog('🗑️ 삭제 버튼 클릭:', logId);
            closeItemMenu();
            if (onDelete) onDelete(logId);
        });
    }
    
    if (cancelBtn) {
        const newCancelBtn = cancelBtn.cloneNode(true);
        cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
        
        newCancelBtn.addEventListener('click', () => {
            debugLog('❌ 취소 버튼 클릭');
            closeItemMenu();
        });
    }
    
    if (overlay) {
        const newOverlay = overlay.cloneNode(true);
        overlay.parentNode.replaceChild(newOverlay, overlay);
        
        newOverlay.addEventListener('click', () => {
            if (Date.now() - openTime < CLOSE_GUARD_MS) return; /* 빠른 탭 시 무시 */
            debugLog('📱 오버레이 클릭 - 메뉴 닫기');
            closeItemMenu();
        });
    }
}

// 아이템 메뉴 닫기
function closeItemMenu() {
    const menuPopup = document.getElementById('itemMenuPopup');
    if (menuPopup) {
        menuPopup.classList.remove('active');
        document.body.style.overflow = '';
    }
}

// 날씨 아이콘 SVG 반환
function getWeatherIconSVG(weather, size = 24) {
    const icons = {
        sunny: `<svg class="weather-icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <circle cx="12" cy="12" r="4"></circle>
            <path d="M12 2v4M12 18v4M22 12h-4M6 12H2M19.07 4.93l-2.83 2.83M7.76 16.24l-2.83 2.83M19.07 19.07l-2.83-2.83M7.76 7.76L4.93 4.93"></path>
        </svg>`,
        clear: `<svg class="weather-icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <circle cx="12" cy="12" r="4"></circle>
            <path d="M12 2v4M12 18v4M22 12h-4M6 12H2M19.07 4.93l-2.83 2.83M7.76 16.24l-2.83 2.83M19.07 19.07l-2.83-2.83M7.76 7.76L4.93 4.93"></path>
        </svg>`,
        cloudy: `<svg class="weather-icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"></path>
        </svg>`,
        rainy: `<svg class="weather-icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"></path>
            <line x1="8" y1="19" x2="8" y2="21"></line>
            <line x1="13" y1="19" x2="13" y2="21"></line>
            <line x1="16" y1="19" x2="16" y2="21"></line>
        </svg>`,
        snowy: `<svg class="weather-icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"></path>
            <circle cx="8" cy="20" r="1"></circle>
            <circle cx="13" cy="20" r="1"></circle>
            <circle cx="16" cy="20" r="1"></circle>
        </svg>`,
        lightning: `<svg class="weather-icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
        </svg>`
    };
    return icons[weather] || icons.cloudy;
}

// 날씨 관련 함수들은 config.js에 이미 정의되어 있음:
// - getWeatherByDate(date): 특정 날짜의 날씨 조회
// - getCurrentWeather(): 현재 날씨 조회
// - getWeatherByCoords(lat, lon): 좌표 기반 현재 날씨 조회
// - getWeatherByDateAndCoords(lat, lon, date): 좌표 + 날짜 기반 날씨 조회

// 유틸리티 함수 추가 (config.js의 utils 객체에 추가)
if (typeof utils !== 'undefined') {
    utils.showLoading = utils.showLoading || function() {
        // 로딩 표시 (필요시 구현)
    };
    
    utils.hideLoading = utils.hideLoading || function() {
        // 로딩 숨기기 (필요시 구현)
    };
    
    utils.showError = function(message) {
        console.error('❌', message);
        showAlert(message);
    };
    
    utils.showSuccess = utils.showSuccess || function(message) {
        debugLog('✅', message);
    };
}

