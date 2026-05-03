const {
  escapeHtml,
  formatDate,
  previewText,
  statusLabelInquiry,
  statusClassInquiry,
  applyAdminFetchFailure,
  setTopbarMetaPaged
} = globalThis.AdminPageUtils;

let inquiriesItems = [];
let selectedInquiryId = null;
let inqPage = 1;
const INQ_PER_PAGE = 25;
let inqSearchDebounce = null;

function renderInquiryDetail(row) {
  const aside = document.getElementById('admin-inq-detail');
  if (!aside) return;
  if (!row) {
    aside.innerHTML =
      '<h2 class="admin-section-title" style="margin-top:0;">문의 상세</h2><p class="admin-card-hint">목록에서 항목을 선택하세요.</p>';
    return;
  }

  const replyVal = row.admin_reply != null ? String(row.admin_reply) : '';
  aside.innerHTML = [
    '<h2 class="admin-section-title" style="margin-top:0;">문의 상세</h2>',
    `<p class="admin-card-hint">${escapeHtml(statusLabelInquiry(row.status))} · ${escapeHtml(formatDate(row.created_at))}</p>`,
    `<p class="admin-detail-line"><strong>작성자</strong><br>${escapeHtml(row.user_email || '—')}</p>`,
    `<p class="admin-detail-line admin-mono" style="word-break:break-all;"><strong>user_id</strong><br>${escapeHtml(row.user_id || '—')}</p>`,
    `<p class="admin-detail-line"><strong>답변일(replied_at)</strong><br>${escapeHtml(formatDate(row.replied_at))}</p>`,
    `<p class="admin-detail-line"><strong>답변 수정일</strong><br>${escapeHtml(formatDate(row.admin_reply_updated_at))}</p>`,
    `<p class="admin-detail-line"><strong>제목</strong><br>${escapeHtml(row.title)}</p>`,
    '<p class="admin-detail-line"><strong>본문</strong></p>',
    `<pre class="admin-pre">${escapeHtml(row.body || '')}</pre>`,
    '<label class="admin-field-label" for="admin-inq-reply">운영자 답변</label>',
    `<textarea id="admin-inq-reply" class="admin-textarea" rows="6">${escapeHtml(replyVal)}</textarea>`,
    '<label class="admin-field-label" for="admin-inq-status">상태</label>',
    `<select id="admin-inq-status" class="admin-input" style="width:100%; margin-bottom:12px;">
      <option value="open"${row.status === 'open' ? ' selected' : ''}>미답변 (open)</option>
      <option value="answered"${row.status === 'answered' ? ' selected' : ''}>답변완료 (answered)</option>
    </select>`,
    '<button type="button" class="admin-btn admin-btn-primary" id="admin-inq-save">저장</button>',
    '<p class="admin-gate-msg" id="admin-inq-save-msg" role="status" style="margin-top:10px;"></p>'
  ].join('');

  document.getElementById('admin-inq-save')?.addEventListener('click', async () => {
    const ta = document.getElementById('admin-inq-reply');
    const st = document.getElementById('admin-inq-status');
    const msg = document.getElementById('admin-inq-save-msg');
    if (!ta || !st || !msg) return;
    msg.textContent = '저장 중…';
    const res = await fetch('/api/admin/inquiries', {
      method: 'PATCH',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: row.id,
        admin_reply: ta.value,
        status: st.value
      })
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.ok && data.item) {
      const idx = inquiriesItems.findIndex((x) => x.id === row.id);
      if (idx !== -1) inquiriesItems[idx] = data.item;
      msg.textContent = '저장했습니다.';
      renderInquiriesTable();
      renderInquiryDetail(data.item);
      return;
    }
    msg.textContent = data.detail || data.error || '저장 실패';
  });
}

function renderInquiriesTable() {
  const tbody = document.getElementById('admin-inq-tbody');
  if (!tbody) return;
  const rows = inquiriesItems;
  if (!rows.length) {
    tbody.innerHTML =
      '<tr class="admin-placeholder-row"><td colspan="6">표시할 문의가 없습니다.</td></tr>';
    return;
  }
  tbody.innerHTML = rows
    .map(
      (row) => `
    <tr data-inq-id="${escapeHtml(row.id)}" class="${row.id === selectedInquiryId ? 'is-selected' : ''}">
      <td><span class="${escapeHtml(statusClassInquiry(row.status))}">${escapeHtml(statusLabelInquiry(row.status))}</span></td>
      <td>${escapeHtml(row.title || '')}</td>
      <td>${escapeHtml(previewText(row.body, 56))}</td>
      <td>${escapeHtml(formatDate(row.created_at))}</td>
      <td>${escapeHtml(formatDate(row.replied_at))}</td>
      <td>${escapeHtml(row.user_email || '—')}</td>
    </tr>`
    )
    .join('');

  tbody.querySelectorAll('tr[data-inq-id]').forEach((tr) => {
    tr.addEventListener('click', () => {
      selectedInquiryId = tr.getAttribute('data-inq-id');
      tbody.querySelectorAll('tr').forEach((r) => r.classList.remove('is-selected'));
      tr.classList.add('is-selected');
      const row = inquiriesItems.find((x) => x.id === selectedInquiryId);
      renderInquiryDetail(row);
    });
  });
}

function syncInquiriesPager(j) {
  const el = document.getElementById('admin-inq-pager');
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
      inqPage = n;
      loadInquiries();
    }
  });
}

async function loadInquiries() {
  const tbody = document.getElementById('admin-inq-tbody');
  const meta = document.querySelector('.admin-topbar-meta');
  selectedInquiryId = null;
  renderInquiryDetail(null);

  if (tbody) {
    tbody.innerHTML =
      '<tr class="admin-placeholder-row"><td colspan="6">불러오는 중…</td></tr>';
  }

  const sp = new URLSearchParams({
    page: String(inqPage),
    perPage: String(INQ_PER_PAGE)
  });
  const st = document.getElementById('admin-inq-filter')?.value || 'all';
  if (st && st !== 'all') sp.set('status', st);
  const q = (document.getElementById('admin-inq-search')?.value || '').trim();
  if (q) sp.set('q', q);

  const r = await fetch('/api/admin/inquiries?' + sp.toString(), { credentials: 'same-origin' });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    syncInquiriesPager(null);
    applyAdminFetchFailure(meta, tbody, 6, r, j);
    return;
  }
  if (!j.ok || !Array.isArray(j.items)) {
    syncInquiriesPager(null);
    if (tbody) {
      tbody.innerHTML =
        '<tr class="admin-placeholder-row"><td colspan="6">목록을 해석할 수 없습니다.</td></tr>';
    }
    return;
  }

  inquiriesItems = j.items;
  renderInquiriesTable();
  syncInquiriesPager(j);
  setTopbarMetaPaged(meta, j, '건');
}

function startInquiriesPage() {
  const f = document.getElementById('admin-inq-filter');
  const s = document.getElementById('admin-inq-search');
  const ref = document.getElementById('admin-inq-refresh');
  f?.removeAttribute('disabled');
  s?.removeAttribute('disabled');
  ref?.removeAttribute('disabled');
  f?.addEventListener('change', () => {
    inqPage = 1;
    loadInquiries();
  });
  s?.addEventListener('input', () => {
    clearTimeout(inqSearchDebounce);
    inqSearchDebounce = setTimeout(() => {
      inqPage = 1;
      loadInquiries();
    }, 320);
  });
  ref?.addEventListener('click', () => loadInquiries());

  loadInquiries();
}

document.addEventListener('admin:session-ok', startInquiriesPage);
if (document.documentElement.classList.contains('admin-authed')) {
  startInquiriesPage();
}
