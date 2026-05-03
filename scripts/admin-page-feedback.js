const {
  escapeHtml,
  formatDate,
  previewText,
  categoryLabelFeedback,
  applyAdminFetchFailure,
  setTopbarMetaPaged
} = globalThis.AdminPageUtils;

let feedbackItems = [];
let fbPage = 1;
const FB_PER_PAGE = 25;
let fbSearchDebounce = null;

function renderFeedbackTable() {
  const tbody = document.getElementById('admin-fb-tbody');
  if (!tbody) return;
  const rows = feedbackItems;
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
      <td>${escapeHtml(categoryLabelFeedback(row.category))}</td>
      <td>${escapeHtml(row.title || '—')}</td>
      <td>${escapeHtml(previewText(row.body, 72))}</td>
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
        `<p class="admin-detail-line"><strong>유형</strong><br>${escapeHtml(categoryLabelFeedback(row.category))}</p>`,
        `<p class="admin-detail-line"><strong>이메일</strong><br>${escapeHtml(row.user_email || '—')}</p>`,
        `<p class="admin-detail-line admin-mono" style="word-break:break-all;"><strong>user_id</strong><br>${escapeHtml(row.user_id || '—')}</p>`,
        `<p class="admin-detail-line"><strong>제목</strong><br>${escapeHtml(row.title)}</p>`,
        '<p class="admin-detail-line"><strong>내용</strong></p>',
        `<pre class="admin-pre">${escapeHtml(row.body || '')}</pre>`
      ].join('');
    });
  });
}

function syncFeedbackPager(j) {
  const el = document.getElementById('admin-fb-pager');
  if (!el) return;
  if (!j || !j.ok || !Array.isArray(j.items)) {
    el.replaceChildren();
    return;
  }
  globalThis.AdminPagination?.render?.(el, {
    page: j.page,
    perPage: j.perPage,
    total: j.total,
    itemCount: j.items.length,
    onPage: (n) => {
      fbPage = n;
      loadFeedback();
    }
  });
}

async function loadFeedback() {
  const tbody = document.getElementById('admin-fb-tbody');
  const meta = document.querySelector('.admin-topbar-meta');
  if (tbody) {
    tbody.innerHTML =
      '<tr class="admin-placeholder-row"><td colspan="5">불러오는 중…</td></tr>';
  }

  const sp = new URLSearchParams({
    page: String(fbPage),
    perPage: String(FB_PER_PAGE)
  });
  const q = (document.getElementById('admin-fb-search')?.value || '').trim();
  if (q) sp.set('q', q);

  const r = await fetch('/api/admin/feedback?' + sp.toString(), { credentials: 'same-origin' });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    syncFeedbackPager(null);
    applyAdminFetchFailure(meta, tbody, 5, r, j);
    return;
  }
  if (!j.ok || !Array.isArray(j.items)) {
    syncFeedbackPager(null);
    if (tbody) {
      tbody.innerHTML =
        '<tr class="admin-placeholder-row"><td colspan="5">목록을 해석할 수 없습니다.</td></tr>';
    }
    return;
  }

  feedbackItems = j.items;
  renderFeedbackTable();
  syncFeedbackPager(j);
  setTopbarMetaPaged(meta, j, '건');
}

function startFeedbackPage() {
  const s = document.getElementById('admin-fb-search');
  s?.removeAttribute('disabled');
  s?.addEventListener('input', () => {
    clearTimeout(fbSearchDebounce);
    fbSearchDebounce = setTimeout(() => {
      fbPage = 1;
      loadFeedback();
    }, 320);
  });
  loadFeedback();
}

document.addEventListener('admin:session-ok', startFeedbackPage);
if (document.documentElement.classList.contains('admin-authed')) {
  startFeedbackPage();
}
