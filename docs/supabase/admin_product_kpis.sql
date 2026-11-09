-- =============================================================================
-- 관리자 · 로드맵 핵심 지표 (Phase 1·2 + 최근 N일)
-- Supabase SQL Editor에서 실행 (Alpha·Production 각각). service_role 전용.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.admin_product_kpis(p_recent_days int DEFAULT 30)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_members bigint;
  v_logs bigint;
  v_writers bigint;
  v_fav_logs bigint;
  v_fav_users bigint;
  v_tpo_logs bigint;
  v_items_logs bigint;
  v_repeat_writers bigint;
  v_has_tpo boolean;
  v_has_items boolean;
  v_days int;
  v_signups_recent bigint;
  v_logs_recent bigint;
  v_active_writers bigint;
  v_avg_member numeric;
  v_avg_writer numeric;
BEGIN
  v_days := GREATEST(COALESCE(p_recent_days, 30), 1);
  IF v_days > 365 THEN
    v_days := 365;
  END IF;

  SELECT count(*)::bigint INTO v_members FROM auth.users;
  SELECT count(*)::bigint INTO v_logs FROM public.style_logs;

  SELECT count(DISTINCT user_id)::bigint INTO v_writers
  FROM public.style_logs
  WHERE user_id IS NOT NULL;

  SELECT count(*)::bigint INTO v_fav_logs
  FROM public.style_logs
  WHERE is_favorite IS TRUE;

  SELECT count(DISTINCT user_id)::bigint INTO v_fav_users
  FROM public.style_logs
  WHERE is_favorite IS TRUE AND user_id IS NOT NULL;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'style_logs'
      AND column_name = 'tpo'
  ) INTO v_has_tpo;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'style_logs'
      AND column_name = 'items'
  ) INTO v_has_items;

  v_tpo_logs := 0;
  IF v_has_tpo THEN
    EXECUTE $q$
      SELECT count(*)::bigint FROM public.style_logs
      WHERE tpo IS NOT NULL AND cardinality(tpo) > 0
    $q$ INTO v_tpo_logs;
  END IF;

  v_items_logs := 0;
  IF v_has_items THEN
    EXECUTE $q$
      SELECT count(*)::bigint FROM public.style_logs
      WHERE items IS NOT NULL
        AND jsonb_typeof(items) = 'array'
        AND jsonb_array_length(items) > 0
    $q$ INTO v_items_logs;
  END IF;

  SELECT count(*)::bigint INTO v_repeat_writers
  FROM (
    SELECT user_id
    FROM public.style_logs
    WHERE user_id IS NOT NULL
    GROUP BY user_id
    HAVING count(*) >= 2
  ) s;

  SELECT count(*)::bigint INTO v_signups_recent
  FROM auth.users
  WHERE created_at >= now() - (v_days || ' days')::interval;

  SELECT count(*)::bigint INTO v_logs_recent
  FROM public.style_logs
  WHERE created_at >= now() - (v_days || ' days')::interval;

  SELECT count(DISTINCT user_id)::bigint INTO v_active_writers
  FROM public.style_logs
  WHERE user_id IS NOT NULL
    AND created_at >= now() - (v_days || ' days')::interval;

  v_avg_member := CASE WHEN v_members > 0 THEN round(v_logs::numeric / v_members, 2) ELSE 0 END;
  v_avg_writer := CASE WHEN v_writers > 0 THEN round(v_logs::numeric / v_writers, 2) ELSE 0 END;

  RETURN json_build_object(
    'ok', true,
    'recentDays', v_days,
    'membersTotal', v_members,
    'styleLogsTotal', v_logs,
    'writersTotal', v_writers,
    'avgLogsPerMember', v_avg_member,
    'avgLogsPerWriter', v_avg_writer,
    'favoriteLogs', v_fav_logs,
    'favoriteLogsPct', CASE WHEN v_logs > 0 THEN round(100.0 * v_fav_logs / v_logs, 1) ELSE 0 END,
    'favoriteUsers', v_fav_users,
    'favoriteUsersPct', CASE WHEN v_writers > 0 THEN round(100.0 * v_fav_users / v_writers, 1) ELSE 0 END,
    'tpoLogs', v_tpo_logs,
    'tpoLogsPct', CASE WHEN v_logs > 0 AND v_has_tpo THEN round(100.0 * v_tpo_logs / v_logs, 1) ELSE NULL END,
    'itemsLogs', v_items_logs,
    'itemsLogsPct', CASE WHEN v_logs > 0 AND v_has_items THEN round(100.0 * v_items_logs / v_logs, 1) ELSE NULL END,
    'repeatWriters', v_repeat_writers,
    'repeatWritersPct', CASE WHEN v_writers > 0 THEN round(100.0 * v_repeat_writers / v_writers, 1) ELSE 0 END,
    'signupsRecent', v_signups_recent,
    'logsRecent', v_logs_recent,
    'activeWritersRecent', v_active_writers,
    'hasTpoColumn', v_has_tpo,
    'hasItemsColumn', v_has_items
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_product_kpis(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_product_kpis(int) TO service_role;

COMMENT ON FUNCTION public.admin_product_kpis IS 'Admin API: roadmap KPIs from DB; service_role only.';
