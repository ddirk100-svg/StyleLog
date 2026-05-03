const {
  getHost,
  isAdminDevOtpBypass,
  sessionSecretForHost,
  totpSecretForHost,
  listMissingAdminAuthEnv,
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
      if (
        !isAdminDevOtpBypass(host) &&
        (!sessionSecretForHost(host) || !totpSecretForHost(host))
      ) {
        const missing = listMissingAdminAuthEnv(host);
        sendJson(res, 503, {
          ok: false,
          error: 'server_misconfigured',
          missing,
          vercelEnv: process.env.VERCEL_ENV || '',
          message:
            '이 배포에서 다음 환경 변수를 읽지 못했습니다: ' +
            missing.join(', ') +
            '. Vercel 이름·값·적용 환경(Production/Preview)을 확인한 뒤 Redeploy 하세요. (OTP 단계는 Supabase 불필요)'
        });
        return;
      }
      const sess = getSessionFromRequest(req, host);
      if (sess) {
        sendJson(res, 200, {
          ok: true,
          authed: true,
          devBypass: Boolean(sess.devBypass)
        });
      } else {
        sendJson(res, 401, { ok: false, authed: false });
      }
      return;
    }

    if (req.method === 'POST') {
      if (
        !isAdminDevOtpBypass(host) &&
        (!sessionSecretForHost(host) || !totpSecretForHost(host))
      ) {
        sendJson(res, 503, {
          ok: false,
          error: 'server_misconfigured',
          missing: listMissingAdminAuthEnv(host)
        });
        return;
      }
      if (isAdminDevOtpBypass(host)) {
        sendJson(res, 200, { ok: true, devBypass: true });
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
