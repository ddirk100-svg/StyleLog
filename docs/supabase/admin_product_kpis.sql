-- =============================================================================
-- 관리자 · 로드맵 핵심 지표 (Phase 1·2 + 최근 N일) — 단일 스캔 집계
-- Supabase SQL Editor에서 실행 (Alpha·Production 각각). service_role 전용.
-- tpo·items 컬럼은 2.0+ 스키마 기준 (없으면 style_logs_add_tpo/items 먼저).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.admin_product_kpis(p_recent_days int DEFAULT 30)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_days int;
  v_since timestamptz;
  v_members bigint;
  v_signups_recent bigint;
  v_logs bigint;
  v_fav_logs bigint;
  v_writers bigint;
  v_fav_users bigint;
  v_tpo_logs bigint;
  v_items_logs bigint;
  v_reference_logs bigint;
  v_logs_recent bigint;
  v_active_writers bigint;
  v_repeat_writers bigint;
  v_avg_member numeric;
  v_avg_writer numeric;
BEGIN
  v_days := GREATEST(COALESCE(p_recent_days, 30), 1);
  IF v_days > 365 THEN
    v_days := 365;
  END IF;
  v_since := now() - (v_days || ' days')::interval;

  SELECT
    count(*)::bigint,
    count(*) FILTER (WHERE is_favorite IS TRUE),
    count(DISTINCT user_id) FILTER (WHERE user_id IS NOT NULL),
    count(DISTINCT user_id) FILTER (WHERE is_favorite IS TRUE AND user_id IS NOT NULL),
    count(*) FILTER (WHERE tpo IS NOT NULL AND cardinality(tpo) > 0),
    count(*) FILTER (
      WHERE items IS NOT NULL
        AND jsonb_typeof(items) = 'array'
        AND jsonb_array_length(items) > 0
    ),
    count(*) FILTER (WHERE coalesce(log_kind, 'my_outfit') = 'reference'),
    count(*) FILTER (WHERE created_at >= v_since),
    count(DISTINCT user_id) FILTER (WHERE user_id IS NOT NULL AND created_at >= v_since)
  INTO
    v_logs,
    v_fav_logs,
    v_writers,
    v_fav_users,
    v_tpo_logs,
    v_items_logs,
    v_reference_logs,
    v_logs_recent,
    v_active_writers
  FROM public.style_logs;

  SELECT count(*)::bigint
  INTO v_repeat_writers
  FROM (
    SELECT user_id
    FROM public.style_logs
    WHERE user_id IS NOT NULL
    GROUP BY user_id
    HAVING count(*) >= 2
  ) rep;

  SELECT count(*)::bigint INTO v_members FROM auth.users;

  SELECT count(*)::bigint
  INTO v_signups_recent
  FROM auth.users
  WHERE created_at >= v_since;

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
    'tpoLogsPct', CASE WHEN v_logs > 0 THEN round(100.0 * v_tpo_logs / v_logs, 1) ELSE NULL END,
    'itemsLogs', v_items_logs,
    'itemsLogsPct', CASE WHEN v_logs > 0 THEN round(100.0 * v_items_logs / v_logs, 1) ELSE NULL END,
    'referenceLogs', v_reference_logs,
    'referenceLogsPct', CASE WHEN v_logs > 0 THEN round(100.0 * v_reference_logs / v_logs, 1) ELSE NULL END,
    'repeatWriters', v_repeat_writers,
    'repeatWritersPct', CASE WHEN v_writers > 0 THEN round(100.0 * v_repeat_writers / v_writers, 1) ELSE 0 END,
    'signupsRecent', v_signups_recent,
    'logsRecent', v_logs_recent,
    'activeWritersRecent', v_active_writers,
    'hasTpoColumn', true,
    'hasItemsColumn', true
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_product_kpis(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_product_kpis(int) TO service_role;

COMMENT ON FUNCTION public.admin_product_kpis IS 'Admin API: roadmap KPIs (one-pass style_logs scan); service_role only.';
