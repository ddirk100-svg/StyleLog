/**
 * 3.0V — 클라이언트 추천·정렬 (저장 데이터만, 별도 모델 없음)
 */
(function (global) {
  function normalizeLogWeatherState(log) {
    const w = String(log?.weather || '').trim().toLowerCase();
    return w || '';
  }

  function weatherStatesMatch(a, b) {
    if (!a || !b) return false;
    return a === b;
  }

  function recommendRankScore(log, todayWeatherState) {
    let score = 0;
    if (todayWeatherState && weatherStatesMatch(normalizeLogWeatherState(log), todayWeatherState)) {
      score += 100;
    }
    if (log?.is_favorite) score += 50;
    return score;
  }

  function sortLogsForRecommendMode(logs, todayWeatherState) {
    const list = [...(logs || [])];
    list.sort((a, b) => {
      const d = recommendRankScore(b, todayWeatherState) - recommendRankScore(a, todayWeatherState);
      if (d !== 0) return d;
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
    return list;
  }

  /** @returns {{ stateBlock: object[], tempOnlyBlock: object[] }} */
  function splitLogsByWeatherState(logs, todayWeatherState) {
    const stateBlock = [];
    const tempOnlyBlock = [];
    (logs || []).forEach((log) => {
      if (todayWeatherState && weatherStatesMatch(normalizeLogWeatherState(log), todayWeatherState)) {
        stateBlock.push(log);
      } else {
        tempOnlyBlock.push(log);
      }
    });
    return {
      stateBlock: sortLogsForRecommendMode(stateBlock, todayWeatherState),
      tempOnlyBlock: sortLogsForRecommendMode(tempOnlyBlock, todayWeatherState)
    };
  }

  function topComboSuggestions(logs, limit) {
    const api = global.StyleLogOutfitCombinations;
    if (!api?.aggregateOutfitCombinations) return [];
    const n = typeof limit === 'number' && limit > 0 ? limit : 3;
    const outfitOnly = (logs || []).filter((log) => {
      if (typeof api.isMyOutfitLog === 'function') return api.isMyOutfitLog(log);
      const norm =
        typeof global.normalizeLogKind === 'function'
          ? global.normalizeLogKind(log?.log_kind)
          : 'my_outfit';
      return norm !== 'reference';
    });
    return api.aggregateOutfitCombinations(outfitOnly).slice(0, n);
  }

  function partnersForItem(logs, category, value, limit) {
    const api = global.StyleLogOutfitCombinations;
    if (!api) return [];
    const anchorKey = api.outfitFilterPairKey(category, value);
    if (!anchorKey) return [];
    const n = typeof limit === 'number' && limit > 0 ? limit : 5;
    const rows = api.aggregateOutfitCombinations(logs);
    const partners = [];
    rows.forEach((row) => {
      if (!row.keys?.includes(anchorKey)) return;
      const otherKey = row.keys.find((k) => k !== anchorKey);
      if (!otherKey) return;
      try {
        const parsed = JSON.parse(otherKey);
        if (!Array.isArray(parsed) || parsed.length < 2) return;
        partners.push({
          category: String(parsed[0] || '').trim(),
          value: String(parsed[1] || '').trim(),
          count: row.count,
          keys: row.keys
        });
      } catch (_) {
        /* ignore */
      }
    });
    partners.sort((a, b) => b.count - a.count);
    return partners.slice(0, n);
  }

  global.StyleLogRecommendation = {
    normalizeLogWeatherState,
    sortLogsForRecommendMode,
    splitLogsByWeatherState,
    topComboSuggestions,
    partnersForItem
  };
})(typeof window !== 'undefined' ? window : globalThis);
