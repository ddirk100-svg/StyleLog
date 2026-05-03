/**
 * support_inquiries: 목록 필터·대시보드 건수·최근 행 보강 (admin_reply 기준 통일)
 * PostgREST 한계로 빈 문자열만 미답변, 공백만 있는 값은 answered 집계에 섞일 수 있음(저장 시 서버 trim).
 */

/**
 * @param {*} query PostgREST 체인 (from().select() 이후)
 * @param {string} statusFilter open | answered | all
 */
function applyInquiryListFilterByReplyStatus(query, statusFilter) {
  const s = (statusFilter || 'all').trim();
  if (s === 'open') {
    return query.or('admin_reply.is.null,admin_reply.eq.');
  }
  if (s === 'answered') {
    return query.not('admin_reply', 'is', null).neq('admin_reply', '');
  }
  return query;
}

function selectInquiryCountOpen(supabase) {
  return supabase
    .from('support_inquiries')
    .select('*', { count: 'exact', head: true })
    .or('admin_reply.is.null,admin_reply.eq.');
}

function selectInquiryCountAnswered(supabase) {
  return supabase
    .from('support_inquiries')
    .select('*', { count: 'exact', head: true })
    .not('admin_reply', 'is', null)
    .neq('admin_reply', '');
}

async function fetchInquiryCountsByReply(supabase) {
  const [openInq, answeredInq] = await Promise.all([
    selectInquiryCountOpen(supabase),
    selectInquiryCountAnswered(supabase)
  ]);
  return {
    inquiriesOpen: openInq.count ?? 0,
    inquiriesAnswered: answeredInq.count ?? 0
  };
}

/** RPC/구 스냅샷에 admin_reply 가 빠졌을 때만 SELECT (이미 키가 있으면 생략) */
async function enrichRecentInquiriesAdminReply(supabase, rows) {
  if (!Array.isArray(rows) || rows.length === 0) return rows;
  if (rows.every((r) => r && typeof r === 'object' && Object.hasOwn(r, 'admin_reply'))) {
    return rows;
  }
  const ids = [...new Set(rows.map((r) => r && r.id).filter(Boolean))];
  if (!ids.length) return rows;
  const { data, error } = await supabase.from('support_inquiries').select('id,admin_reply').in('id', ids);
  if (error || !data) {
    if (error) console.warn('enrichRecentInquiriesAdminReply', error.message || error.code || '');
    return rows;
  }
  const map = new Map(data.map((r) => [r.id, r.admin_reply]));
  return rows.map((r) => {
    if (!r || !r.id) return r;
    return { ...r, admin_reply: map.has(r.id) ? map.get(r.id) : r.admin_reply };
  });
}

module.exports = {
  applyInquiryListFilterByReplyStatus,
  fetchInquiryCountsByReply,
  enrichRecentInquiriesAdminReply
};
