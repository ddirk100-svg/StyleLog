const {
  getHost,
  getSupabaseAdmin,
  requireSession,
  replyForRequireSessionError,
  sendJson,
  buildSupabaseNotConfiguredBody,
  orIlikeClauses,
  parsePagedListQuery
} = require('../_lib/admin-common.js');
const { emailsForUserIds } = require('../_lib/admin-user-emails.js');

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

  try {
    const url = new URL(req.url || '/', `http://${host}`);
    const { page, perPage, from, to } = parsePagedListQuery(url, host);
    const qRaw = (url.searchParams.get('q') || '').trim();

    let query = supabase
      .from('user_feedback')
      .select('id,user_id,category,title,body,created_at', { count: 'exact' });

    const orPart = orIlikeClauses(['title', 'body', 'category'], qRaw);
    if (orPart) query = query.or(orPart);

    const { data: rows, error, count } = await query
      .order('created_at', { ascending: false })
      .range(from, to);

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

    const total = typeof count === 'number' ? count : 0;
    sendJson(res, 200, { ok: true, page, perPage, total, items: list });
  } catch (e) {
    console.error('admin/feedback', e);
    sendJson(res, 500, { ok: false, error: 'internal_error' });
  }
};
