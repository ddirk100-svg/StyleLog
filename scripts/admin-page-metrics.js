let kpiDays = 30;
let kpiControlsInited = false;

function fmtNum(v) {
  if (v == null || v === '' || Number.isNaN(Number(v))) return '—';
  return String(v);
}

function fmtPct(v) {
  if (v == null || v === '' || Number.isNaN(Number(v))) return '—';
  return String(v);
}

function setKpi(key, val) {
  document.querySelectorAll(`[data-kpi="${key}"]`).forEach((el) => {
    el.textContent = val;
  });
}

function renderKpis(j) {
  const banner = document.getElementById('admin-kpi-banner');
  if (banner) {
    if (j.hint) {
      banner.hidden = false;
      banner.textContent = j.hint;
    } else if (j.rpcMissing) {
      banner.hidden = false;
      banner.textContent =
        '일부 지표만 표시됩니다. Supabase SQL Editor에서 docs/supabase/admin_product_kpis.sql 을 실행하세요.';
    } else {
      banner.hidden = true;
      banner.textContent = '';
    }
  }

  setKpi('members', fmtNum(j.membersTotal));
  setKpi('logs', fmtNum(j.styleLogsTotal));
  setKpi('writers', fmtNum(j.writersTotal));
  setKpi('avg-member', fmtNum(j.avgLogsPerMember));
  setKpi('avg-writer', fmtNum(j.avgLogsPerWriter));

  setKpi('fav-logs', fmtNum(j.favoriteLogs));
  setKpi('fav-logs-pct', fmtPct(j.favoriteLogsPct));
  setKpi('fav-users', fmtNum(j.favoriteUsers));
  setKpi('fav-users-pct', fmtPct(j.favoriteUsersPct));

  setKpi('tpo-logs', fmtNum(j.tpoLogs));
  if (j.hasTpoColumn === false) {
    setKpi('tpo-logs-pct', 'tpo 컬럼 없음');
  } else {
    setKpi('tpo-logs-pct', j.tpoLogsPct != null ? `${fmtPct(j.tpoLogsPct)}%` : '—');
  }

  setKpi('items-logs', fmtNum(j.itemsLogs));
  if (j.hasItemsColumn === false) {
    setKpi('items-logs-pct', 'items 없음');
  } else {
    setKpi('items-logs-pct', j.itemsLogsPct != null ? `${fmtPct(j.itemsLogsPct)}%` : '—');
  }

  setKpi('repeat-writers', fmtNum(j.repeatWriters));
  setKpi('repeat-writers-pct', fmtPct(j.repeatWritersPct));

  setKpi('signups-recent', fmtNum(j.signupsRecent));
  setKpi('logs-recent', fmtNum(j.logsRecent));
  setKpi('active-writers', fmtNum(j.activeWritersRecent));
}

async function loadKpis(days) {
  const r = await fetch(`/api/admin/kpis?days=${encodeURIComponent(days)}`, {
    credentials: 'same-origin'
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) return { ok: false, hint: '지표를 불러오지 못했습니다.' };
  return j;
}

async function refreshKpis() {
  const meta = document.querySelector('.admin-topbar-meta');
  const j = await loadKpis(kpiDays);
  if (!j.ok) {
    globalThis.AdminEnvHint?.applyMetaForApiFailure?.(meta, undefined);
    renderKpis({ hint: j.hint || '지표 API 오류' });
    return;
  }
  renderKpis(j);
  globalThis.AdminEnvHint?.showMeta?.(
    meta,
    `갱신 ${new Date().toLocaleString('ko-KR')} · 최근 ${kpiDays}일 활동 · DB 집계`
  );
}

function initKpiControls() {
  if (kpiControlsInited) return;
  kpiControlsInited = true;
  const sel = document.getElementById('admin-kpi-days');
  if (!sel) return;
  sel.value = String(kpiDays);
  sel.addEventListener('change', () => {
    const d = parseInt(sel.value, 10);
    if (Number.isFinite(d) && d > 0) {
      kpiDays = d;
      refreshKpis();
    }
  });
}

function startAdminMetrics() {
  initKpiControls();
  refreshKpis();
}

document.addEventListener('admin:session-ok', startAdminMetrics);
if (document.documentElement.classList.contains('admin-authed')) {
  startAdminMetrics();
}
