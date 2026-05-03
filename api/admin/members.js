const {
  getHost,
  getSupabaseAdmin,
  requireSession,
  sendJson
} = require('../_lib/admin-common.js');

module.exports = async function handler(req, res) {
  const host = getHost(req);

  if (req.method !== 'GET') {
    sendJson(res, 405, { ok: false, error: 'method_not_allowed' });
    return;
  }

  try {
    requireSession(req, host);
  } catch (e) {
    if (e.code === 'UNAUTHORIZED') {
      sendJson(res, 401, { ok: false, error: 'unauthorized' });
      return;
    }
    sendJson(res, 503, { ok: false, error: 'server_misconfigured' });
    return;
  }

  const supabase = getSupabaseAdmin(host);
  if (!supabase) {
    sendJson(res, 503, { ok: false, error: 'supabase_not_configured' });
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
      sendJson(res, 500, { ok: false, error: 'auth_error', detail: error.message });
      return;
    }

    const users = data?.users || [];
    const counts = await Promise.all(
      users.map(async (u) => {
        const { count, error: cErr } = await supabase
          .from('style_logs')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', u.id);
        if (cErr) return 0;
        return count ?? 0;
      })
    );

    const items = users.map((u, i) => ({
      id: u.id,
      email: u.email || '—',
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at || null,
      style_log_count: counts[i] ?? 0
    }));

    sendJson(res, 200, {
      ok: true,
      page,
      perPage,
      items
    });
  } catch (e) {
    console.error('admin/members', e);
    sendJson(res, 500, { ok: false, error: 'internal_error' });
  }
};
