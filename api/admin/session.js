const {
  getHost,
  sessionSecretForHost,
  totpSecretForHost,
  createSignedSessionValue,
  getSessionFromRequest,
  setSessionCookie,
  clearSessionCookie,
  verifyTotpCode,
  sendJson,
  readJsonBody
} = require('../_lib/admin-common.js');

module.exports = async function handler(req, res) {
  const host = getHost(req);

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  try {
    if (req.method === 'GET') {
      if (!sessionSecretForHost(host) || !totpSecretForHost(host)) {
        sendJson(res, 503, {
          ok: false,
          error: 'server_misconfigured',
          message: 'ADMIN_TOTP_SECRET / ADMIN_SESSION_SECRET / Supabase 서비스 롤 키를 Vercel 환경 변수에 설정하세요.'
        });
        return;
      }
      const sess = getSessionFromRequest(req, host);
      if (sess) {
        sendJson(res, 200, { ok: true, authed: true });
      } else {
        sendJson(res, 401, { ok: false, authed: false });
      }
      return;
    }

    if (req.method === 'POST') {
      if (!sessionSecretForHost(host) || !totpSecretForHost(host)) {
        sendJson(res, 503, {
          ok: false,
          error: 'server_misconfigured'
        });
        return;
      }
      const body = await readJsonBody(req);
      const code = body.code || body.token;
      if (!verifyTotpCode(host, code)) {
        sendJson(res, 401, { ok: false, error: 'invalid_code' });
        return;
      }
      const sessionSecret = sessionSecretForHost(host);
      const token = createSignedSessionValue(sessionSecret);
      setSessionCookie(res, host, token);
      sendJson(res, 200, { ok: true });
      return;
    }

    if (req.method === 'DELETE') {
      clearSessionCookie(res);
      sendJson(res, 200, { ok: true });
      return;
    }

    sendJson(res, 405, { ok: false, error: 'method_not_allowed' });
  } catch (e) {
    console.error('admin/session', e);
    sendJson(res, 500, { ok: false, error: 'internal_error' });
  }
};
