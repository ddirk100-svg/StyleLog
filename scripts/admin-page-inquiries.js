let inquiriesItems = [];
let selectedInquiryId = null;

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

function statusLabel(st) {
  return st === 'answered' ? '답변완료' : '미답변';
}

function statusClass(st) {
  return st === 'answered' ? 'admin-pill admin-pill--ok' : 'admin-pill admin-pill--warn';
}

function previewBody(text, n) {
  const t = (text || '').replace(/\s+/g, ' ').trim();
  if (!t) return '—';
  return t.length <= n ? t : t.slice(0, n) + '…';
}

function getFilteredInquiries() {
  const status = document.getElementById('admin-inq-filter')?.value || 'all';
  const q = (document.getElementById('admin-inq-search')?.value || '').trim().toLowerCase();
  return inquiriesItems.filter((row) => {
    if (status !== 'all' && row.status !== status) return false;
    if (!q) return true;
    const hay = `${row.title || ''} ${row.body || ''} ${row.user_email || ''}`.toLowerCase();
    return hay.includes(q);
  });
}

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
    `<p class="admin-card-hint">${escapeHtml(statusLabel(row.status))} · ${escapeHtml(formatDate(row.created_at))}</p>`,
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
  const rows = getFilteredInquiries();
  if (!rows.length) {
    tbody.innerHTML =
      '<tr class="admin-placeholder-row"><td colspan="6">표시할 문의가 없습니다.</td></tr>';
    return;
  }
  tbody.innerHTML = rows
    .map(
      (row) => `
    <tr data-inq-id="${escapeHtml(row.id)}" class="${row.id === selectedInquiryId ? 'is-selected' : ''}">
      <td><span class="${escapeHtml(statusClass(row.status))}">${escapeHtml(statusLabel(row.status))}</span></td>
      <td>${escapeHtml(row.title || '')}</td>
      <td>${escapeHtml(previewBody(row.body, 56))}</td>
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

async function loadInquiries() {
  const tbody = document.getElementById('admin-inq-tbody');
  if (tbody) {
    tbody.innerHTML =
      '<tr class="admin-placeholder-row"><td colspan="6">불러오는 중…</td></tr>';
  }
  const r = await fetch('/api/admin/inquiries', { credentials: 'same-origin' });
  if (!r.ok) {
    if (tbody) {
      tbody.innerHTML =
        '<tr class="admin-placeholder-row"><td colspan="6">불러오기 실패</td></tr>';
    }
    return;
  }
  const j = await r.json();
  if (!j.ok || !Array.isArray(j.items)) return;
  inquiriesItems = j.items;
  renderInquiriesTable();
  const meta = document.querySelector('.admin-topbar-meta');
  if (meta) meta.textContent = `총 ${j.items.length}건 (최대 300)`;
}

function startInquiriesPage() {
  const f = document.getElementById('admin-inq-filter');
  const s = document.getElementById('admin-inq-search');
  const ref = document.getElementById('admin-inq-refresh');
  f?.removeAttribute('disabled');
  s?.removeAttribute('disabled');
  ref?.removeAttribute('disabled');
  f?.addEventListener('change', () => renderInquiriesTable());
  s?.addEventListener('input', () => renderInquiriesTable());
  ref?.addEventListener('click', () => loadInquiries());

  loadInquiries();
}

document.addEventListener('admin:session-ok', startInquiriesPage);
if (document.documentElement.classList.contains('admin-authed')) {
  startInquiriesPage();
}
