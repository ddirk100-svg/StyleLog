async function initCombinationsPage() {
  const listEl = document.getElementById('combinationsList');
  if (!listEl) return;

  const api = globalThis.StyleLogOutfitCombinations;
  if (!api) {
    listEl.innerHTML = '<p class="combo-empty">화면을 불러오지 못했어요. 새로고침 해 주세요.</p>';
    return;
  }

  const user = await getCurrentUser();
  if (!user?.id) {
    listEl.innerHTML = '<p class="combo-empty">로그인이 필요해요.</p>';
    return;
  }

  try {
    const logs = await api.fetchUserLogsWithItems(supabaseClient, user.id);
    const rows = api.aggregateOutfitCombinations(logs);
    listEl.setAttribute('aria-busy', 'false');

    if (!rows.length) {
      listEl.innerHTML =
        '<div class="combo-empty"><p>아직 조합이 없어요.</p><p class="util-sub util-sub--spaced">착장 품목을 2개 이상 넣은 코디가 쌓이면 보여요.</p><a class="util-btn-primary" href="write.html">코디 기록하기</a></div>';
      return;
    }

    listEl.innerHTML = '';
    rows.forEach((row, index) => {
      const parts =
        typeof api.comboDisplayParts === 'function'
          ? api.comboDisplayParts(row.keys)
          : [];
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'combo-card';
      btn.setAttribute('role', 'listitem');

      const rank = document.createElement('span');
      rank.className = 'combo-card-rank';
      rank.textContent = String(index + 1);

      const pieces = document.createElement('div');
      pieces.className = 'combo-card-pieces';
      parts.forEach((part) => {
        const chip = document.createElement('span');
        chip.className = 'combo-piece';
        chip.innerHTML = `<em>${escapeHtml(part.category)}</em>${escapeHtml(part.value)}`;
        pieces.appendChild(chip);
      });

      const count = document.createElement('span');
      count.className = 'combo-card-count';
      count.textContent = `${row.count}회`;

      btn.appendChild(rank);
      btn.appendChild(pieces);
      btn.appendChild(count);

      btn.addEventListener('click', () => {
        window.location.href = api.homeUrlForCombination(row.keys);
      });
      listEl.appendChild(btn);
    });
  } catch (e) {
    console.error('combinations', e);
    listEl.setAttribute('aria-busy', 'false');
    const missingItems =
      /items/.test(String(e?.message || '')) &&
      /does not exist|schema cache|pgrst204/i.test(String(e?.message || ''));
    listEl.innerHTML = missingItems
      ? '<p class="combo-empty">착장 품목 데이터를 아직 불러올 수 없어요. 잠시 후 다시 시도해 주세요.</p>'
      : '<p class="combo-empty">조합을 불러오지 못했어요. 네트워크를 확인해 주세요.</p>';
  }
}
