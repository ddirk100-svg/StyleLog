const {
  getHost,
  parseRequestUrl,
  getSupabaseAdmin,
  requireSession,
  replyForRequireSessionError,
  sendJson,
  buildSupabaseNotConfiguredBody,
  dbErrorHint
} = require('../_lib/admin-common.js');

function normalizeKpis(raw) {
  const j = raw && typeof raw === 'object' ? raw : null;
  if (!j) return null;
  return {
    ok: true,
    recentDays: Number(j.recentDays ?? 30),
    membersTotal: Number(j.membersTotal ?? 0),
    styleLogsTotal: Number(j.styleLogsTotal ?? 0),
    writersTotal: Number(j.writersTotal ?? 0),
    avgLogsPerMember: Number(j.avgLogsPerMember ?? 0),
    avgLogsPerWriter: Number(j.avgLogsPerWriter ?? 0),
    favoriteLogs: Number(j.favoriteLogs ?? 0),
    favoriteLogsPct: Number(j.favoriteLogsPct ?? 0),
    favoriteUsers: Number(j.favoriteUsers ?? 0),
    favoriteUsersPct: Number(j.favoriteUsersPct ?? 0),
    tpoLogs: Number(j.tpoLogs ?? 0),
    tpoLogsPct: j.tpoLogsPct == null ? null : Number(j.tpoLogsPct),
    itemsLogs: Number(j.itemsLogs ?? 0),
    itemsLogsPct: j.itemsLogsPct == null ? null : Number(j.itemsLogsPct),
    repeatWriters: Number(j.repeatWriters ?? 0),
    repeatWritersPct: Number(j.repeatWritersPct ?? 0),
    signupsRecent: Number(j.signupsRecent ?? 0),
    logsRecent: Number(j.logsRecent ?? 0),
    activeWritersRecent: Number(j.activeWritersRecent ?? 0),
    hasTpoColumn: Boolean(j.hasTpoColumn),
    hasItemsColumn: Boolean(j.hasItemsColumn)
  };
}

async function loadKpisLegacy(supabase, recentDays) {
  const since = new Date();
  since.setDate(since.getDate() - recentDays);
  const sinceIso = since.toISOString();

  const [usersPage, logsTotal, favLogs, logsRecent] = await Promise.all([
    supabase.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    supabase.from('style_logs').select('*', { count: 'exact', head: true }),
    supabase.from('style_logs').select('*', { count: 'exact', head: true }).eq('is_favorite', true),
    supabase
      .from('style_logs')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', sinceIso)
  ]);

  let membersTotal = 0;
  if (!usersPage.error && usersPage.data?.users) {
    const t = usersPage.data.total;
    membersTotal =
      typeof t === 'number' && t > 0 ? t : usersPage.data.users.length;
  }

  const styleLogsTotal = logsTotal.count ?? 0;
  const favoriteLogs = favLogs.count ?? 0;
  const logsRecentN = logsRecent.count ?? 0;

  let signupsRecent = 0;
  if (!usersPage.error && usersPage.data?.users) {
    signupsRecent = usersPage.data.users.filter((u) => {
      const c = u.created_at;
      return c && new Date(c).getTime() >= since.getTime();
    }).length;
    const t = usersPage.data.total;
    if (typeof t === 'number' && t > 1000 && signupsRecent === usersPage.data.users.length) {
      signupsRecent = null;
    }
  }

  const avgLogsPerMember =
    membersTotal > 0 ? Math.round((styleLogsTotal / membersTotal) * 100) / 100 : 0;

  return {
    ok: true,
    rpcMissing: true,
    recentDays,
    membersTotal,
    styleLogsTotal,
    writersTotal: null,
    avgLogsPerMember,
    avgLogsPerWriter: null,
    favoriteLogs,
    favoriteLogsPct:
      styleLogsTotal > 0 ? Math.round((1000 * favoriteLogs) / styleLogsTotal) / 10 : 0,
    favoriteUsers: null,
    favoriteUsersPct: null,
    tpoLogs: null,
    tpoLogsPct: null,
    itemsLogs: null,
    itemsLogsPct: null,
    repeatWriters: null,
    repeatWritersPct: null,
    signupsRecent: signupsRecent ?? null,
    logsRecent: logsRecentN,
    activeWritersRecent: null,
    hasTpoColumn: null,
    hasItemsColumn: null,
    hint:
      '전체 지표는 Supabase에서 docs/supabase/admin_product_kpis.sql 을 실행한 뒤 새로고침하세요.'
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

  const u = parseRequestUrl(req);
  let days = parseInt(String(u.searchParams.get('days') || '30'), 10);
  if (!Number.isFinite(days) || days < 1) days = 30;
  if (days > 365) days = 365;

  try {
    const { data, error } = await supabase.rpc('admin_product_kpis', { p_recent_days: days });
    if (error) {
      console.warn('admin_product_kpis', error.message || error.code || '');
      const legacy = await loadKpisLegacy(supabase, days);
      legacy.hint =
        dbErrorHint(error) ||
        legacy.hint;
      sendJson(res, 200, legacy);
      return;
    }

    let parsed = data;
    if (typeof data === 'string') {
      try {
        parsed = JSON.parse(data);
      } catch {
        const legacy = await loadKpisLegacy(supabase, days);
        legacy.hint = 'KPI 응답 파싱에 실패했습니다.';
        sendJson(res, 200, legacy);
        return;
      }
    }

    const normalized = normalizeKpis(parsed);
    if (!normalized) {
      sendJson(res, 200, await loadKpisLegacy(supabase, days));
      return;
    }

    sendJson(res, 200, normalized);
  } catch (e) {
    console.error('admin/kpis', e);
    sendJson(res, 500, { ok: false, error: 'internal_error' });
  }
};
