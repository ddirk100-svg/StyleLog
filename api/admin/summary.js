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

  try {
    const [
      openInq,
      totalInq,
      totalFb,
      usersPage
    ] = await Promise.all([
      supabase.from('support_inquiries').select('*', { count: 'exact', head: true }).eq('status', 'open'),
      supabase.from('support_inquiries').select('*', { count: 'exact', head: true }),
      supabase.from('user_feedback').select('*', { count: 'exact', head: true }),
      supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
    ]);

    const userCount =
      usersPage.error || !usersPage.data?.users
        ? null
        : usersPage.data.users.length;

    let membersTotal = userCount;
    let membersCapped = userCount === 1000;
    if (!usersPage.error && usersPage.data?.users) {
      const t = usersPage.data.total;
      if (typeof t === 'number' && t > 0) {
        membersTotal = t;
        membersCapped = usersPage.data.users.length >= 1000 && t > usersPage.data.users.length;
      }
    }

    sendJson(res, 200, {
      ok: true,
      inquiriesOpen: openInq.count ?? 0,
      inquiriesTotal: totalInq.count ?? 0,
      feedbackTotal: totalFb.count ?? 0,
      membersListed: membersTotal,
      membersCapped
    });
  } catch (e) {
    console.error('admin/summary', e);
    sendJson(res, 500, { ok: false, error: 'internal_error' });
  }
};
