const {
  getHost,
  getSupabaseAdmin,
  requireSession,
  sendJson,
  buildSupabaseNotConfiguredBody
} = require('../_lib/admin-common.js');

async function emailsForUserIds(supabase, ids) {
  const unique = [...new Set(ids.filter(Boolean))];
  const map = new Map();
  await Promise.all(
    unique.map(async (id) => {
      try {
        const { data, error } = await supabase.auth.admin.getUserById(id);
        if (!error && data?.user?.email) map.set(id, data.user.email);
        else map.set(id, '—');
      } catch {
        map.set(id, '—');
      }
    })
  );
  return map;
}

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
    sendJson(res, 503, buildSupabaseNotConfiguredBody(host));
    return;
  }

  try {
    const { data: rows, error } = await supabase
      .from('user_feedback')
      .select('id,user_id,category,title,body,created_at')
      .order('created_at', { ascending: false })
      .limit(300);

    if (error) {
      console.error('feedback select', error);
      sendJson(res, 500, { ok: false, error: 'db_error', detail: error.message });
      return;
    }

    const ids = (rows || []).map((r) => r.user_id);
    const emailMap = await emailsForUserIds(supabase, ids);
    const list = (rows || []).map((r) => ({
      ...r,
      user_email: emailMap.get(r.user_id) || '—'
    }));

    sendJson(res, 200, { ok: true, items: list });
  } catch (e) {
    console.error('admin/feedback', e);
    sendJson(res, 500, { ok: false, error: 'internal_error' });
  }
};
