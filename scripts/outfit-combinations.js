/**
 * 2.3V — 구분이 다른 착장 품목 쌍 집계 (회고)
 */
(function (global) {
  function parseLogItemsPairs(itemsJson) {
    let arr = itemsJson;
    if (typeof arr === 'string') {
      try {
        arr = JSON.parse(arr);
      } catch (_) {
        return [];
      }
    }
    if (!Array.isArray(arr)) return [];
    const out = [];
    arr.forEach((it) => {
      if (!it || typeof it !== 'object') return;
      const c = String(it.category || '').trim();
      const v = String(it.value || '').trim();
      if (c && v) out.push([c, v]);
    });
    return out;
  }

  function outfitFilterPairKey(cat, val) {
    const c = String(cat || '').trim();
    const v = String(val || '').trim();
    if (!c || !v) return '';
    return JSON.stringify([c, v]);
  }

  function comboCanonicalId(keyA, keyB) {
    const [a, b] = [keyA, keyB].sort();
    return `${a}::${b}`;
  }

  function labelForPair(keyA, keyB) {
    try {
      const a = JSON.parse(keyA);
      const b = JSON.parse(keyB);
      if (Array.isArray(a) && Array.isArray(b) && a.length === 2 && b.length === 2) {
        const rank =
          typeof global.outfitCategorySortRank === 'function'
            ? global.outfitCategorySortRank
            : () => 0;
        const parts = [
          { c: a[0], v: a[1], k: keyA },
          { c: b[0], v: b[1], k: keyB }
        ].sort((x, y) => {
          const d = rank(x.c) - rank(y.c);
          return d !== 0 ? d : x.c.localeCompare(y.c, 'ko');
        });
        const text = parts.map((p) => `${p.c} · ${p.v}`).join('  +  ');
        return { text, keys: parts.map((p) => p.k) };
      }
    } catch (_) {
      /* ignore */
    }
    return { text: '조합', keys: [keyA, keyB] };
  }

  /**
   * @param {Array<{ items?: unknown }>} logs
   * @returns {Array<{ id: string, count: number, label: string, keys: string[] }>}
   */
  function isMyOutfitLog(log) {
    const norm =
      typeof global.normalizeLogKind === 'function'
        ? global.normalizeLogKind(log?.log_kind)
        : 'my_outfit';
    return norm !== 'reference';
  }

  function aggregateOutfitCombinations(logs) {
    const map = new Map();
    (logs || []).forEach((log) => {
      if (!isMyOutfitLog(log)) return;
      const pairs = parseLogItemsPairs(log?.items);
      if (pairs.length < 2) return;
      for (let i = 0; i < pairs.length; i++) {
        for (let j = i + 1; j < pairs.length; j++) {
          const catA = pairs[i][0];
          const catB = pairs[j][0];
          if (catA === catB) continue;
          const kA = outfitFilterPairKey(catA, pairs[i][1]);
          const kB = outfitFilterPairKey(catB, pairs[j][1]);
          if (!kA || !kB) continue;
          const id = comboCanonicalId(kA, kB);
          const prev = map.get(id);
          if (prev) {
            prev.count += 1;
          } else {
            const { text, keys } = labelForPair(kA, kB);
            map.set(id, { id, count: 1, label: text, keys });
          }
        }
      }
    });
    return [...map.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'ko'));
  }

  function homeUrlForCombination(keys) {
    const list = (keys || []).filter(Boolean);
    if (!list.length) return 'home.html';
    const params = new URLSearchParams();
    params.set('outfitMatch', 'all');
    params.set('outfitKeys', JSON.stringify(list));
    return `home.html?${params.toString()}`;
  }

  async function fetchUserLogsWithItems(supabase, userId) {
    const pageSize = 400;
    let offset = 0;
    const all = [];
    let selectCols = 'id, items, log_kind';
    let withLogKind = true;
    for (;;) {
      let query = supabase
        .from('style_logs')
        .select(selectCols)
        .eq('user_id', userId)
        .order('date', { ascending: false })
        .range(offset, offset + pageSize - 1);
      let { data, error } = await query;
      if (
        error &&
        withLogKind &&
        typeof global.isLogKindColumnError === 'function' &&
        global.isLogKindColumnError(error)
      ) {
        withLogKind = false;
        selectCols = 'id, items';
        ({ data, error } = await supabase
          .from('style_logs')
          .select(selectCols)
          .eq('user_id', userId)
          .order('date', { ascending: false })
          .range(offset, offset + pageSize - 1));
      }
      if (error) throw error;
      const rows = data || [];
      all.push(...rows);
      if (rows.length < pageSize) break;
      offset += pageSize;
    }
    return all;
  }

  global.StyleLogOutfitCombinations = {
    parseLogItemsPairs,
    outfitFilterPairKey,
    aggregateOutfitCombinations,
    homeUrlForCombination,
    fetchUserLogsWithItems,
    isMyOutfitLog
  };
})(typeof window !== 'undefined' ? window : globalThis);
