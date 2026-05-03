/**
 * 관리자 API 공통: 호스트·Vercel 환경에 맞춰 Supabase(서비스 롤)·TOTP·세션 쿠키
 */
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const { authenticator } = require('otplib');

const COOKIE_NAME = 'sl_admin_session';
const SESSION_MAX_MS = 10 * 60 * 60 * 1000; // 10h

function getHost(req) {
  const h = req.headers['x-forwarded-host'] || req.headers.host || '';
  return String(h).split(',')[0].trim().toLowerCase();
}

/** config.js 와 같이 alpha 호스트 → 테스트 DB */
function isAlphaHost(host) {
  return (
    host.includes('alpha') ||
    host.includes('-git-alpha-') ||
    host.startsWith('localhost') ||
    host.startsWith('127.0.0.1')
  );
}

function isPreviewDeploy() {
  return process.env.VERCEL_ENV === 'preview' || process.env.VERCEL_ENV === 'development';
}

function useTestDatabase(host) {
  return isAlphaHost(host) || isPreviewDeploy();
}

function supabaseCredentials(host) {
  const test = useTestDatabase(host);
  const url = test
    ? process.env.SUPABASE_URL_DEV || process.env.SUPABASE_URL || ''
    : process.env.SUPABASE_URL_PROD || process.env.SUPABASE_URL || '';
  const key = test
    ? process.env.SUPABASE_SERVICE_ROLE_KEY_DEV || process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    : process.env.SUPABASE_SERVICE_ROLE_KEY_PROD || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  return { url, key, test };
}

function getSupabaseAdmin(host) {
  const { url, key } = supabaseCredentials(host);
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

function totpSecretForHost(host) {
  const test = useTestDatabase(host);
  if (test) {
    return (
      process.env.ADMIN_TOTP_SECRET_PREVIEW ||
      process.env.ADMIN_TOTP_SECRET ||
      ''
    );
  }
  return process.env.ADMIN_TOTP_SECRET || '';
}

function sessionSecretForHost(host) {
  const test = useTestDatabase(host);
  if (test) {
    return (
      process.env.ADMIN_SESSION_SECRET_PREVIEW ||
      process.env.ADMIN_SESSION_SECRET ||
      ''
    );
  }
  return process.env.ADMIN_SESSION_SECRET || '';
}

function timingSafeEqual(a, b) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

function createSignedSessionValue(sessionSecret) {
  const exp = Date.now() + SESSION_MAX_MS;
  const payload = Buffer.from(JSON.stringify({ exp, v: 1 }), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', sessionSecret).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function parseCookies(header) {
  const out = {};
  if (!header || typeof header !== 'string') return out;
  header.split(';').forEach((part) => {
    const idx = part.indexOf('=');
    if (idx === -1) return;
    const k = part.slice(0, idx).trim();
    const v = decodeURIComponent(part.slice(idx + 1).trim());
    out[k] = v;
  });
  return out;
}

function readSessionPayload(rawToken, sessionSecret) {
  if (!rawToken || !sessionSecret) return null;
  const dot = rawToken.indexOf('.');
  if (dot === -1) return null;
  const payload = rawToken.slice(0, dot);
  const sig = rawToken.slice(dot + 1);
  const expected = crypto.createHmac('sha256', sessionSecret).update(payload).digest('base64url');
  if (!timingSafeEqual(sig, expected)) return null;
  let data;
  try {
    data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (!data || data.v !== 1 || typeof data.exp !== 'number') return null;
  if (data.exp < Date.now()) return null;
  return data;
}

function getSessionFromRequest(req, host) {
  const secret = sessionSecretForHost(host);
  if (!secret) return null;
  const cookies = parseCookies(req.headers.cookie || '');
  const token = cookies[COOKIE_NAME];
  return readSessionPayload(token, secret) ? { ok: true } : null;
}

function requireSession(req, host) {
  const secret = sessionSecretForHost(host);
  if (!secret) {
    const err = new Error('ADMIN_SESSION_SECRET not configured');
    err.code = 'NO_SESSION_SECRET';
    throw err;
  }
  const cookies = parseCookies(req.headers.cookie || '');
  const token = cookies[COOKIE_NAME];
  const payload = readSessionPayload(token, secret);
  if (!payload) {
    const err = new Error('Unauthorized');
    err.code = 'UNAUTHORIZED';
    throw err;
  }
  return payload;
}

function setSessionCookie(res, host, value) {
  const secure = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${Math.floor(SESSION_MAX_MS / 1000)}`
  ];
  if (secure) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

function clearSessionCookie(res) {
  const secure = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';
  const parts = [`${COOKIE_NAME}=`, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0'];
  if (secure) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

function normalizeTotpSecret(raw) {
  if (!raw || typeof raw !== 'string') return '';
  // 공백·개행 제거, padding·소문자 정리 (Authenticator / Vercel 복붙 오차 대비)
  let s = raw.replace(/\s+/g, '').replace(/=/g, '').toUpperCase();
  // 실수로 따옴표까지 붙은 경우
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1);
  }
  return s;
}

function verifyTotpCode(host, code) {
  const secret = normalizeTotpSecret(totpSecretForHost(host));
  if (!secret) return false;
  const normalized = String(code || '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(normalized)) return false;
  // window 2 ≈ 전후 2스텝(약 ±90초~) — 폰/서버 시각 어긋남 완화
  authenticator.options = { window: 2 };
  return authenticator.verify({ token: normalized, secret });
}

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) {
        reject(new Error('payload too large'));
      }
    });
    req.on('end', () => {
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

module.exports = {
  COOKIE_NAME,
  getHost,
  useTestDatabase,
  getSupabaseAdmin,
  totpSecretForHost,
  sessionSecretForHost,
  createSignedSessionValue,
  getSessionFromRequest,
  requireSession,
  setSessionCookie,
  clearSessionCookie,
  verifyTotpCode,
  sendJson,
  readJsonBody
};
