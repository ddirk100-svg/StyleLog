const {
  getHost,
  getSupabaseAdmin,
  requireSession,
  replyForRequireSessionError,
  sendJson,
  buildSupabaseNotConfiguredBody
} = require('../_lib/admin-common.js');
const { emailsForUserIds } = require('../_lib/admin-user-emails.js');
const {
  fetchInquiryCountsByReply,
  enrichRecentInquiriesAdminReply
} = require('../_lib/support-inquiries.js');

function normalizeDashboardSnapshot(raw) {
  const j = raw && typeof raw === 'object' ? raw : null;
  if (!j) return null;
  const ri = Array.isArray(j.recentInquiries) ? j.recentInquiries : [];
  const rf = Array.isArray(j.recentFeedback) ? j.recentFeedback : [];
  return {
    ok: true,
    inquiriesOpen: Number(j.inquiriesOpen ?? 0),
    inquiriesAnswered: Number(j.inquiriesAnswered ?? 0),
    inquiriesTotal: Number(j.inquiriesTotal ?? 0),
    feedbackTotal: Number(j.feedbackTotal ?? 0),
    feedbackIdea: Number(j.feedbackIdea ?? 0),
    feedbackBug: Number(j.feedbackBug ?? 0),
    feedbackOther: Number(j.feedbackOther ?? 0),
    styleLogsTotal: Number(j.styleLogsTotal ?? 0),
    membersListed: Number(j.membersTotal ?? 0),
    membersCapped: false,
    recentInquiries: ri,
    recentFeedback: rf
  };
}

async function tryDashboardSnapshot(supabase) {
  const { data, error } = await supabase.rpc('admin_dashboard_snapshot');
  if (error || data == null) {
    if (error) console.warn('admin_dashboard_snapshot (fallback)', error.message || error.code || '');
    return null;
  }
  let parsed = data;
  if (typeof data === 'string') {
    try {
      parsed = JSON.parse(data);
    } catch {
      return null;
    }
  }
  return normalizeDashboardSnapshot(parsed);
}

async function loadSummaryLegacy(supabase, inqCountsPre) {
  const inqCounts = inqCountsPre ?? (await fetchInquiryCountsByReply(supabase));
  const [
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
    supabase.from('support_inquiries').select('*', { count: 'exact', head: true }),
    supabase.from('user_feedback').select('*', { count: 'exact', head: true }),
    supabase.from('user_feedback').select('*', { count: 'exact', head: true }).eq('category', 'idea'),
    supabase.from('user_feedback').select('*', { count: 'exact', head: true }).eq('category', 'bug'),
    supabase.from('user_feedback').select('*', { count: 'exact', head: true }).eq('category', 'other'),
    supabase.from('style_logs').select('*', { count: 'exact', head: true }),
    supabase.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    supabase
      .from('support_inquiries')
      .select('id,title,status,user_id,created_at,admin_reply')
      .order('created_at', { ascending: false })
      .limit(8),
    supabase
      .from('user_feedback')
      .select('id,title,category,user_id,created_at')
      .order('created_at', { ascending: false })
      .limit(8)
  ]);

  const userCount =
    usersPage.error || !usersPage.data?.users ? null : usersPage.data.users.length;

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
  const emailMap = await emailsForUserIds(supabase, [...uidSet]);

  const recentInquiries = inqList.map((r) => ({
    ...r,
    user_email: emailMap.get(r.user_id) || '—'
  }));
  const recentFeedback = fbList.map((r) => ({
    ...r,
    user_email: emailMap.get(r.user_id) || '—'
  }));

  return {
    ok: true,
    inquiriesOpen: inqCounts.inquiriesOpen,
    inquiriesAnswered: inqCounts.inquiriesAnswered,
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
  };
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
    replyForRequireSessionError(res, host, e);
    return;
  }

  const supabase = getSupabaseAdmin(host);
  if (!supabase) {
    sendJson(res, 503, buildSupabaseNotConfiguredBody(host));
    return;
  }

  try {
    const countsPromise = fetchInquiryCountsByReply(supabase);
    const snap = await tryDashboardSnapshot(supabase);
    const inqCounts = await countsPromise;
    if (snap) {
      snap.inquiriesOpen = inqCounts.inquiriesOpen;
      snap.inquiriesAnswered = inqCounts.inquiriesAnswered;
      snap.recentInquiries = await enrichRecentInquiriesAdminReply(supabase, snap.recentInquiries);
      sendJson(res, 200, snap);
      return;
    }
    const legacy = await loadSummaryLegacy(supabase, inqCounts);
    legacy.recentInquiries = await enrichRecentInquiriesAdminReply(supabase, legacy.recentInquiries);
    sendJson(res, 200, legacy);
  } catch (e) {
    console.error('admin/summary', e);
    sendJson(res, 500, { ok: false, error: 'internal_error' });
  }
};
