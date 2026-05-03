/**
 * Auth user_id → 이메일. RPC admin_emails_for_user_ids(auth.users) 우선, 없으면 GoTrue getUserById.
 */
async function emailsForUserIds(supabase, ids) {
  const unique = [...new Set((ids || []).filter(Boolean))];
  const map = new Map();
  for (const id of unique) map.set(id, '—');
  if (!unique.length) return map;

  const { data: rows, error: rpcErr } = await supabase.rpc('admin_emails_for_user_ids', {
    p_user_ids: unique
  });

  if (!rpcErr && Array.isArray(rows)) {
    for (const row of rows) {
      if (row && row.user_id != null) {
        map.set(row.user_id, row.email && row.email.trim() ? row.email : '—');
      }
    }
    return map;
  }

  if (rpcErr) {
    console.warn('admin_emails_for_user_ids RPC (fallback)', rpcErr.message || rpcErr.code || '');
  }

  await Promise.all(
    unique.map(async (id) => {
      try {
        const { data, error } = await supabase.auth.admin.getUserById(id);
        if (!error && data?.user?.email) map.set(id, data.user.email);
      } catch {
        /* keep — */
      }
    })
  );
  return map;
}

module.exports = { emailsForUserIds };
