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
      answeredInq,
      totalInq,
      totalFb,
      fbIdea,
      fbBug,
      fbOther,
      styleLogsTotal,
      usersPage,
      recentInqRows,
      recentFbRows
    ] = await Promise.all([
      supabase.from('support_inquiries').select('*', { count: 'exact', head: true }).eq('status', 'open'),
      supabase.from('support_inquiries').select('*', { count: 'exact', head: true }).eq('status', 'answered'),
      supabase.from('support_inquiries').select('*', { count: 'exact', head: true }),
      supabase.from('user_feedback').select('*', { count: 'exact', head: true }),
      supabase.from('user_feedback').select('*', { count: 'exact', head: true }).eq('category', 'idea'),
      supabase.from('user_feedback').select('*', { count: 'exact', head: true }).eq('category', 'bug'),
      supabase.from('user_feedback').select('*', { count: 'exact', head: true }).eq('category', 'other'),
      supabase.from('style_logs').select('*', { count: 'exact', head: true }),
      supabase.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      supabase
        .from('support_inquiries')
        .select('id,title,status,user_id,created_at')
        .order('created_at', { ascending: false })
        .limit(8),
      supabase
        .from('user_feedback')
        .select('id,title,category,user_id,created_at')
        .order('created_at', { ascending: false })
        .limit(8)
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

    const inqList = recentInqRows.error || !recentInqRows.data ? [] : recentInqRows.data;
    const fbList = recentFbRows.error || !recentFbRows.data ? [] : recentFbRows.data;
    const uidSet = new Set();
    inqList.forEach((r) => r.user_id && uidSet.add(r.user_id));
    fbList.forEach((r) => r.user_id && uidSet.add(r.user_id));
    const emailMap = new Map();
    await Promise.all(
      [...uidSet].map(async (uid) => {
        try {
          const { data, error } = await supabase.auth.admin.getUserById(uid);
          if (!error && data?.user?.email) emailMap.set(uid, data.user.email);
          else emailMap.set(uid, '—');
        } catch {
          emailMap.set(uid, '—');
        }
      })
    );

    const recentInquiries = inqList.map((r) => ({
      ...r,
      user_email: emailMap.get(r.user_id) || '—'
    }));
    const recentFeedback = fbList.map((r) => ({
      ...r,
      user_email: emailMap.get(r.user_id) || '—'
    }));

    sendJson(res, 200, {
      ok: true,
      inquiriesOpen: openInq.count ?? 0,
      inquiriesAnswered: answeredInq.count ?? 0,
      inquiriesTotal: totalInq.count ?? 0,
      feedbackTotal: totalFb.count ?? 0,
      feedbackIdea: fbIdea.count ?? 0,
      feedbackBug: fbBug.count ?? 0,
      feedbackOther: fbOther.count ?? 0,
      styleLogsTotal: styleLogsTotal.count ?? 0,
      membersListed: membersTotal,
      membersCapped,
      recentInquiries,
      recentFeedback
    });
  } catch (e) {
    console.error('admin/summary', e);
    sendJson(res, 500, { ok: false, error: 'internal_error' });
  }
};
