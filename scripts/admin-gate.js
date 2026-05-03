/**
 * 관리자 전용 TOTP(구글 OTP) 세션. /api/admin/session 과 HttpOnly 쿠키 연동.
 */
(function () {
  const GATE_ID = 'admin-totp-gate';

  function isBrowserLoopback() {
    const h = location.hostname;
    return h === 'localhost' || h === '127.0.0.1' || h === '[::1]' || h === '::1';
  }

  function applyGateRootLayout(root) {
    // body.admin-app 은 flex 레이아웃이라, 예전 캐시된 admin.css(게이트 블록 없음)일 때
    // document.body 자식으로 두면 카드만 오른쪽 플렉스 아이템처럼 붙는다. html 붙임 + 인라인으로 뷰포트 전체 고정.
    root.style.position = 'fixed';
    root.style.inset = '0';
    root.style.zIndex = '10000';
    root.style.display = 'flex';
    root.style.alignItems = 'center';
    root.style.justifyContent = 'center';
    root.style.padding = '24px';
    root.style.boxSizing = 'border-box';
    root.style.background = 'rgba(15, 23, 42, 0.55)';
  }

  function ensureGateMarkup() {
    if (document.getElementById(GATE_ID)) return;
    const root = document.createElement('div');
    root.id = GATE_ID;
    root.className = 'admin-gate';
    root.hidden = true;
    applyGateRootLayout(root);
    root.innerHTML = [
      '<div class="admin-gate-card" role="dialog" aria-modal="true" aria-labelledby="admin-gate-title">',
      '  <h1 id="admin-gate-title" class="admin-gate-title">관리자 인증</h1>',
      '  <p class="admin-gate-desc">Google Authenticator 등 TOTP 앱에 표시된 6자리 코드를 입력하세요.</p>',
      '  <form class="admin-gate-form">',
      '    <input type="text" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="one-time-code" class="admin-gate-input" placeholder="000000" aria-label="일회용 6자리 코드" required>',
      '    <button type="submit" class="admin-btn admin-btn-primary admin-gate-submit">확인</button>',
      '  </form>',
      '  <p class="admin-gate-msg" role="status"></p>',
      '</div>'
    ].join('');
    document.documentElement.appendChild(root);
  }

  function showGate() {
    ensureGateMarkup();
    const root = document.getElementById(GATE_ID);
    root.hidden = false;
    root.classList.add('is-visible');
    document.body.classList.add('admin-gate-active');
  }

  function hideGate() {
    const root = document.getElementById(GATE_ID);
    if (root) {
      root.classList.remove('is-visible');
      root.hidden = true;
    }
    document.body.classList.remove('admin-gate-active');
  }

  function setMisconfigured(message) {
    ensureGateMarkup();
    const root = document.getElementById(GATE_ID);
    const card = root.querySelector('.admin-gate-card');
    const text =
      message ||
      'Vercel 환경 변수(ADMIN_TOTP_SECRET, ADMIN_SESSION_SECRET, Supabase 서비스 롤)를 확인하세요. docs/deploy-admin-subdomains.md 참고.';
    card.innerHTML = [
      '<h1 class="admin-gate-title">설정 필요</h1>',
      '<p class="admin-gate-desc">' + text + '</p>'
    ].join('');
    root.hidden = false;
    root.classList.add('is-visible');
    document.body.classList.add('admin-gate-active');
  }

  async function checkSession() {
    const loopback = isBrowserLoopback();
    try {
      const r = await fetch('/api/admin/session', { credentials: 'same-origin' });
      const data = await r.json().catch(() => ({}));
      if (r.status === 503) {
        const extra =
          Array.isArray(data.missing) && data.missing.length
            ? ' 서버가 읽지 못한 이름: ' + data.missing.join(', ') + '.'
            : '';
        return {
          type: 'misconfigured',
          message: (data.message || '') + extra
        };
      }
      if (r.ok && data.ok) return { type: 'ok' };
      if (r.status === 401) return { type: 'need_otp' };
      if (loopback) {
        return { type: 'local_static' };
      }
      return { type: 'need_otp' };
    } catch (e) {
      if (loopback) {
        return { type: 'local_static' };
      }
      return {
        type: 'misconfigured',
        message:
          'API에 연결할 수 없습니다. 로컬에서는 vercel dev 로 실행하거나 배포 URL에서 열어 주세요.'
      };
    }
  }

  async function main() {
    const result = await checkSession();
    if (result.type === 'ok' || result.type === 'local_static') {
      document.documentElement.classList.add('admin-authed');
      hideGate();
      document.dispatchEvent(new CustomEvent('admin:session-ok'));
      return;
    }
    if (result.type === 'misconfigured') {
      setMisconfigured(result.message);
      return;
    }

    showGate();
    const root = document.getElementById(GATE_ID);
    const form = root.querySelector('.admin-gate-form');
    const input = form.querySelector('.admin-gate-input');
    const msgEl = root.querySelector('.admin-gate-msg');
    input.focus();

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const code = (input.value || '').replace(/\s/g, '');
      msgEl.textContent = '';
      try {
        const res = await fetch('/api/admin/session', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code })
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.ok) {
          document.documentElement.classList.add('admin-authed');
          hideGate();
          document.dispatchEvent(new CustomEvent('admin:session-ok'));
          return;
        }
        msgEl.textContent =
          data.error === 'invalid_code'
            ? '코드가 올바르지 않습니다.'
            : '인증에 실패했습니다.';
      } catch {
        msgEl.textContent = '네트워크 오류입니다.';
      }
      input.select();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main);
  } else {
    main();
  }
})();
