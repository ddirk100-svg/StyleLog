let membersItems = [];
let membersPage = 1;

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

function renderMembersTable(items) {
  const tbody = document.getElementById('admin-members-tbody');
  if (!tbody) return;

  if (!items.length) {
    tbody.innerHTML =
      '<tr class="admin-placeholder-row"><td colspan="4">회원이 없습니다.</td></tr>';
    return;
  }

  tbody.innerHTML = items
    .map(
      (u) => `
    <tr data-member-id="${escapeHtml(u.id)}">
      <td>${escapeHtml(u.email)}</td>
      <td>${escapeHtml(formatDate(u.created_at))}</td>
      <td>${escapeHtml(String(u.style_log_count ?? 0))}</td>
      <td class="admin-mono">${escapeHtml(u.id.slice(0, 8))}…</td>
    </tr>`
    )
    .join('');

  tbody.querySelectorAll('tr[data-member-id]').forEach((row) => {
    row.addEventListener('click', () => {
      tbody.querySelectorAll('tr').forEach((r) => r.classList.remove('is-selected'));
      row.classList.add('is-selected');
      const id = row.getAttribute('data-member-id');
      const u = items.find((x) => x.id === id);
      const aside = document.getElementById('admin-member-detail');
      if (!aside || !u) return;
      aside.innerHTML = [
        '<h2 class="admin-section-title" style="margin-top:0;">상세</h2>',
        `<p class="admin-detail-line"><strong>이메일</strong><br>${escapeHtml(u.email)}</p>`,
        `<p class="admin-detail-line"><strong>가입</strong><br>${escapeHtml(formatDate(u.created_at))}</p>`,
        `<p class="admin-detail-line"><strong>마지막 로그인</strong><br>${escapeHtml(formatDate(u.last_sign_in_at))}</p>`,
        `<p class="admin-detail-line"><strong>스타일 로그 수</strong><br>${escapeHtml(String(u.style_log_count ?? 0))}</p>`,
        `<p class="admin-detail-line admin-mono" style="word-break:break-all;"><strong>UUID</strong><br>${escapeHtml(u.id)}</p>`
      ].join('');
    });
  });
}

function applyMembersFilter() {
  const q = (document.getElementById('admin-members-search')?.value || '')
    .trim()
    .toLowerCase();
  if (!q) {
    renderMembersTable(membersItems);
    return;
  }
  renderMembersTable(
    membersItems.filter((u) => (u.email || '').toLowerCase().includes(q) || u.id.includes(q))
  );
}

async function loadMembers() {
  const tbody = document.getElementById('admin-members-tbody');
  if (tbody) {
    tbody.innerHTML =
      '<tr class="admin-placeholder-row"><td colspan="4">불러오는 중…</td></tr>';
  }

  const r = await fetch(`/api/admin/members?page=${membersPage}&perPage=40`, {
    credentials: 'same-origin'
  });
  if (!r.ok) {
    if (tbody) {
      tbody.innerHTML =
        '<tr class="admin-placeholder-row"><td colspan="4">불러오기 실패</td></tr>';
    }
    return;
  }
  const j = await r.json();
  if (!j.ok || !Array.isArray(j.items)) return;
  membersItems = j.items;
  applyMembersFilter();

  const meta = document.querySelector('.admin-topbar-meta');
  if (meta) meta.textContent = `페이지 ${j.page} · 페이지당 ${j.perPage}명`;
}

function startMembersPage() {
  loadMembers();

  const search = document.getElementById('admin-members-search');
  search?.removeAttribute('disabled');
  search?.removeAttribute('aria-disabled');
  search?.addEventListener('input', () => applyMembersFilter());

  const prev = document.getElementById('admin-members-prev');
  const next = document.getElementById('admin-members-next');
  prev?.addEventListener('click', () => {
    if (membersPage > 1) {
      membersPage -= 1;
      loadMembers();
    }
  });
  next?.addEventListener('click', () => {
    membersPage += 1;
    loadMembers();
  });
}

document.addEventListener('admin:session-ok', startMembersPage);
if (document.documentElement.classList.contains('admin-authed')) {
  startMembersPage();
}
