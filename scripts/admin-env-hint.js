/**
 * Live Server(:5500 등)처럼 /api 가 없을 때 안내 문구.
 * admin HTML 에서 admin-shell 다음, 페이지 스크립트 전에 로드하세요.
 */
(function () {
  const META_STATIC =
    '이 주소에는 관리자 API가 없습니다. 터미널에서 프로젝트 루트로 이동한 뒤 npm run dev → 표시된 http://localhost:포트/admin/index.html 로 다시 여세요. (:5500은 Live Server입니다.)';
  const META_GENERIC = 'API 또는 인증·환경 변수를 확인하세요.';

  function likelyStaticNoApi(httpStatus) {
    if (httpStatus === 404) return true;
    const p = String(typeof location !== 'undefined' ? location.port || '' : '');
    return p === '5500' || p === '5501';
  }

  function applyMetaForApiFailure(metaEl, httpStatus) {
    if (!metaEl) return;
    metaEl.textContent = likelyStaticNoApi(httpStatus) ? META_STATIC : META_GENERIC;
  }

  function upgradeDashboardBanner(bannerEl, httpStatus) {
    if (!bannerEl || !likelyStaticNoApi(httpStatus)) return;
    bannerEl.classList.add('admin-banner--warn');
    bannerEl.innerHTML =
      '<strong>지금 주소로는 데이터를 불러올 수 없습니다.</strong> ' +
      '<code style="font-size:12px">VS Code Live Server</code>(보통 <code style="font-size:12px">:5500</code>)는 ' +
      '<code style="font-size:12px">/api/admin</code> 경로가 없어 404가 납니다. ' +
      '저장소 루트에서 <code style="font-size:12px">npm install</code> 후 <code style="font-size:12px">npm run dev</code>를 실행하고, ' +
      '터미널에 나온 <code style="font-size:12px">localhost</code> 주소(예: <code style="font-size:12px">:3000</code>)로 ' +
      '<code style="font-size:12px">/admin/index.html</code>을 여세요. ' +
      'Supabase·<code style="font-size:12px">.env.local</code>는 docs/deploy-admin-subdomains.md 를 참고하세요.';
  }

  function applySupabaseNotConfigured(metaEl, bannerEl, payload) {
    if (!payload || payload.error !== 'supabase_not_configured') return;
    const missing = Array.isArray(payload.missing) ? payload.missing.join(', ') : '';
    const base = payload.message || 'Supabase URL·서비스 롤 키가 이 배포에 없습니다.';
    if (metaEl) metaEl.textContent = missing ? base + ' (' + missing + ')' : base;
    if (bannerEl) {
      bannerEl.classList.add('admin-banner--warn');
      bannerEl.replaceChildren();
      const strong = document.createElement('strong');
      strong.textContent = 'Supabase 환경 변수';
      bannerEl.appendChild(strong);
      bannerEl.appendChild(document.createTextNode(' ' + base + ' '));
      if (missing) {
        bannerEl.appendChild(document.createTextNode('변수: ' + missing + '. '));
      }
      const ref = document.createElement('span');
      ref.style.fontSize = '12px';
      ref.textContent = 'docs/deploy-admin-subdomains.md';
      bannerEl.appendChild(ref);
    }
  }

  globalThis.AdminEnvHint = {
    likelyStaticNoApi,
    applyMetaForApiFailure,
    upgradeDashboardBanner,
    applySupabaseNotConfigured
  };
})();
