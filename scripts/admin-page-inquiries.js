/* common.js 가 전역 escapeHtml 을 두므로 여기서는 별칭 사용 */
const {
  escapeHtml: esc,
  formatDate,
  previewText,
  statusLabelInquiry,
  statusClassInquiry,
  inquiryStatusFromRow,
  applyAdminFetchFailure,
  setTopbarMetaPaged
} = globalThis.AdminPageUtils;

let inquiriesItems = [];
let selectedInquiryId = null;
let inqPage = 1;
const INQ_PER_PAGE = 25;
let inqSearchDebounce = null;

function syncInquiryRowSelection(id) {
  const tbody = document.getElementById('admin-inq-tbody');
  if (!tbody) return;
  selectedInquiryId = id;
  tbody.querySelectorAll('tr[data-inq-id]').forEach((r) => {
    r.classList.toggle('is-selected', r.getAttribute('data-inq-id') === id);
  });
}

function inquiryDetailBodyHtml(row) {
  if (!row) return '';
  const replyVal = row.admin_reply != null ? String(row.admin_reply) : '';
  const eff = inquiryStatusFromRow(row);
  return [
    `<p class="admin-card-hint">${esc(statusLabelInquiry(eff))} · ${esc(formatDate(row.created_at))}</p>`,
    `<p class="admin-detail-line"><strong>작성자</strong><br>${esc(row.user_email || '—')}</p>`,
    `<p class="admin-detail-line admin-mono" style="word-break:break-all;"><strong>user_id</strong><br>${esc(row.user_id || '—')}</p>`,
    `<p class="admin-detail-line"><strong>답변일(replied_at)</strong><br>${esc(formatDate(row.replied_at))}</p>`,
    `<p class="admin-detail-line"><strong>답변 수정일</strong><br>${esc(formatDate(row.admin_reply_updated_at))}</p>`,
    `<p class="admin-detail-line"><strong>제목</strong><br>${esc(row.title)}</p>`,
    '<p class="admin-detail-line"><strong>본문</strong></p>',
    `<pre class="admin-pre">${esc(row.body || '')}</pre>`,
    '<label class="admin-field-label" for="admin-inq-reply">운영자 답변</label>',
    `<textarea id="admin-inq-reply" class="admin-textarea" rows="6">${esc(replyVal)}</textarea>`,
    '<p class="admin-card-hint" style="margin:0 0 12px; font-size:13px;">내용을 저장하면 자동으로 답변완료·미답변이 정해집니다. (빈 칸 = 미답변)</p>',
    '<button type="button" class="admin-btn admin-btn-primary" id="admin-inq-save">저장</button>'
  ].join('');
}

function wireInquiryDetailActions(index) {
  if (!inquiriesItems[index]) return;
  const saveBtn = document.getElementById('admin-inq-save');
  if (!saveBtn) return;
  saveBtn.onclick = async () => {
    const ta = document.getElementById('admin-inq-reply');
    if (!ta || typeof showAlert !== 'function') return;
    const idx = globalThis.AdminDetailModal?.getActiveIndex?.() ?? index;
    const cur = inquiriesItems[idx];
    if (!cur) return;
    const prevLabel = saveBtn.textContent;
    saveBtn.disabled = true;
    saveBtn.textContent = '저장 중…';
    const res = await fetch('/api/admin/inquiries', {
      method: 'PATCH',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: cur.id,
        admin_reply: ta.value
      })
    });
    const data = await res.json().catch(() => ({}));
    saveBtn.disabled = false;
    saveBtn.textContent = prevLabel;
    if (res.ok && data.ok && data.item) {
      const fixIdx = inquiriesItems.findIndex((x) => x.id === cur.id);
      if (fixIdx !== -1) inquiriesItems[fixIdx] = data.item;
      renderInquiriesTable();
      globalThis.AdminDetailModal?.sync();
      await showAlert('저장이 완료되었습니다.');
      return;
    }
    await showAlert(data.detail || data.error || '저장에 실패했습니다. 다시 시도해 주세요.');
  };
}

function openInquiryModal(index) {
  globalThis.AdminDetailModal?.open({
    index,
    length: inquiriesItems.length,
    getTitle: () => '문의 상세',
    renderBody: (i) => inquiryDetailBodyHtml(inquiriesItems[i]),
    afterRender: (i) => wireInquiryDetailActions(i),
    onIndexChange: (i) => {
      const r = inquiriesItems[i];
      syncInquiryRowSelection(r?.id ?? null);
    }
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
    <tr data-inq-id="${esc(row.id)}" class="${row.id === selectedInquiryId ? 'is-selected' : ''}">
      <td><span class="${esc(statusClassInquiry(inquiryStatusFromRow(row)))}">${esc(statusLabelInquiry(inquiryStatusFromRow(row)))}</span></td>
      <td>${esc(row.title || '')}</td>
      <td>${esc(previewText(row.body, 56))}</td>
      <td>${esc(formatDate(row.created_at))}</td>
      <td>${esc(formatDate(row.replied_at))}</td>
      <td>${esc(row.user_email || '—')}</td>
    </tr>`
    )
    .join('');

  tbody.querySelectorAll('tr[data-inq-id]').forEach((tr) => {
    tr.addEventListener('click', () => {
      const id = tr.getAttribute('data-inq-id');
      const idx = inquiriesItems.findIndex((x) => x.id === id);
      if (idx === -1) return;
      syncInquiryRowSelection(id);
      openInquiryModal(idx);
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
  globalThis.AdminDetailModal?.close();

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
