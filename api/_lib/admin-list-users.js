/**
 * auth.admin.listUsers() 는 Link 헤더(pagination) 파싱 중 예외를 던질 수 있음.
 * 관리자 회원 목록은 /auth/v1/admin/users REST만 사용해 본문 JSON만 처리한다.
 */
const { resolveSupabaseEnv } = require('./admin-common.js');

/**
 * @param {string} host
 * @param {number} page 1-based
 * @param {number} perPage
 * @returns {Promise<{ ok: true, users: object[], total: number | null } | { ok: false, error: { message: string, status?: number } }>}
 */
async function listAuthUsersPage(host, page, perPage) {
  const { url: base, key } = resolveSupabaseEnv(host);
  if (!base || !key) {
    return { ok: false, error: { message: 'Supabase URL or service role key missing' } };
  }

  const root = String(base).replace(/\/$/, '');
  const u = new URL(`${root}/auth/v1/admin/users`);
  u.searchParams.set('page', String(Math.max(1, page)));
  u.searchParams.set('per_page', String(Math.max(1, Math.min(1000, perPage))));

  let res;
  try {
    res = await fetch(u.toString(), {
      headers: {
        Authorization: `Bearer ${key}`,
        apikey: key
      }
    });
  } catch (e) {
    return { ok: false, error: { message: e && e.message ? String(e.message) : String(e) } };
  }

  const text = await res.text();
  let body = {};
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      return {
        ok: false,
        error: {
          message: `Auth API returned non-JSON (${res.status}): ${text.slice(0, 200)}`,
          status: res.status
        }
      };
    }
  }

  if (!res.ok) {
    const msg =
      (body && (body.message || body.msg || body.error_description || body.error)) ||
      `HTTP ${res.status}`;
    return { ok: false, error: { message: String(msg), status: res.status } };
  }

  const users = Array.isArray(body.users) ? body.users : [];
  const totalRaw = res.headers.get('x-total-count');
  let total = null;
  if (totalRaw != null && String(totalRaw).trim() !== '') {
    const n = parseInt(String(totalRaw), 10);
    if (Number.isFinite(n)) total = n;
  }

  return { ok: true, users, total };
}

module.exports = { listAuthUsersPage };
