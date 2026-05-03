const {
  getHost,
  getSupabaseAdmin,
  requireSession,
  replyForRequireSessionError,
  sendJson,
  buildSupabaseNotConfiguredBody,
  dbErrorHint
} = require('../_lib/admin-common.js');
const { getStyleLogCountsByUserIds } = require('../_lib/style-log-counts.js');

module.exports = async function handler(req, res) {
  const host = getHost(req);

  if (req.method !== 'GET') {
    sendJson(res, 405, { ok: false, error: 'method_not_allowed' });
    return;
  }

  try {
    requireSession(req, host);
  } catch (e) {
    replyForRequireSessionError(res, host, e);
    return;
  }

  const supabase = getSupabaseAdmin(host);
  if (!supabase) {
    sendJson(res, 503, buildSupabaseNotConfiguredBody(host));
    return;
  }

  const url = new URL(req.url || '/', `http://${host}`);
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1);
  const perPage = Math.min(100, Math.max(10, parseInt(url.searchParams.get('perPage') || '40', 10) || 40));

  try {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage
    });

    if (error) {
      console.error('listUsers', error);
      sendJson(res, 500, {
        ok: false,
        error: 'auth_error',
        detail: error.message,
        hint: dbErrorHint(error) || 'SUPABASE_SERVICE_ROLE_KEY_DEV 가 테스트 프로젝트의 service_role 인지, URL(DEV)과 짝이 맞는지 확인하세요.'
      });
      return;
    }

    const users = data?.users || [];
    const countByUser = await getStyleLogCountsByUserIds(
      supabase,
      users.map((u) => u.id)
    );

    const items = users.map((u) => ({
      id: u.id,
      email: u.email || '—',
      phone: u.phone || null,
      created_at: u.created_at,
      updated_at: u.updated_at || null,
      last_sign_in_at: u.last_sign_in_at || null,
      email_confirmed_at: u.email_confirmed_at || null,
      banned_until: u.banned_until || null,
      style_log_count: countByUser.get(u.id) ?? 0
    }));

    const total = typeof data?.total === 'number' ? data.total : null;

    sendJson(res, 200, {
      ok: true,
      page,
      perPage,
      total,
      items
    });
  } catch (e) {
    console.error('admin/members', e);
    sendJson(res, 500, { ok: false, error: 'internal_error' });
  }
};
