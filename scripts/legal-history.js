/**
 * 약관·개인정보처리방침: legal/versions.json 기준 버전 드롭다운 + 스냅샷 HTML 로드.
 * 신규 개정: legal/terms|privacy/YYYY-MM-DD.html 추가 후 versions.json 배열 앞에 항목 추가.
 */
(function () {
  var docKind = document.body.getAttribute('data-legal-doc');
  if (!docKind || (docKind !== 'terms' && docKind !== 'privacy')) return;

  var selectEl = document.getElementById('legal-history-select');
  var bodyEl = document.getElementById('legal-body');
  if (!selectEl || !bodyEl) return;

  var manifestList = [];

  function siteRootBase() {
    var p = window.location.pathname || '/';
    return window.location.origin + p.replace(/[^/]+$/, '');
  }

  function pickRevFromUrl() {
    try {
      return (new URLSearchParams(window.location.search).get('rev') || '').trim();
    } catch {
      return '';
    }
  }

  function syncRevParam(selectedId, latestId) {
    try {
      var u = new URL(window.location.href);
      if (selectedId === latestId) {
        u.searchParams.delete('rev');
      } else {
        u.searchParams.set('rev', selectedId);
      }
      window.history.replaceState({}, '', u.pathname + u.search + u.hash);
    } catch {
      /* ignore */
    }
  }

  function renderEntry(entry) {
    if (!entry || !entry.path) return;

    var fragmentUrl = siteRootBase() + entry.path;
    bodyEl.innerHTML =
      '<p class="legal-load-placeholder text-gray-500 text-center py-12">본문을 불러오는 중…</p>';

    fetch(fragmentUrl, { credentials: 'same-origin', cache: 'no-cache' })
      .then(function (r) {
        if (!r.ok) throw new Error('load_failed');
        return r.text();
      })
      .then(function (html) {
        bodyEl.innerHTML = html;
      })
      .catch(function () {
        bodyEl.innerHTML =
          '<p class="legal-load-error text-red-600 text-center py-12" role="alert">본문을 불러오지 못했습니다. 네트워크를 확인하거나 잠시 후 다시 시도해 주세요.</p>';
      });
  }

  function selectIndexByRev(rev) {
    if (!rev) return -1;
    for (var i = 0; i < manifestList.length; i++) {
      if (manifestList[i].id === rev) return i;
    }
    return -1;
  }

  var manifestUrl = siteRootBase() + 'legal/versions.json';

  fetch(manifestUrl, { credentials: 'same-origin', cache: 'no-cache' })
    .then(function (r) {
      if (!r.ok) throw new Error('manifest');
      return r.json();
    })
    .then(function (manifest) {
      manifestList = manifest && Array.isArray(manifest[docKind]) ? manifest[docKind] : [];
      selectEl.innerHTML = '';

      if (!manifestList.length) {
        selectEl.hidden = true;
        bodyEl.innerHTML =
          '<p class="text-gray-600">등록된 개정 버전이 없습니다. 운영자에게 문의해 주세요.</p>';
        return;
      }

      manifestList.forEach(function (entry) {
        var opt = document.createElement('option');
        opt.value = entry.id;
        opt.textContent = entry.label || entry.id || entry.path;
        selectEl.appendChild(opt);
      });

      var req = pickRevFromUrl();
      var ix = selectIndexByRev(req);
      if (ix < 0) ix = 0;
      selectEl.selectedIndex = ix;

      var firstId = manifestList[0] && manifestList[0].id;
      renderEntry(manifestList[ix]);
      syncRevParam(manifestList[ix].id, firstId);

      selectEl.addEventListener('change', function () {
        var i = selectEl.selectedIndex;
        if (i < 0 || !manifestList[i]) return;
        renderEntry(manifestList[i]);
        syncRevParam(manifestList[i].id, firstId);
      });

      window.addEventListener('popstate', function () {
        var rev = pickRevFromUrl();
        var j = selectIndexByRev(rev);
        if (j < 0) j = 0;
        selectEl.selectedIndex = j;
        renderEntry(manifestList[j]);
      });
    })
    .catch(function () {
      selectEl.hidden = true;
      bodyEl.innerHTML =
        '<p class="legal-load-error text-red-600" role="alert">버전 목록을 불러오지 못했습니다.</p>';
    });
})();
