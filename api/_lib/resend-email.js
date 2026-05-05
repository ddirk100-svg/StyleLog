/**
 * Resend REST API 공통 발송 (RESEND_API_KEY, RESEND_FROM).
 * 알파: 요청 Host 에 alpha 가 보이면 RESEND_FROM_ALPHA → 없으면 RESEND_FROM.
 */

function envStr(name) {
  const v = process.env[name];
  if (v == null || typeof v !== 'string') return '';
  return v.trim();
}

function firstEnvStr(...names) {
  for (const n of names) {
    const v = envStr(n);
    if (v) return v;
  }
  return '';
}

/** alpha.stylelog.co.kr · *-git-alpha-*.vercel.app 등 */
function isAlphaMailHost(host) {
  const h = String(host || '').toLowerCase();
  return h.includes('alpha') || h.includes('-git-alpha-');
}

function resolveResendFrom(host) {
  if (isAlphaMailHost(host)) {
    return firstEnvStr('RESEND_FROM_ALPHA', 'RESEND_FROM');
  }
  return envStr('RESEND_FROM');
}

function normalizeRecipients(to) {
  const list = (Array.isArray(to) ? to : [to])
    .map((t) => String(t || '').trim().toLowerCase())
    .filter((t) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t));
  return [...new Set(list)];
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
  const subject = opts && opts.subject != null ? String(opts.subject).trim() : '';
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

  const toList = normalizeRecipients(opts && opts.to);
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
  if (replyTo && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(replyTo)) {
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
