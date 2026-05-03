/**
 * Auth user_id → 이메일. RPC admin_emails_for_user_ids(auth.users) 우선, 없으면 GoTrue getUserById.
 * 어떤 단계에서도 throw 하지 않음(목록 API 500 방지).
 */
async function emailsForUserIds(supabase, ids) {
  const unique = [...new Set((ids || []).filter(Boolean))];
  const fallbackMap = () => {
    const m = new Map();
    for (const id of unique) m.set(id, '—');
    return m;
  };
  if (!unique.length) return new Map();

  try {
    const { data: rows, error: rpcErr } = await supabase.rpc('admin_emails_for_user_ids', {
      p_user_ids: unique
    });

    if (!rpcErr && Array.isArray(rows)) {
      const m = fallbackMap();
      for (const row of rows) {
        if (row && row.user_id != null) {
          const em = row.email && String(row.email).trim() ? String(row.email) : '—';
          m.set(row.user_id, em);
        }
      }
      return m;
    }

    if (rpcErr) {
      console.warn('admin_emails_for_user_ids RPC (fallback)', rpcErr.message || rpcErr.code || '');
    }

    const m = fallbackMap();
    await Promise.all(
      unique.map(async (id) => {
        try {
          const { data, error } = await supabase.auth.admin.getUserById(id);
          if (!error && data?.user?.email) m.set(id, data.user.email);
        } catch {
          /* keep — */
        }
      })
    );
    return m;
  } catch (e) {
    console.error('emailsForUserIds', e);
    return fallbackMap();
  }
}

module.exports = { emailsForUserIds };
