const {
  escapeHtml,
  formatDate,
  previewText,
  statusLabelInquiry,
  statusClassInquiry,
  inquiryStatusFromRow,
  categoryLabelFeedback
} = globalThis.AdminPageUtils;

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
      <td><span class="${escapeHtml(statusClassInquiry(inquiryStatusFromRow(row)))}">${escapeHtml(statusLabelInquiry(inquiryStatusFromRow(row)))}</span></td>
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
      <td>${escapeHtml(categoryLabelFeedback(row.category))}</td>
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

    renderDashRecentInquiries(j.recentInquiries);
    renderDashRecentFeedback(j.recentFeedback);

    globalThis.AdminEnvHint?.setDashHintLine?.(document.getElementById('admin-dash-banner'), '', false);

    globalThis.AdminEnvHint?.showMeta?.(
      meta,
      `갱신 ${new Date().toLocaleString('ko-KR')} · 회원 수는 Auth 기준(목록 상한 반영)`
    );
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
  loadAdminDashboard();
}

document.addEventListener('admin:session-ok', startAdminDashboard);
if (document.documentElement.classList.contains('admin-authed')) {
  startAdminDashboard();
}
