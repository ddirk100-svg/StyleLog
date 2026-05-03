/**
 * Live Server(:5500 등)처럼 /api 가 없을 때 안내.
 * admin HTML 에서 admin-shell 다음, 페이지 스크립트 전에 로드하세요.
 */
(function () {
  const META_GENERIC = 'API 또는 인증·환경 변수를 확인하세요.';

  function likelyStaticNoApi(httpStatus) {
    if (httpStatus == null) return true;
    if (httpStatus === 404) return true;
    const p = String(typeof location !== 'undefined' ? location.port || '' : '');
    return p === '5500' || p === '5501';
  }

  /** 힌트 박스와 문구가 겹치면 상단 부제는 숨김 */
  function hideMetaWhenBannerCovers(metaEl) {
    if (!metaEl) return;
    metaEl.textContent = '';
    metaEl.setAttribute('hidden', '');
  }

  function showMeta(metaEl, text) {
    if (!metaEl) return;
    metaEl.removeAttribute('hidden');
    metaEl.textContent = text;
  }

  function applyMetaForApiFailure(metaEl, httpStatus) {
    if (!metaEl) return;
    if (likelyStaticNoApi(httpStatus)) {
      hideMetaWhenBannerCovers(metaEl);
      return;
    }
    showMeta(metaEl, META_GENERIC);
  }

  /** 대시보드: 한 줄만, 박스 스 타일 없음 */
  function setDashHintLine(bannerEl, line, warn) {
    if (!bannerEl) return;
    if (!line) {
      bannerEl.hidden = true;
      bannerEl.textContent = '';
      bannerEl.classList.remove('admin-hint-line--warn');
      return;
    }
    bannerEl.hidden = false;
    bannerEl.textContent = line;
    bannerEl.classList.toggle('admin-hint-line--warn', !!warn);
  }

  function upgradeDashboardBanner(bannerEl, httpStatus) {
    if (!bannerEl || !likelyStaticNoApi(httpStatus)) return;
    setDashHintLine(
      bannerEl,
      '데이터 미로딩: Live Server(:5500)에는 /api 가 없습니다. npm run dev 로 연 뒤 /admin/index.html 을 여세요.',
      true
    );
  }

  function applySupabaseNotConfigured(metaEl, bannerEl, payload) {
    if (!payload || payload.error !== 'supabase_not_configured') return;
    hideMetaWhenBannerCovers(metaEl);
    const missing = Array.isArray(payload.missing) ? payload.missing.join(', ') : '';
    const base = payload.message || 'Supabase 연결 설정을 확인하세요.';
    const line = missing ? 'Supabase: ' + missing + ' — Vercel·docs/deploy-admin-subdomains.md' : base;
    setDashHintLine(bannerEl, line, true);
  }

  function applyServerMisconfigured(metaEl, bannerEl, payload) {
    if (!payload || payload.error !== 'server_misconfigured') return;
    hideMetaWhenBannerCovers(metaEl);
    const missing = Array.isArray(payload.missing) ? payload.missing.join(', ') : '';
    const base = payload.message || '관리자 서버 환경 변수를 확인하세요.';
    const line = missing ? '관리자 설정: ' + missing + ' — Vercel·Redeploy.' : base;
    setDashHintLine(bannerEl, line, true);
  }

  globalThis.AdminEnvHint = {
    likelyStaticNoApi,
    applyMetaForApiFailure,
    upgradeDashboardBanner,
    applySupabaseNotConfigured,
    applyServerMisconfigured,
    setDashHintLine,
    showMeta
  };
})();
