/**
 * Auth user_id → 이메일 (관리자 API 목록용). 중복 호출은 Map으로 합침.
 */
async function emailsForUserIds(supabase, ids) {
  const unique = [...new Set((ids || []).filter(Boolean))];
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

module.exports = { emailsForUserIds };
