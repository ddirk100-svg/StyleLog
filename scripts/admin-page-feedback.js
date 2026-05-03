let feedbackItems = [];

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

function categoryLabel(c) {
  if (c === 'bug') return '버그';
  if (c === 'idea') return '아이디어';
  return '기타';
}

function preview(text, n) {
  const t = (text || '').replace(/\s+/g, ' ').trim();
  if (t.length <= n) return t;
  return t.slice(0, n) + '…';
}

function getFilteredFeedback() {
  const q = (document.getElementById('admin-fb-search')?.value || '').trim().toLowerCase();
  if (!q) return feedbackItems;
  return feedbackItems.filter((row) => {
    const hay = `${row.title || ''} ${row.body || ''} ${row.user_email || ''} ${row.category || ''}`.toLowerCase();
    return hay.includes(q);
  });
}

function renderFeedbackTable() {
  const tbody = document.getElementById('admin-fb-tbody');
  if (!tbody) return;
  const rows = getFilteredFeedback();
  if (!rows.length) {
    tbody.innerHTML =
      '<tr class="admin-placeholder-row"><td colspan="5">표시할 피드백이 없습니다.</td></tr>';
    return;
  }
  tbody.innerHTML = rows
    .map(
      (row) => `
    <tr data-fb-id="${escapeHtml(row.id)}">
      <td>${escapeHtml(formatDate(row.created_at))}</td>
      <td>${escapeHtml(categoryLabel(row.category))}</td>
      <td>${escapeHtml(row.title || '—')}</td>
      <td>${escapeHtml(preview(row.body, 72))}</td>
      <td>${escapeHtml(row.user_email || '—')}</td>
    </tr>`
    )
    .join('');

  tbody.querySelectorAll('tr[data-fb-id]').forEach((tr) => {
    tr.addEventListener('click', () => {
      tbody.querySelectorAll('tr').forEach((r) => r.classList.remove('is-selected'));
      tr.classList.add('is-selected');
      const id = tr.getAttribute('data-fb-id');
      const row = feedbackItems.find((x) => x.id === id);
      const aside = document.getElementById('admin-fb-detail');
      if (!aside || !row) return;
      aside.innerHTML = [
        '<h2 class="admin-section-title" style="margin-top:0;">상세</h2>',
        `<p class="admin-card-hint">${escapeHtml(formatDate(row.created_at))}</p>`,
        `<p class="admin-detail-line"><strong>유형</strong><br>${escapeHtml(categoryLabel(row.category))}</p>`,
        `<p class="admin-detail-line"><strong>이메일</strong><br>${escapeHtml(row.user_email || '—')}</p>`,
        `<p class="admin-detail-line admin-mono" style="word-break:break-all;"><strong>user_id</strong><br>${escapeHtml(row.user_id || '—')}</p>`,
        `<p class="admin-detail-line"><strong>제목</strong><br>${escapeHtml(row.title)}</p>`,
        '<p class="admin-detail-line"><strong>내용</strong></p>',
        `<pre class="admin-pre">${escapeHtml(row.body || '')}</pre>`
      ].join('');
    });
  });
}

async function loadFeedback() {
  const tbody = document.getElementById('admin-fb-tbody');
  if (tbody) {
    tbody.innerHTML =
      '<tr class="admin-placeholder-row"><td colspan="5">불러오는 중…</td></tr>';
  }
  const r = await fetch('/api/admin/feedback', { credentials: 'same-origin' });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const meta = document.querySelector('.admin-topbar-meta');
    if (j.error === 'supabase_not_configured') {
      globalThis.AdminEnvHint?.applySupabaseNotConfigured?.(meta, null, j);
    } else {
      const H = globalThis.AdminEnvHint;
      if (H) H.applyMetaForApiFailure(meta, r.status);
      else if (meta) meta.textContent = '불러오기 실패';
    }
    if (tbody) {
      tbody.innerHTML =
        '<tr class="admin-placeholder-row"><td colspan="5">불러오기 실패</td></tr>';
    }
    return;
  }
  if (!j.ok || !Array.isArray(j.items)) return;
  feedbackItems = j.items;
  renderFeedbackTable();
  const meta = document.querySelector('.admin-topbar-meta');
  if (meta) meta.textContent = `총 ${j.items.length}건 (최대 300)`;
}

function startFeedbackPage() {
  const s = document.getElementById('admin-fb-search');
  s?.removeAttribute('disabled');
  s?.addEventListener('input', () => renderFeedbackTable());
  loadFeedback();
}

document.addEventListener('admin:session-ok', startFeedbackPage);
if (document.documentElement.classList.contains('admin-authed')) {
  startFeedbackPage();
}
