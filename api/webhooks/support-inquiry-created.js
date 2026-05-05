/**
 * Supabase Database Webhook: public.support_inquiries INSERT → 어드민 이메일.
 * 보안: 요청 헤더 x-stylelog-webhook-secret 과 환경 변수 SUPPORT_INQUIRY_WEBHOOK_SECRET 일치 시만 처리.
 */
const crypto = require('crypto');

const {
  getHost,
  getSupabaseAdmin,
  sendJson,
  readJsonBody,
  buildSupabaseNotConfiguredBody
} = require('../_lib/admin-common.js');
const { emailsForUserIds } = require('../_lib/admin-user-emails.js');
const { sendAdminNewInquiryEmail } = require('../_lib/admin-inquiry-insert-email.js');

function envStr(name) {
  const v = process.env[name];
  if (v == null || typeof v !== 'string') return '';
  return v.trim();
}

function adminInquiryNotifyList() {
  const raw = envStr('ADMIN_INQUIRY_NOTIFY_EMAIL');
  if (!raw) return [];
  return [
    ...new Set(
      raw
        .split(/[,;]+/)
        .map((s) => s.trim().toLowerCase())
        .filter((s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s))
    )
  ];
}

function timingSafeEqualStr(a, b) {
  const aa = Buffer.from(String(a || ''), 'utf8');
  const bb = Buffer.from(String(b || ''), 'utf8');
  if (aa.length !== bb.length) return false;
  return crypto.timingSafeEqual(aa, bb);
}

function getHeader(req, name) {
  const k = String(name).toLowerCase();
  const h = req.headers;
  if (!h || typeof h !== 'object') return '';
  if (h[k]) return String(h[k]).trim();
  const raw = req.rawHeaders;
  if (Array.isArray(raw)) {
    for (let i = 0; i < raw.length; i += 2) {
      if (String(raw[i]).toLowerCase() === k) return String(raw[i + 1] || '').trim();
    }
  }
  return '';
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { ok: false, error: 'method_not_allowed' });
    return;
  }

  const expected = envStr('SUPPORT_INQUIRY_WEBHOOK_SECRET');
  if (!expected) {
    sendJson(res, 503, {
      ok: false,
      error: 'webhook_secret_not_configured',
      message: 'Vercel에 SUPPORT_INQUIRY_WEBHOOK_SECRET을 설정하세요.'
    });
    return;
  }

  const got = getHeader(req, 'x-stylelog-webhook-secret');
  if (!timingSafeEqualStr(got, expected)) {
    sendJson(res, 401, { ok: false, error: 'unauthorized' });
    return;
  }

  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    sendJson(res, 400, { ok: false, error: 'invalid_json' });
    return;
  }

  const t = body && body.type;
  const table = body && body.table;
  const schema = body && body.schema;
  const record = body && body.record;

  if (t !== 'INSERT' || table !== 'support_inquiries' || schema !== 'public' || !record) {
    sendJson(res, 200, { ok: true, ignored: true });
    return;
  }

  const userId = record.user_id;
  const title = record.title != null ? String(record.title) : '';
  const bodyText = record.body != null ? String(record.body) : '';

  const recipients = adminInquiryNotifyList();
  if (!recipients.length) {
    console.warn('support-inquiry webhook: ADMIN_INQUIRY_NOTIFY_EMAIL 비어 있음');
    sendJson(res, 200, { ok: true, skipped: 'no_admin_recipients' });
    return;
  }

  const host = getHost(req);
  const supabase = getSupabaseAdmin(host);
  if (!supabase) {
    sendJson(res, 503, buildSupabaseNotConfiguredBody(host));
    return;
  }

  let userEmail = '';
  if (userId && typeof userId === 'string') {
    const map = await emailsForUserIds(supabase, [userId]);
    const em = map.get(userId);
    if (em && em !== '—') userEmail = em;
  }

  try {
    const mailResult = await sendAdminNewInquiryEmail({
      to: recipients,
      title,
      bodyPreview: bodyText,
      userEmail
    });
    if (!mailResult.ok) {
      if (mailResult.skipped) {
        console.warn('support-inquiry webhook email skipped', mailResult.skipped);
        sendJson(res, 200, { ok: true, skipped: mailResult.skipped });
        return;
      }
      console.error('support-inquiry webhook email', mailResult.error);
      sendJson(res, 500, { ok: false, error: 'email_failed' });
      return;
    }
  } catch (e) {
    console.error('support-inquiry webhook', e);
    sendJson(res, 500, { ok: false, error: 'internal_error' });
    return;
  }

  sendJson(res, 200, { ok: true });
};
