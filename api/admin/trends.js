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

const VALID_RANGES = new Set(['1m', '3m', '6m', '1y', 'all']);

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
  let range = String(u.searchParams.get('range') || '6m').toLowerCase();
  if (!VALID_RANGES.has(range)) {
    sendJson(res, 400, { ok: false, error: 'invalid_range' });
    return;
  }

  try {
    const { data, error } = await supabase.rpc('admin_dashboard_trends', { p_range: range });
    if (error) {
      console.warn('admin_dashboard_trends', error.message || error.code || '');
      sendJson(res, 200, {
        ok: true,
        range,
        granularity: null,
        membersBefore: 0,
        styleLogsBefore: 0,
        buckets: [],
        rpcMissing: true,
        hint: dbErrorHint(error) || 'Supabase에 admin_dashboard_trends 함수가 없을 수 있습니다. docs/supabase/admin_dashboard_trends.sql 을 실행하세요.'
      });
      return;
    }

    let parsed = data;
    if (typeof data === 'string') {
      try {
        parsed = JSON.parse(data);
      } catch {
        sendJson(res, 200, {
          ok: true,
          range,
          granularity: null,
          membersBefore: 0,
          styleLogsBefore: 0,
          buckets: [],
          rpcMissing: true,
          hint: '추이 응답 파싱에 실패했습니다.'
        });
        return;
      }
    }

    if (parsed && typeof parsed === 'object' && parsed.ok === false) {
      sendJson(res, 400, parsed);
      return;
    }

    const buckets = Array.isArray(parsed?.buckets) ? parsed.buckets : [];
    sendJson(res, 200, {
      ok: true,
      range: parsed?.range || range,
      granularity: parsed?.granularity || null,
      membersBefore: Number(parsed?.membersBefore ?? 0),
      styleLogsBefore: Number(parsed?.styleLogsBefore ?? 0),
      buckets
    });
  } catch (e) {
    console.error('admin/trends', e);
    sendJson(res, 500, { ok: false, error: 'internal_error' });
  }
};
