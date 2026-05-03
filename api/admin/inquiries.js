const {
  getHost,
  getSupabaseAdmin,
  requireSession,
  sendJson,
  readJsonBody
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

  try {
    if (req.method === 'GET') {
      const { data: rows, error } = await supabase
        .from('support_inquiries')
        .select(
          'id,user_id,title,body,status,admin_reply,replied_at,admin_reply_updated_at,created_at'
        )
        .order('created_at', { ascending: false })
        .limit(300);

      if (error) {
        console.error('inquiries select', error);
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
      return;
    }

    if (req.method === 'PATCH') {
      const body = await readJsonBody(req);
      const id = body.id;
      const adminReply = body.admin_reply;
      const status = body.status;

      if (!id || typeof id !== 'string') {
        sendJson(res, 400, { ok: false, error: 'invalid_id' });
        return;
      }

      const patch = {};
      if (adminReply !== undefined) patch.admin_reply = adminReply;
      if (status !== undefined) {
        if (!['open', 'answered'].includes(status)) {
          sendJson(res, 400, { ok: false, error: 'invalid_status' });
          return;
        }
        patch.status = status;
      }

      if (Object.keys(patch).length === 0) {
        sendJson(res, 400, { ok: false, error: 'empty_patch' });
        return;
      }

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
        sendJson(res, 500, { ok: false, error: 'db_error', detail: error.message });
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
