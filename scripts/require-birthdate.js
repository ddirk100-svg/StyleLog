/**
 * 기존 회원: user_metadata.birth_date(YYYY-MM-DD) 없으면 로그인 후 필수 입력 모달.
 * supabaseClient 전역 필요 (config.js 이후 로드).
 */
(function (global) {
  function dateToYMD(d) {
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }

  function getBirthLimits() {
    var now = new Date();
    var maxD = new Date(now.getFullYear() - 14, now.getMonth(), now.getDate());
    var minD = new Date(now.getFullYear() - 120, now.getMonth(), now.getDate());
    return { max: dateToYMD(maxD), min: dateToYMD(minD) };
  }

  function validateBirthRaw(birthRaw, maxAllowed, minAllowed) {
    if (!birthRaw || !/^\d{4}-\d{2}-\d{2}$/.test(birthRaw)) {
      return '생년월일을 선택해 주세요.';
    }
    if (birthRaw > maxAllowed) return '만 14세 미만은 이용할 수 없습니다.';
    if (birthRaw < minAllowed) return '생년월일을 다시 확인해 주세요.';
    return '';
  }

  /**
   * @param {import('@supabase/supabase-js').User | null | undefined} user
   */
  function needsBirth(user) {
    if (!user) return false;
    var b = user.user_metadata && user.user_metadata.birth_date;
    if (b == null || String(b).trim() === '') return true;
    var s = String(b).trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return true;
    var lim = getBirthLimits();
    if (s > lim.max || s < lim.min) return true;
    return false;
  }

  function ensureOverlay() {
    var el = document.getElementById('mandatory-birth-overlay');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'mandatory-birth-overlay';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-labelledby', 'mandatory-birth-title');
    el.innerHTML =
      '<div class="mandatory-birth-card">' +
      '<h2 id="mandatory-birth-title">생년월일 입력</h2>' +
      '<p>서비스 정책에 따라 생년월일이 필요합니다. 만 14세 이상만 이용할 수 있습니다.</p>' +
      '<label for="mandatory-birth-input">생년월일</label>' +
      '<input type="date" id="mandatory-birth-input" name="mandatory-birth" required autocomplete="bday" />' +
      '<p class="mandatory-birth-hint">입력 후 아래 버튼을 눌러야 계속 이용할 수 있습니다.</p>' +
      '<p id="mandatory-birth-error" class="mandatory-birth-error" hidden></p>' +
      '<button type="button" class="mandatory-birth-submit" id="mandatory-birth-submit">확인하고 계속</button>' +
      '</div>';
    document.body.appendChild(el);
    return el;
  }

  /**
   * @returns {Promise<void>}
   */
  function showModalAndSave() {
    if (typeof supabaseClient === 'undefined' || !supabaseClient) {
      return Promise.reject(new Error('supabase_not_ready'));
    }

    return new Promise(function (resolve, reject) {
      var overlay = ensureOverlay();
      var input = document.getElementById('mandatory-birth-input');
      var errEl = document.getElementById('mandatory-birth-error');
      var btn = document.getElementById('mandatory-birth-submit');
      var lim = getBirthLimits();

      input.max = lim.max;
      input.min = lim.min;
      input.value = '';
      errEl.textContent = '';
      errEl.hidden = true;

      overlay.classList.add('mandatory-birth-overlay--visible');
      document.body.classList.add('mandatory-birth-open');

      function onSubmit() {
        var raw = (input.value || '').trim();
        var lim2 = getBirthLimits();
        var msg = validateBirthRaw(raw, lim2.max, lim2.min);
        if (msg) {
          errEl.textContent = msg;
          errEl.hidden = false;
          return;
        }

        btn.disabled = true;
        supabaseClient.auth
          .updateUser({ data: { birth_date: raw } })
          .then(function (res) {
            if (res.error) throw res.error;
            overlay.classList.remove('mandatory-birth-overlay--visible');
            document.body.classList.remove('mandatory-birth-open');
            resolve();
          })
          .catch(function (e) {
            errEl.textContent =
              (e && e.message) ? String(e.message).slice(0, 120) : '저장에 실패했습니다. 잠시 후 다시 시도해 주세요.';
            errEl.hidden = false;
          })
          .finally(function () {
            btn.disabled = false;
          });
      }

      btn.onclick = onSubmit;
    });
  }

  global.RequireBirthdate = {
    getBirthLimits: getBirthLimits,
    needsBirth: needsBirth,
    showModalAndSave: showModalAndSave
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
