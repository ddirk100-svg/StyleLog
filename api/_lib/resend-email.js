/**
 * Resend REST API 공통 발송.
 * 리얼: RESEND_FROM
 * 알파: Host에 alpha 포함 시 RESEND_FROM_ALPHA → 없으면 `(Alpha) StyleLog <RESEND_FROM과 동일 주소>`
 */

const { envStr } = require('./env.js');
const { normalizeRecipientList, EMAIL_RE } = require('./mail-text.js');

/** "Name <addr@>" 또는 단일 이메일에서 주소만 */
function extractEmailFromFromHeader(raw) {
  const s = String(raw || '').trim();
  const m = s.match(/<([^<>\s]+@[^<>\s]+)>/);
  if (m) return m[1].trim().toLowerCase();
  if (EMAIL_RE.test(s)) return s.toLowerCase();
  return '';
}

function defaultAlphaResendFrom() {
  const addr =
    extractEmailFromFromHeader(envStr('RESEND_FROM')) || 'noreply@stylelog.co.kr';
  return `(Alpha) StyleLog <${addr}>`;
}

/** alpha.stylelog.co.kr · *-git-alpha-*.vercel.app 등 */
function isAlphaMailHost(host) {
  const h = String(host || '').toLowerCase();
  return h.includes('alpha') || h.includes('-git-alpha-');
}

function resolveResendFrom(host) {
  if (isAlphaMailHost(host)) {
    const override = envStr('RESEND_FROM_ALPHA');
    if (override) return override;
    return defaultAlphaResendFrom();
  }
  return envStr('RESEND_FROM');
}

/** 알파: [StyleLog] → [(Alpha)StyleLog], [StyleLog 관리자] → [(Alpha)StyleLog 관리자] */
function formatSubjectForAlphaHost(host, subject) {
  const s = String(subject || '').trim();
  if (!s || !isAlphaMailHost(host)) return s;
  if (/^\[\(Alpha\)StyleLog\]/i.test(s)) return s;
  const m = s.match(/^\[StyleLog(\s+관리자)?\]\s*(.*)$/is);
  if (m) {
    const tail = m[2] != null ? m[2] : '';
    const branded = m[1] ? '[(Alpha)StyleLog 관리자]' : '[(Alpha)StyleLog]';
    return tail ? `${branded} ${tail}` : branded;
  }
  return s;
}

function isResendConfigured() {
  return Boolean(
    envStr('RESEND_API_KEY') &&
      (envStr('RESEND_FROM') || envStr('RESEND_FROM_ALPHA'))
  );
}

/**
 * @param {{ to: string|string[]; subject: string; text: string; html: string; replyTo?: string; host?: string }} opts
 * @returns {Promise<{ ok: boolean; skipped?: string; error?: string }>}
 */
async function sendResendEmail(opts) {
  const apiKey = envStr('RESEND_API_KEY');
  const from = resolveResendFrom(opts && opts.host);
  const subject = formatSubjectForAlphaHost(
    opts && opts.host,
    opts && opts.subject != null ? String(opts.subject).trim() : ''
  );
  const text = opts && opts.text != null ? String(opts.text) : '';
  const html = opts && opts.html != null ? String(opts.html) : '';

  if (!apiKey || !from) {
    return { ok: false, skipped: 'resend_not_configured' };
  }
  if (!subject) {
    return { ok: false, skipped: 'missing_subject' };
  }
  if (!text && !html) {
    return { ok: false, skipped: 'missing_body' };
  }

  const toList = normalizeRecipientList(opts && opts.to);
  if (!toList.length) {
    return { ok: false, skipped: 'invalid_recipient' };
  }

  const payload = {
    from,
    to: toList,
    subject
  };
  if (text) payload.text = text;
  if (html) payload.html = html;
  const replyTo = opts && opts.replyTo ? String(opts.replyTo).trim() : '';
  if (replyTo && EMAIL_RE.test(replyTo)) {
    payload.reply_to = replyTo;
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const raw = await res.text();
    if (!res.ok) {
      let detail = raw;
      try {
        const j = JSON.parse(raw);
        if (j && j.message) detail = j.message;
      } catch {
        /* keep raw */
      }
      return { ok: false, error: `resend_${res.status}: ${detail}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e && e.message) || 'fetch_failed' };
  }
}

module.exports = {
  sendResendEmail,
  isResendConfigured
};
