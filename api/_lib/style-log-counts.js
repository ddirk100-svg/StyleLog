/**
 * 회원 목록용: 페이지에 보이는 user_id들의 style_logs 건수.
 * 1) DB에 style_log_counts_for_users RPC 가 있으면 1회 호출
 * 2) 없으면 user_id 컬럼만 페이지네이션해 메모리에서 집계(RPC 미적용 환경 폴백)
 */
const PAGE = 1000;

async function getStyleLogCountsByUserIds(supabase, userIds) {
  const ids = [...new Set((userIds || []).filter(Boolean))];

  const zeros = () => {
    const m = new Map();
    for (const id of ids) m.set(id, 0);
    return m;
  };

  if (!ids.length) return new Map();

  const { data: rpcRows, error: rpcErr } = await supabase.rpc('style_log_counts_for_users', {
    p_user_ids: ids
  });

  if (!rpcErr && Array.isArray(rpcRows)) {
    const m = zeros();
    for (const row of rpcRows) {
      if (row && row.user_id != null && row.log_count != null) {
        m.set(row.user_id, Number(row.log_count));
      }
    }
    return m;
  }

  if (rpcErr) {
    console.warn('style_log_counts_for_users RPC (using fallback)', rpcErr.message || rpcErr.code || '');
  }

  const m = zeros();
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from('style_logs')
      .select('user_id')
      .in('user_id', ids)
      .range(from, from + PAGE - 1);

    if (error) {
      console.error('style_logs count fallback', error);
      return m;
    }
    const rows = data || [];
    for (const row of rows) {
      const uid = row.user_id;
      if (uid) m.set(uid, (m.get(uid) || 0) + 1);
    }
    if (rows.length < PAGE) break;
    from += PAGE;
  }
  return m;
}

module.exports = { getStyleLogCountsByUserIds };
