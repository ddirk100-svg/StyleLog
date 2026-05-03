const { escapeHtml, formatDate, applyAdminFetchFailure } = globalThis.AdminPageUtils;

let membersItems = [];
let membersPage = 1;
let membersLastPayload = null;

function emailConfirmShort(iso) {
  if (!iso) return '미인증';
  return formatDate(iso);
}

function renderMembersTable(items) {
  const tbody = document.getElementById('admin-members-tbody');
  if (!tbody) return;

  if (!items.length) {
    tbody.innerHTML =
      '<tr class="admin-placeholder-row"><td colspan="6">회원이 없습니다.</td></tr>';
    return;
  }

  tbody.innerHTML = items
    .map(
      (u) => `
    <tr data-member-id="${escapeHtml(u.id)}">
      <td>${escapeHtml(u.email)}</td>
      <td>${escapeHtml(emailConfirmShort(u.email_confirmed_at))}</td>
      <td>${escapeHtml(formatDate(u.created_at))}</td>
      <td>${escapeHtml(formatDate(u.last_sign_in_at))}</td>
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
      const phoneLine =
        u.phone != null && String(u.phone).trim() !== ''
          ? `<p class="admin-detail-line"><strong>전화</strong><br>${escapeHtml(u.phone)}</p>`
          : '<p class="admin-detail-line"><strong>전화</strong><br>—</p>';
      const banLine = u.banned_until
        ? `<p class="admin-detail-line"><strong>정지·차단 만료</strong><br>${escapeHtml(formatDate(u.banned_until))}</p>`
        : '';
      aside.innerHTML = [
        '<h2 class="admin-section-title" style="margin-top:0;">상세</h2>',
        `<p class="admin-detail-line"><strong>이메일</strong><br>${escapeHtml(u.email)}</p>`,
        phoneLine,
        `<p class="admin-detail-line"><strong>이메일 인증</strong><br>${escapeHtml(formatDate(u.email_confirmed_at) || '미인증')}</p>`,
        `<p class="admin-detail-line"><strong>가입</strong><br>${escapeHtml(formatDate(u.created_at))}</p>`,
        `<p class="admin-detail-line"><strong>계정 갱신</strong><br>${escapeHtml(formatDate(u.updated_at))}</p>`,
        `<p class="admin-detail-line"><strong>마지막 로그인</strong><br>${escapeHtml(formatDate(u.last_sign_in_at))}</p>`,
        `<p class="admin-detail-line"><strong>스타일 로그 수</strong><br>${escapeHtml(String(u.style_log_count ?? 0))}</p>`,
        banLine,
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
    membersItems.filter((u) => {
      const email = (u.email || '').toLowerCase();
      const phone = (u.phone || '').toLowerCase();
      return email.includes(q) || phone.includes(q) || u.id.toLowerCase().includes(q);
    })
  );
}

function syncMembersPager() {
  const el = document.getElementById('admin-members-pager');
  const j = membersLastPayload;
  if (!el) return;
  if (!j || !Array.isArray(j.items)) {
    el.replaceChildren();
    return;
  }
  globalThis.AdminPagination?.render?.(el, {
    page: j.page,
    perPage: j.perPage,
    total: j.total,
    itemCount: j.items.length,
    onPage: (n) => {
      membersPage = n;
      loadMembers();
    }
  });
}

async function loadMembers() {
  const tbody = document.getElementById('admin-members-tbody');
  const meta = document.querySelector('.admin-topbar-meta');
  if (tbody) {
    tbody.innerHTML =
      '<tr class="admin-placeholder-row"><td colspan="6">불러오는 중…</td></tr>';
  }

  const r = await fetch(`/api/admin/members?page=${membersPage}&perPage=40`, {
    credentials: 'same-origin'
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    membersLastPayload = null;
    syncMembersPager();
    applyAdminFetchFailure(meta, tbody, 6, r, j);
    return;
  }
  if (!j.ok || !Array.isArray(j.items)) {
    if (tbody) {
      tbody.innerHTML =
        '<tr class="admin-placeholder-row"><td colspan="6">목록을 해석할 수 없습니다.</td></tr>';
    }
    membersLastPayload = null;
    syncMembersPager();
    return;
  }
  membersLastPayload = j;
  membersItems = j.items;
  applyMembersFilter();
  syncMembersPager();

  if (meta) {
    const totalPart =
      typeof j.total === 'number' && j.total >= 0 ? ` · 전체 ${j.total}명` : '';
    meta.textContent = `페이지 ${j.page} · 페이지당 ${j.perPage}명${totalPart}`;
  }
}

function startMembersPage() {
  loadMembers();

  const search = document.getElementById('admin-members-search');
  search?.removeAttribute('disabled');
  search?.removeAttribute('aria-disabled');
  search?.addEventListener('input', () => applyMembersFilter());
}

document.addEventListener('admin:session-ok', startMembersPage);
if (document.documentElement.classList.contains('admin-authed')) {
  startMembersPage();
}
