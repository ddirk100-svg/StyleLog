/**
 * 관리자 목록·대시보드 공통: 포맷·HTML 이스케이프·API 실패 처리
 */
(function (g) {
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

  function previewText(text, n) {
    const t = (text || '').replace(/\s+/g, ' ').trim();
    if (!t) return '—';
    return t.length <= n ? t : t.slice(0, n) + '…';
  }

  function statusLabelInquiry(st) {
    return st === 'answered' ? '답변완료' : '미답변';
  }

  function statusClassInquiry(st) {
    return st === 'answered' ? 'admin-pill admin-pill--ok' : 'admin-pill admin-pill--warn';
  }

  function categoryLabelFeedback(c) {
    if (c === 'bug') return '버그';
    if (c === 'idea') return '아이디어';
    return '기타';
  }

  /** @returns {boolean} HTTP 오류 처리됨( true면 caller return ) */
  function applyAdminFetchFailure(meta, tbody, colspan, r, j) {
    if (r.ok) return false;
    if (j.error === 'supabase_not_configured') {
      g.AdminEnvHint?.applySupabaseNotConfigured?.(meta, null, j);
    } else if (j.error === 'server_misconfigured') {
      g.AdminEnvHint?.applyServerMisconfigured?.(meta, null, j);
    } else {
      const H = g.AdminEnvHint;
      const parts = [];
      if (j && j.error) parts.push(String(j.error));
      if (j && j.detail) parts.push(String(j.detail));
      if (j && j.hint) parts.push(String(j.hint));
      if (meta && parts.length) {
        meta.removeAttribute('hidden');
        meta.textContent = `HTTP ${r.status}: ${parts.join(' — ')}`;
      } else if (H) {
        H.applyMetaForApiFailure(meta, r.status);
      } else if (meta) {
        meta.textContent = '불러오기 실패';
      }
    }
    if (tbody) {
      tbody.innerHTML = `<tr class="admin-placeholder-row"><td colspan="${colspan}">불러오기 실패</td></tr>`;
    }
    return true;
  }

  function setTopbarMetaPaged(meta, j, unitSuffix) {
    if (!meta) return;
    const tp = j.total > 0 ? Math.max(1, Math.ceil(j.total / j.perPage)) : 1;
    meta.textContent = `전체 ${j.total}${unitSuffix} · ${j.page}/${tp}페이지 (${j.perPage}건/페이지)`;
  }

  g.AdminPageUtils = {
    escapeHtml,
    formatDate,
    previewText,
    statusLabelInquiry,
    statusClassInquiry,
    categoryLabelFeedback,
    applyAdminFetchFailure,
    setTopbarMetaPaged
  };
})(globalThis);
