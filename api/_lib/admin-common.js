/**
 * 관리자 API 공통: 호스트·Vercel 환경에 맞춰 Supabase(서비스 롤)·TOTP·세션 쿠키
 */
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const { authenticator } = require('otplib');

const COOKIE_NAME = 'sl_admin_session';
const SESSION_MAX_MS = 10 * 60 * 60 * 1000; // 10h

/**
 * 클라이언트 scripts/config.js 의 DEV_CONFIG / PROD_CONFIG.SUPABASE_URL 과 동일(공개 값).
 * Vercel에 URL만 빠져 있을 때 어드민 API가 바로 죽지 않도록 서버 폴백.
 * 프로젝트를 옮겼다면 SUPABASE_URL_* 를 반드시 넣을 것.
 */
const DEFAULT_DEV_SUPABASE_URL = 'https://roeurruguzxipevppnko.supabase.co';
const DEFAULT_PROD_SUPABASE_URL = 'https://zymszibiwojzrtxhiesc.supabase.co';

/**
 * Dashboard 에서 복사한 값이 /rest/v1 · /auth/v1 등으로 끝나는 경우가 많음.
 * 그대로 두면 Auth 요청이 …/auth/v1/auth/v1/... 가 되어 "Invalid path specified in request URL" 이 난다.
 * @param {string} raw
 * @returns {string}
 */
function normalizeSupabaseProjectUrl(raw) {
  if (!raw || typeof raw !== 'string') return '';
  let s = raw.trim().replace(/\/+$/, '');
  const lower = s.toLowerCase();
  const suffixes = ['/rest/v1', '/auth/v1', '/storage/v1', '/functions/v1', '/realtime/v1'];
  for (const suf of suffixes) {
    if (lower.endsWith(suf)) {
      s = s.slice(0, s.length - suf.length).replace(/\/+$/, '');
      break;
    }
  }
  try {
    const u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
    if (!u.hostname) return raw.trim().replace(/\/+$/, '');
    return `${u.protocol}//${u.hostname}`;
  } catch {
    return raw.trim().replace(/\/+$/, '');
  }
}

function getHost(req) {
  const h = req.headers['x-forwarded-host'] || req.headers.host || '';
  return String(h).split(',')[0].trim().toLowerCase();
}

/**
 * req.url + Host 로 URL 파싱. Host 가 비면 Invalid URL(`http://`) 방지용 localhost 사용.
 * @param {import('http').IncomingMessage} req
 * @returns {URL}
 */
function parseRequestUrl(req) {
  const path = typeof req.url === 'string' && req.url ? req.url : '/';
  let authority = getHost(req);
  if (!authority) authority = 'localhost';
  const base = `http://${authority}`;
  try {
    if (path.startsWith('http://') || path.startsWith('https://')) return new URL(path);
    return new URL(path, base);
  } catch (e) {
    console.warn('parseRequestUrl', path, base, e && e.message);
    return new URL('/', 'http://localhost');
  }
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

function firstEnvStr(...names) {
  for (const n of names) {
    const v = envStr(n);
    if (v) return v;
  }
  return '';
}

/** admin.alpha.* 또는 alpha 브랜치 Vercel 프리뷰 호스트 → 리얼 URL/키와 섞지 않음 */
function usesStrictDevSupabase(host) {
  const h = String(host || '').toLowerCase();
  return h.includes('admin.alpha.') || h.includes('-git-alpha-');
}

/**
 * alpha·Preview·localhost: 테스트 DB 분기.
 * admin.alpha.* / *-git-alpha-*.vercel.app 은 SUPABASE_*_DEV 만 허용(코드 내 기본 DEV URL은 폴백).
 * 그 외(로컬·일반 Preview)는 공통 SUPABASE_URL 도 허용하나, 리얼로의 자동 폴백은 하지 않음.
 */
function resolveSupabaseEnv(host) {
  const test = useTestDatabase(host);

  if (!test) {
    const rawUrl =
      firstEnvStr('SUPABASE_URL_PROD', 'SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL') ||
      DEFAULT_PROD_SUPABASE_URL;
    const url = normalizeSupabaseProjectUrl(rawUrl);
    const key = firstEnvStr(
      'SUPABASE_SERVICE_ROLE_KEY_PROD',
      'SUPABASE_SERVICE_ROLE_PROD',
      'SUPABASE_SERVICE_ROLE_KEY',
      'SUPABASE_SERVICE_ROLE'
    );
    return { url, key, test: false };
  }

  const strict = usesStrictDevSupabase(host);

  const rawDev = strict
    ? firstEnvStr('SUPABASE_URL_DEV') || DEFAULT_DEV_SUPABASE_URL
    : firstEnvStr('SUPABASE_URL_DEV', 'SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL') ||
      DEFAULT_DEV_SUPABASE_URL;

  const devUrl = normalizeSupabaseProjectUrl(rawDev);

  const devKey = strict
    ? firstEnvStr('SUPABASE_SERVICE_ROLE_KEY_DEV', 'SUPABASE_SERVICE_ROLE_DEV')
    : firstEnvStr(
        'SUPABASE_SERVICE_ROLE_KEY_DEV',
        'SUPABASE_SERVICE_ROLE_DEV',
        'SUPABASE_SERVICE_ROLE_KEY',
        'SUPABASE_SERVICE_ROLE'
      );

  if (devKey) {
    return { url: devUrl, key: devKey, test: true };
  }

  return { url: devUrl, key: '', test: true };
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
      test ? 'SUPABASE_URL_DEV (admin.alpha·alpha 프리뷰는 공통 SUPABASE_URL 미사용)' : 'SUPABASE_URL_PROD 또는 SUPABASE_URL'
    );
  }
  if (!key) {
    missing.push(
      test
        ? 'SUPABASE_SERVICE_ROLE_KEY_DEV (admin.alpha / alpha 프리뷰는 리얼 키로 폴백하지 않음)'
        : 'SUPABASE_SERVICE_ROLE_KEY_PROD 또는 SUPABASE_SERVICE_ROLE_KEY(또는 SUPABASE_SERVICE_ROLE)'
    );
  }
  return {
    ok: false,
    error: 'supabase_not_configured',
    usesTestDb: test,
    missing,
    message: test
      ? '테스트 DB: Vercel에 SUPABASE_URL_DEV·SUPABASE_SERVICE_ROLE_KEY_DEV를 넣으세요. admin.alpha / alpha 브랜치 배포는 리얼 변수(SUPABASE_SERVICE_ROLE_KEY_PROD 등)로 자동 연결되지 않습니다.'
      : '리얼 관리자: Vercel Production에 Supabase service_role 키가 필요합니다. SUPABASE_SERVICE_ROLE_KEY_PROD·SUPABASE_SERVICE_ROLE_KEY·SUPABASE_SERVICE_ROLE 등. 프로젝트 URL은 비어 있으면 앱과 동일한 프로덕션 URL을 씁니다(다른 프로젝트면 SUPABASE_URL_PROD를 넣으세요).'
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

/** PostgREST ilike 검색문: % _ \ 와 쉼표 왜곡 완화 */
function escapeForIlike(qRaw) {
  if (!qRaw || typeof qRaw !== 'string') return '';
  return qRaw.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_').replace(/,/g, ' ');
}

/**
 * PostgREST or=(col.ilike.…) 용: 패턴을 큰따옴표로 감싸 %·특수문자 파싱 오류 방지
 * @param {string[]} columns
 * @param {string} qRaw
 * @returns {string|null}
 */
function orIlikeClauses(columns, qRaw) {
  if (!qRaw || typeof qRaw !== 'string' || !columns.length) return null;
  const trimmed = qRaw.trim();
  if (!trimmed) return null;
  const safe = escapeForIlike(trimmed);
  const pat = `%${safe}%`;
  const quoted = `"${pat.replace(/\\/g, '\\\\').replace(/"/g, '""')}"`;
  return columns.map((c) => `${c}.ilike.${quoted}`).join(',');
}

/**
 * 공통 페이지 목록 쿼리 (?page &perPage)
 * @param {URL|string} url
 * @param {string} host
 * @param {{ defaultPerPage?: number, minPerPage?: number, maxPerPage?: number }} [opts]
 */
function parsePagedListQuery(url, host, opts) {
  const safeHost = host && String(host).trim() ? String(host).trim() : 'localhost';
  const u = url instanceof URL ? url : new URL(String(url || '/'), `http://${safeHost}`);
  const defPer = opts?.defaultPerPage ?? 25;
  const minP = opts?.minPerPage ?? 5;
  const maxP = opts?.maxPerPage ?? 100;
  const page = Math.max(1, parseInt(u.searchParams.get('page') || '1', 10) || 1);
  const perPage = Math.min(
    maxP,
    Math.max(minP, parseInt(u.searchParams.get('perPage') || String(defPer), 10) || defPer)
  );
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;
  return { page, perPage, from, to };
}

/** requireSession catch 블록용 — 401 / 503 본문 통일 */
function replyForRequireSessionError(res, host, err) {
  if (err && err.code === 'UNAUTHORIZED') {
    sendJson(res, 401, { ok: false, error: 'unauthorized' });
    return;
  }
  if (err && err.code === 'NO_SESSION_SECRET') {
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

/** PostgREST / 테이블 없음 등 — API JSON에 넣을 안내 문구 */
function dbErrorHint(err) {
  const msg = `${err?.message || ''} ${err?.details || err?.hint || ''}`.toLowerCase();
  if (!msg.trim()) return '';
  if (
    msg.includes('does not exist') ||
    msg.includes('schema cache') ||
    msg.includes('could not find the table') ||
    msg.includes('unknown json') ||
    msg.includes('permission denied')
  ) {
    return '테스트 Supabase에 테이블·함수가 없을 수 있습니다. docs/supabase 의 support_inquiries.sql, user_feedback.sql 실행 후 admin_emails_and_dashboard_snapshot.sql, style_log_counts_for_users.sql 을 같은 프로젝트에서 실행했는지 확인하세요. style_logs 는 앱과 동일한 스키마가 필요합니다.';
  }
  return '';
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
  parseRequestUrl,
  hostnameOnly,
  useTestDatabase,
  resolveSupabaseEnv,
  getSupabaseAdmin,
  buildSupabaseNotConfiguredBody,
  escapeForIlike,
  orIlikeClauses,
  parsePagedListQuery,
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
  dbErrorHint,
  sendJson,
  readJsonBody
};
