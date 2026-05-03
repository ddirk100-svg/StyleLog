async function loadAdminDashboard() {
  const setText = (sel, val) => {
    const el = document.querySelector(sel);
    if (el) el.textContent = val;
  };

  try {
    const r = await fetch('/api/admin/summary', { credentials: 'same-origin' });
    if (!r.ok) return;
    const j = await r.json();
    if (!j.ok) return;

    setText('[data-admin-metric="inq-open"]', String(j.inquiriesOpen ?? '—'));
    setText('[data-admin-metric="inq-total"]', String(j.inquiriesTotal ?? '—'));
    setText('[data-admin-metric="fb-total"]', String(j.feedbackTotal ?? '—'));

    let memb = '—';
    if (j.membersListed != null) {
      memb = j.membersCapped ? `${j.membersListed}+` : String(j.membersListed);
    }
    setText('[data-admin-metric="members"]', memb);

    const meta = document.querySelector('.admin-topbar-meta');
    if (meta) {
      meta.textContent = '요약 연동됨 · 회원 수는 최대 1000건 기준';
    }
  } catch {
    /* noop */
  }
}

function startAdminDashboard() {
  loadAdminDashboard();
}

document.addEventListener('admin:session-ok', startAdminDashboard);
if (document.documentElement.classList.contains('admin-authed')) {
  startAdminDashboard();
}
