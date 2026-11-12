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

  function sortKeysByCategory(keys) {
    const rank =
      typeof global.outfitCategorySortRank === 'function'
        ? global.outfitCategorySortRank
        : () => 0;
    return [...(keys || [])].sort((ka, kb) => {
      try {
        const a = JSON.parse(ka);
        const b = JSON.parse(kb);
        const d = rank(a[0]) - rank(b[0]);
        return d !== 0 ? d : String(a[0]).localeCompare(String(b[0]), 'ko');
      } catch (_) {
        return String(ka).localeCompare(String(kb), 'ko');
      }
    });
  }

  function labelForKeys(sortedKeys) {
    const text = sortedKeys
      .map((k) => {
        try {
          const a = JSON.parse(k);
          if (Array.isArray(a) && a.length >= 2) return `${a[0]} · ${a[1]}`;
        } catch (_) {
          /* ignore */
        }
        return '품목';
      })
      .join('  ');
    return { text, keys: sortedKeys };
  }

  /** 코디 1건당 서로 다른 구분의 착장 전체를 하나의 조합으로 집계 (2품목 이상) */
  function aggregateOutfitCombinations(logs) {
    const map = new Map();
    (logs || []).forEach((log) => {
      if (!isMyOutfitLog(log)) return;
      const pairs = parseLogItemsPairs(log?.items);
      if (pairs.length < 2) return;

      const byCategory = new Map();
      pairs.forEach(([cat, val]) => {
        if (!byCategory.has(cat)) byCategory.set(cat, val);
      });
      if (byCategory.size < 2) return;

      const rawKeys = [];
      byCategory.forEach((val, cat) => {
        const k = outfitFilterPairKey(cat, val);
        if (k) rawKeys.push(k);
      });
      if (rawKeys.length < 2) return;

      const keys = sortKeysByCategory(rawKeys);
      const id = keys.join('::');
      const prev = map.get(id);
      if (prev) {
        prev.count += 1;
      } else {
        const { text, keys: sorted } = labelForKeys(keys);
        map.set(id, { id, count: 1, label: text, keys: sorted });
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

  function comboDisplayParts(keys) {
    const rank =
      typeof global.outfitCategorySortRank === 'function' ? global.outfitCategorySortRank : () => 0;
    const parts = (keys || [])
      .map((key) => {
        try {
          const arr = JSON.parse(key);
          if (Array.isArray(arr) && arr.length >= 2) {
            return { category: String(arr[0] || '').trim(), value: String(arr[1] || '').trim() };
          }
        } catch (_) {
          /* ignore */
        }
        return null;
      })
      .filter(Boolean);
    parts.sort((a, b) => {
      const d = rank(a.category) - rank(b.category);
      return d !== 0 ? d : a.category.localeCompare(b.category, 'ko');
    });
    return parts;
  }

  global.StyleLogOutfitCombinations = {
    parseLogItemsPairs,
    outfitFilterPairKey,
    aggregateOutfitCombinations,
    homeUrlForCombination,
    fetchUserLogsWithItems,
    isMyOutfitLog,
    comboDisplayParts
  };
})(typeof window !== 'undefined' ? window : globalThis);
