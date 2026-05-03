const {
  getHost,
  parseRequestUrl,
  getSupabaseAdmin,
  requireSession,
  replyForRequireSessionError,
  sendJson,
  readJsonBody,
  buildSupabaseNotConfiguredBody,
  orIlikeClauses,
  parsePagedListQuery,
  dbErrorHint
} = require('../_lib/admin-common.js');
const { emailsForUserIds } = require('../_lib/admin-user-emails.js');
const { applyInquiryListFilterByReplyStatus } = require('../_lib/support-inquiries.js');

module.exports = async function handler(req, res) {
  const host = getHost(req);

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
    if (req.method === 'GET') {
      const url = parseRequestUrl(req);
      const { page, perPage, from, to } = parsePagedListQuery(url, host);
      const statusFilter = (url.searchParams.get('status') || 'all').trim();
      const qRaw = (url.searchParams.get('q') || '').trim();

      let query = supabase
        .from('support_inquiries')
        .select(
          'id,user_id,title,body,status,admin_reply,replied_at,admin_reply_updated_at,created_at',
          { count: 'exact' }
        );

      query = applyInquiryListFilterByReplyStatus(query, statusFilter);

      const orPart = orIlikeClauses(['title', 'body'], qRaw);
      if (orPart) query = query.or(orPart);

      const { data: rows, error, count } = await query
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) {
        console.error('inquiries select', error);
        sendJson(res, 500, {
          ok: false,
          error: 'db_error',
          detail: error.message,
          hint: dbErrorHint(error)
        });
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
      return;
    }

    if (req.method === 'PATCH') {
      const body = await readJsonBody(req);
      const id = body.id;
      const adminReply = body.admin_reply;

      if (!id || typeof id !== 'string') {
        sendJson(res, 400, { ok: false, error: 'invalid_id' });
        return;
      }
      if (adminReply === undefined) {
        sendJson(res, 400, { ok: false, error: 'admin_reply_required' });
        return;
      }

      const trimmed = String(adminReply).trim();
      const patch = {
        admin_reply: trimmed,
        status: trimmed.length > 0 ? 'answered' : 'open'
      };

      const { data, error } = await supabase
        .from('support_inquiries')
        .update(patch)
        .eq('id', id)
        .select(
          'id,user_id,title,body,status,admin_reply,replied_at,admin_reply_updated_at,created_at'
        )
        .maybeSingle();

      if (error) {
        console.error('inquiries patch', error);
        sendJson(res, 500, {
          ok: false,
          error: 'db_error',
          detail: error.message,
          hint: dbErrorHint(error)
        });
        return;
      }
      if (!data) {
        sendJson(res, 404, { ok: false, error: 'not_found' });
        return;
      }

      const emailMap = await emailsForUserIds(supabase, [data.user_id]);
      sendJson(res, 200, {
        ok: true,
        item: { ...data, user_email: emailMap.get(data.user_id) || '—' }
      });
      return;
    }

    sendJson(res, 405, { ok: false, error: 'method_not_allowed' });
  } catch (e) {
    console.error('admin/inquiries', e);
    sendJson(res, 500, { ok: false, error: 'internal_error' });
  }
};
