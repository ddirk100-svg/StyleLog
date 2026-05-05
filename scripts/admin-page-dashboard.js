/** @type {import('chart.js').Chart[]} */
const dashCharts = [];

let trendsRange = '6m';
let trendsControlsInited = false;

function readCssColor(varName, fallback) {
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
    if (v) return v;
  } catch {
    /* ignore */
  }
  return fallback;
}

function parseColorToRgb(color) {
  const c = (color || '').trim();
  if (c.startsWith('#') && c.length === 7) {
    return [
      parseInt(c.slice(1, 3), 16),
      parseInt(c.slice(3, 5), 16),
      parseInt(c.slice(5, 7), 16)
    ];
  }
  const m = c.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (m) return [Number(m[1]), Number(m[2]), Number(m[3])];
  return null;
}

function colorWithAlpha(color, alpha) {
  const rgb = parseColorToRgb(color);
  if (!rgb) return `rgba(37, 99, 235, ${alpha})`;
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
}

function destroyDashCharts() {
  while (dashCharts.length) {
    const c = dashCharts.pop();
    c.destroy();
  }
}

/** @param {number} baseline */
function prefixSumFromBaseline(baseline, values) {
  let acc = Number(baseline) || 0;
  return values.map((v) => {
    acc += Number(v) || 0;
    return acc;
  });
}

/**
 * @param {string} range API/드롭다운 값: 1m | 3m | 6m | 1y | all
 * - 1y, all: YYYY.MM (예: 2025.05)
 * - 1m, 3m, 6m: MM/DD (예: 05/02)
 */
function formatBucketLabel(isoOrDate, range) {
  const d = new Date(isoOrDate);
  if (Number.isNaN(d.getTime())) return String(isoOrDate);
  const r = String(range || '').toLowerCase();
  if (r === '1y' || r === 'all') {
    const y = d.getUTCFullYear();
    const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
    return `${y}.${mo}`;
  }
  const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
  const da = String(d.getUTCDate()).padStart(2, '0');
  return `${mo}/${da}`;
}

/**
 * @param {HTMLCanvasElement | null} canvas
 * @param {'line' | 'bar'} chartType
 * @param {{ title: string; labels: string[]; data: number[]; borderColor: string; fillColor: string }} opts
 */
function pushTrendChart(canvas, chartType, opts) {
  if (!canvas || typeof Chart === 'undefined') return;
  const titleColor = readCssColor('--color-text-primary', '#333');
  const dataset =
    chartType === 'bar'
      ? {
          label: opts.title,
          data: opts.data,
          backgroundColor: opts.fillColor,
          borderColor: opts.borderColor,
          borderWidth: 1,
          borderRadius: 6
        }
      : {
          label: opts.title,
          data: opts.data,
          borderColor: opts.borderColor,
          backgroundColor: opts.fillColor,
          tension: 0.25,
          fill: true
        };

  const ch = new Chart(canvas, {
    type: chartType,
    data: {
      labels: opts.labels,
      datasets: [dataset]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: chartType === 'bar' },
      plugins: {
        title: {
          display: true,
          text: opts.title,
          color: titleColor,
          font: { size: 13, weight: '600' },
          padding: { bottom: 8 }
        },
        legend: { display: false }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { precision: 0, color: readCssColor('--color-text-tertiary', '#999') },
          grid: { color: readCssColor('--color-border-lighter', '#f0f0f0') }
        },
        x: {
          ticks: {
            maxRotation: 45,
            minRotation: 0,
            autoSkip: true,
            maxTicksLimit: 16,
            color: readCssColor('--color-text-tertiary', '#999')
          },
          grid: { display: false }
        }
      }
    }
  });
  dashCharts.push(ch);
}

function syncRangeSelect(range) {
  const sel = document.getElementById('admin-dash-range-select');
  if (sel && sel.value !== range) sel.value = range;
}

function renderTrendsCharts(payload) {
  const hintEl = document.getElementById('admin-dash-chart-hint');
  const buckets = Array.isArray(payload?.buckets) ? payload.buckets : [];
  const rangeKey = String(payload?.range ?? trendsRange).toLowerCase();

  if (hintEl) {
    if (payload?.hint) {
      hintEl.hidden = false;
      hintEl.textContent = payload.hint;
    } else if (payload?.rpcMissing) {
      hintEl.hidden = false;
      hintEl.textContent =
        '추이 차트는 Supabase에 admin_dashboard_trends 함수(최신 버전)가 필요합니다. docs/supabase/admin_dashboard_trends.sql 을 실행한 뒤 새로고침하세요.';
    } else {
      hintEl.hidden = true;
      hintEl.textContent = '';
    }
  }

  destroyDashCharts();

  const labels = buckets.map((b) => formatBucketLabel(b.t, rangeKey));
  const signups = buckets.map((b) => Number(b.signups ?? 0));
  const styleLogs = buckets.map((b) => Number(b.styleLogs ?? 0));
  const membersBefore = Number(payload?.membersBefore ?? 0);
  const styleLogsBefore = Number(payload?.styleLogsBefore ?? 0);
  const signupsCum = prefixSumFromBaseline(membersBefore, signups);
  const logsCum = prefixSumFromBaseline(styleLogsBefore, styleLogs);

  const primary = readCssColor('--color-primary', '#2563eb');
  const accent = readCssColor('--color-accent', '#3b82f6');

  pushTrendChart(document.getElementById('admin-dash-chart-members-new'), 'bar', {
    title: '회원가입 (기간별 신규)',
    labels,
    data: signups,
    borderColor: primary,
    fillColor: colorWithAlpha(primary, 0.55)
  });

  pushTrendChart(document.getElementById('admin-dash-chart-members-cum'), 'line', {
    title: '회원가입 (누적)',
    labels,
    data: signupsCum,
    borderColor: primary,
    fillColor: colorWithAlpha(primary, 0.08)
  });

  pushTrendChart(document.getElementById('admin-dash-chart-logs-new'), 'bar', {
    title: '스타일 로그 (기간별 신규)',
    labels,
    data: styleLogs,
    borderColor: accent,
    fillColor: colorWithAlpha(accent, 0.55)
  });

  pushTrendChart(document.getElementById('admin-dash-chart-logs-cum'), 'line', {
    title: '스타일 로그 (누적)',
    labels,
    data: logsCum,
    borderColor: accent,
    fillColor: colorWithAlpha(accent, 0.08)
  });
}

async function loadTrends(range) {
  const r = await fetch(`/api/admin/trends?range=${encodeURIComponent(range)}`, {
    credentials: 'same-origin'
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    return {
      ok: false,
      range,
      granularity: null,
      membersBefore: 0,
      styleLogsBefore: 0,
      buckets: [],
      hint: '추이 데이터를 불러오지 못했습니다.'
    };
  }
  return j;
}

async function refreshTrendsChart(range) {
  trendsRange = range;
  syncRangeSelect(range);
  const payload = await loadTrends(range);
  if (payload && payload.ok !== false) {
    renderTrendsCharts(payload);
  } else {
    renderTrendsCharts({
      range: trendsRange,
      buckets: [],
      membersBefore: 0,
      styleLogsBefore: 0,
      hint: payload?.hint || '추이를 표시할 수 없습니다.'
    });
  }
}

function initTrendsControls() {
  if (trendsControlsInited) return;
  trendsControlsInited = true;
  const sel = document.getElementById('admin-dash-range-select');
  if (!sel) return;
  sel.value = trendsRange;
  sel.addEventListener('change', () => {
    const r = sel.value;
    if (r) refreshTrendsChart(r);
  });
}

async function loadAdminDashboard() {
  const setText = (sel, val) => {
    const el = document.querySelector(sel);
    if (el) el.textContent = val;
  };

  const meta = document.querySelector('.admin-topbar-meta');

  try {
    const r = await fetch('/api/admin/summary?lite=1', { credentials: 'same-origin' });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      if (j.error === 'supabase_not_configured') {
        globalThis.AdminEnvHint?.applySupabaseNotConfigured?.(
          meta,
          document.getElementById('admin-dash-banner'),
          j
        );
        return;
      }
      if (j.error === 'server_misconfigured') {
        globalThis.AdminEnvHint?.applyServerMisconfigured?.(
          meta,
          document.getElementById('admin-dash-banner'),
          j
        );
        return;
      }
      const H = globalThis.AdminEnvHint;
      if (H) {
        H.applyMetaForApiFailure(meta, r.status);
        H.upgradeDashboardBanner(document.getElementById('admin-dash-banner'), r.status);
      } else if (meta) {
        meta.removeAttribute('hidden');
        meta.textContent = '요약을 불러오지 못했습니다 (API 또는 인증 확인).';
      }
      return;
    }
    if (!j.ok) {
      if (meta) {
        meta.removeAttribute('hidden');
        meta.textContent = '요약 응답이 올바르지 않습니다.';
      }
      return;
    }

    setText('[data-admin-metric="inq-open"]', String(j.inquiriesOpen ?? '—'));
    setText('[data-admin-metric="inq-total"]', String(j.inquiriesTotal ?? '—'));
    setText('[data-admin-metric="fb-total"]', String(j.feedbackTotal ?? '—'));
    setText('[data-admin-metric="style-logs"]', String(j.styleLogsTotal ?? '—'));
    setText('[data-admin-metric="inq-answered"]', String(j.inquiriesAnswered ?? '—'));
    setText('[data-admin-metric="fb-idea"]', String(j.feedbackIdea ?? '—'));
    setText('[data-admin-metric="fb-bug"]', String(j.feedbackBug ?? '—'));
    setText('[data-admin-metric="fb-other"]', String(j.feedbackOther ?? '—'));

    let memb = '—';
    if (j.membersListed != null) {
      memb = j.membersCapped ? `${j.membersListed}+` : String(j.membersListed);
    }
    setText('[data-admin-metric="members"]', memb);

    globalThis.AdminEnvHint?.setDashHintLine?.(document.getElementById('admin-dash-banner'), '', false);

    globalThis.AdminEnvHint?.showMeta?.(
      meta,
      `갱신 ${new Date().toLocaleString('ko-KR')} · 회원 수는 Auth 기준`
    );

    await refreshTrendsChart(trendsRange);
  } catch {
    const H = globalThis.AdminEnvHint;
    if (H) {
      H.applyMetaForApiFailure(meta, undefined);
      H.upgradeDashboardBanner(document.getElementById('admin-dash-banner'), undefined);
    } else if (meta) {
      meta.removeAttribute('hidden');
      meta.textContent = '요약 연결 실패 (Live Server·정적 호스트일 수 있음).';
    }
  }
}

function startAdminDashboard() {
  initTrendsControls();
  loadAdminDashboard();
}

document.addEventListener('admin:session-ok', startAdminDashboard);
if (document.documentElement.classList.contains('admin-authed')) {
  startAdminDashboard();
}
