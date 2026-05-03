function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s == null ? '' : String(s);
  return d.innerHTML;
}

function formatDate(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return isNaN(d.getTime()) ? '—' : d.toLocaleString('ko-KR');
  } catch {
    return '—';
  }
}

function statusLabelInq(st) {
  return st === 'answered' ? '답변완료' : '미답변';
}

function statusClassInq(st) {
  return st === 'answered' ? 'admin-pill admin-pill--ok' : 'admin-pill admin-pill--warn';
}

function categoryLabelFb(c) {
  if (c === 'bug') return '버그';
  if (c === 'idea') return '아이디어';
  return '기타';
}

function previewText(text, n) {
  const t = (text || '').replace(/\s+/g, ' ').trim();
  if (!t) return '—';
  return t.length <= n ? t : t.slice(0, n) + '…';
}

function renderDashRecentInquiries(rows) {
  const tbody = document.getElementById('admin-dash-inq-tbody');
  if (!tbody) return;
  if (!rows || !rows.length) {
    tbody.innerHTML =
      '<tr class="admin-placeholder-row"><td colspan="4">표시할 문의가 없습니다.</td></tr>';
    return;
  }
  tbody.innerHTML = rows
    .map(
      (row) => `
    <tr>
      <td><span class="${escapeHtml(statusClassInq(row.status))}">${escapeHtml(statusLabelInq(row.status))}</span></td>
      <td>${escapeHtml(previewText(row.title, 48))}</td>
      <td>${escapeHtml(formatDate(row.created_at))}</td>
      <td>${escapeHtml(row.user_email || '—')}</td>
    </tr>`
    )
    .join('');
}

function renderDashRecentFeedback(rows) {
  const tbody = document.getElementById('admin-dash-fb-tbody');
  if (!tbody) return;
  if (!rows || !rows.length) {
    tbody.innerHTML =
      '<tr class="admin-placeholder-row"><td colspan="4">표시할 피드백이 없습니다.</td></tr>';
    return;
  }
  tbody.innerHTML = rows
    .map(
      (row) => `
    <tr>
      <td>${escapeHtml(categoryLabelFb(row.category))}</td>
      <td>${escapeHtml(previewText(row.title, 40))}</td>
      <td>${escapeHtml(formatDate(row.created_at))}</td>
      <td>${escapeHtml(row.user_email || '—')}</td>
    </tr>`
    )
    .join('');
}

async function loadAdminDashboard() {
  const setText = (sel, val) => {
    const el = document.querySelector(sel);
    if (el) el.textContent = val;
  };

  const meta = document.querySelector('.admin-topbar-meta');

  try {
    const r = await fetch('/api/admin/summary', { credentials: 'same-origin' });
    if (!r.ok) {
      const H = globalThis.AdminEnvHint;
      if (H) {
        H.applyMetaForApiFailure(meta, r.status);
        H.upgradeDashboardBanner(document.getElementById('admin-dash-banner'), r.status);
      } else if (meta) {
        meta.textContent = '요약을 불러오지 못했습니다 (API 또는 인증 확인).';
      }
      return;
    }
    const j = await r.json();
    if (!j.ok) {
      if (meta) meta.textContent = '요약 응답이 올바르지 않습니다.';
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

    renderDashRecentInquiries(j.recentInquiries);
    renderDashRecentFeedback(j.recentFeedback);

    if (meta) {
      meta.textContent = `갱신 ${new Date().toLocaleString('ko-KR')} · 회원 수는 Auth 기준(목록 상한 반영)`;
    }
  } catch {
    const H = globalThis.AdminEnvHint;
    if (H) {
      H.applyMetaForApiFailure(meta, undefined);
      H.upgradeDashboardBanner(document.getElementById('admin-dash-banner'), undefined);
    } else if (meta) {
      meta.textContent = '요약 연결 실패 (Live Server·정적 호스트일 수 있음).';
    }
  }
}

function startAdminDashboard() {
  loadAdminDashboard();
}

document.addEventListener('admin:session-ok', startAdminDashboard);
if (document.documentElement.classList.contains('admin-authed')) {
  startAdminDashboard();
}
