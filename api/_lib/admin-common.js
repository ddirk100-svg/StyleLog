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

/** 호스트명만 (포트 제거). IPv4 루프백·localhost 판별용 */
function hostnameOnly(host) {
  if (!host) return '';
  const h = String(host).toLowerCase();
  if (h.startsWith('[')) return h.split(']')[0] + ']';
  return h.split(':')[0];
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

function envStr(name) {
  const v = process.env[name];
  if (v == null || typeof v !== 'string') return '';
  const t = v.trim();
  return t;
}

/** alpha·Preview·localhost → DEV 또는 공통 SUPABASE_* (PROD 접미사 키는 쓰지 않음) */
function resolveSupabaseEnv(host) {
  const test = useTestDatabase(host);
  const url = test
    ? envStr('SUPABASE_URL_DEV') || envStr('SUPABASE_URL')
    : envStr('SUPABASE_URL_PROD') || envStr('SUPABASE_URL');
  const key = test
    ? envStr('SUPABASE_SERVICE_ROLE_KEY_DEV') || envStr('SUPABASE_SERVICE_ROLE_KEY')
    : envStr('SUPABASE_SERVICE_ROLE_KEY_PROD') || envStr('SUPABASE_SERVICE_ROLE_KEY');
  return { url, key, test };
}

function getSupabaseAdmin(host) {
  const { url, key } = resolveSupabaseEnv(host);
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

/** API 503 JSON — 클라이언트 안내용 (비밀 값 없음) */
function buildSupabaseNotConfiguredBody(host) {
  const { url, key, test } = resolveSupabaseEnv(host);
  const missing = [];
  if (!url) {
    missing.push(
      test ? 'SUPABASE_URL_DEV 또는 SUPABASE_URL' : 'SUPABASE_URL_PROD 또는 SUPABASE_URL'
    );
  }
  if (!key) {
    missing.push(
      test
        ? 'SUPABASE_SERVICE_ROLE_KEY_DEV 또는 SUPABASE_SERVICE_ROLE_KEY'
        : 'SUPABASE_SERVICE_ROLE_KEY_PROD 또는 SUPABASE_SERVICE_ROLE_KEY'
    );
  }
  return {
    ok: false,
    error: 'supabase_not_configured',
    usesTestDb: test,
    missing,
    message: test
      ? 'admin.alpha·Preview·localhost는「테스트 DB」설정을 씁니다. SUPABASE_URL_DEV·SERVICE_ROLE_KEY_DEV를 넣거나, 한 프로젝트만 쓰면 SUPABASE_URL·SUPABASE_SERVICE_ROLE_KEY를 넣으세요. _PROD만 있으면 alpha에서 비어 있습니다. alpha 브랜치 배포에는 Vercel에서 Preview(또는 해당 환경)에도 변수를 넣어야 합니다.'
      : '리얼 관리자는 SUPABASE_URL_PROD·SUPABASE_SERVICE_ROLE_KEY_PROD(또는 공통 SUPABASE_URL·SERVICE_ROLE)가 필요합니다.'
  };
}

/**
 * 로컬 전용 OTP 생략 (.env.local → ADMIN_DEV_OTP_BYPASS=1).
 * vercel dev 는 종종 VERCEL_ENV=preview 로 잡혀 기존 preview 차단 로직과 충돌했음 →
 * 요청 Host 가 루프백일 때만 우회 (실제 배포 도메인 요청과는 절대 겹치지 않음).
 */
function isAdminDevOtpBypass(host) {
  if (envStr('ADMIN_DEV_OTP_BYPASS') !== '1') return false;
  const name = hostnameOnly(host);
  return name === 'localhost' || name === '127.0.0.1' || name === '::1';
}

function totpSecretForHost(host) {
  const test = useTestDatabase(host);
  if (test) {
    return envStr('ADMIN_TOTP_SECRET_PREVIEW') || envStr('ADMIN_TOTP_SECRET');
  }
  return envStr('ADMIN_TOTP_SECRET');
}

function sessionSecretForHost(host) {
  const test = useTestDatabase(host);
  if (test) {
    return envStr('ADMIN_SESSION_SECRET_PREVIEW') || envStr('ADMIN_SESSION_SECRET');
  }
  return envStr('ADMIN_SESSION_SECRET');
}

/** OTP 게이트용: 서버가 읽지 못한 변수 이름 (값 노출 없음) */
function listMissingAdminAuthEnv(host) {
  const missing = [];
  if (!totpSecretForHost(host)) missing.push('ADMIN_TOTP_SECRET');
  if (!sessionSecretForHost(host)) missing.push('ADMIN_SESSION_SECRET');
  return missing;
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
  if (isAdminDevOtpBypass(host)) return { ok: true, devBypass: true };
  const secret = sessionSecretForHost(host);
  if (!secret) return null;
  const cookies = parseCookies(req.headers.cookie || '');
  const token = cookies[COOKIE_NAME];
  return readSessionPayload(token, secret) ? { ok: true } : null;
}

function requireSession(req, host) {
  if (isAdminDevOtpBypass(host)) {
    return { exp: Date.now() + SESSION_MAX_MS, v: 1, devBypass: true };
  }
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

/** requireSession catch 블록용 — 401 / 503 본문 통일 */
function replyForRequireSessionError(res, host, err) {
  if (err && err.code === 'UNAUTHORIZED') {
    sendJson(res, 401, { ok: false, error: 'unauthorized' });
    return;
  }
  if (err.code === 'NO_SESSION_SECRET') {
    const missing = listMissingAdminAuthEnv(host);
    sendJson(res, 503, {
      ok: false,
      error: 'server_misconfigured',
      missing,
      vercelEnv: process.env.VERCEL_ENV || '',
      message:
        '세션·OTP용 환경 변수가 없습니다: ' +
        missing.join(', ') +
        '. Vercel 이름·적용 환경(Production/Preview)을 확인한 뒤 Redeploy 하세요.'
    });
    return;
  }
  sendJson(res, 503, { ok: false, error: 'server_misconfigured' });
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
  hostnameOnly,
  useTestDatabase,
  resolveSupabaseEnv,
  getSupabaseAdmin,
  buildSupabaseNotConfiguredBody,
  isAdminDevOtpBypass,
  totpSecretForHost,
  sessionSecretForHost,
  listMissingAdminAuthEnv,
  createSignedSessionValue,
  getSessionFromRequest,
  requireSession,
  replyForRequireSessionError,
  setSessionCookie,
  clearSessionCookie,
  verifyTotpCode,
  sendJson,
  readJsonBody
};
