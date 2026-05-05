-- =============================================================================
-- 관리자 대시보드 추이: 회원 가입(auth.users)·스타일 로그 버킷 집계
-- Supabase SQL Editor에서 실행. service_role 이 RPC 를 호출합니다.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.admin_dashboard_trends(p_range text)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_start timestamptz;
  v_trunc text;
  v_step interval;
  v_members_before bigint;
  v_logs_before bigint;
  r json;
BEGIN
  IF p_range IS NULL OR btrim(p_range) = '' THEN
    p_range := '6m';
  END IF;

  p_range := lower(btrim(p_range));

  IF p_range NOT IN ('1m', '3m', '6m', '1y', 'all') THEN
    RETURN json_build_object(
      'ok', false,
      'error', 'invalid_range',
      'message', 'Use 1m, 3m, 6m, 1y, or all.'
    );
  END IF;

  IF p_range = '1m' THEN
    v_start := now() - interval '1 month';
    v_trunc := 'day';
    v_step := interval '1 day';
  ELSIF p_range = '3m' THEN
    v_start := now() - interval '3 months';
    v_trunc := 'week';
    v_step := interval '1 week';
  ELSIF p_range = '6m' THEN
    v_start := now() - interval '6 months';
    v_trunc := 'week';
    v_step := interval '1 week';
  ELSIF p_range = '1y' THEN
    v_start := now() - interval '1 year';
    v_trunc := 'month';
    v_step := interval '1 month';
  ELSE
    SELECT min(x)
    INTO v_start
    FROM (
      SELECT min(created_at) AS x FROM public.style_logs
      UNION ALL
      SELECT min(created_at) FROM auth.users
    ) q
    WHERE x IS NOT NULL;

    IF v_start IS NULL THEN
      v_start := now() - interval '2 years';
    END IF;

    v_trunc := 'month';
    v_step := interval '1 month';
  END IF;

  v_start := date_trunc(v_trunc, v_start);

  SELECT count(*)::bigint INTO v_members_before FROM auth.users WHERE created_at < v_start;
  SELECT count(*)::bigint INTO v_logs_before FROM public.style_logs WHERE created_at < v_start;

  WITH
  bounds AS (
    SELECT
      v_start AS t0,
      date_trunc(v_trunc, now()) AS t1
  ),
  series AS (
    SELECT gs AS b
    FROM bounds,
      generate_series(bounds.t0, bounds.t1, v_step) AS gs
  ),
  au AS (
    SELECT date_trunc(v_trunc, created_at) AS b, count(*)::bigint AS c
    FROM auth.users
    WHERE created_at >= v_start
    GROUP BY 1
  ),
  sl AS (
    SELECT date_trunc(v_trunc, created_at) AS b, count(*)::bigint AS c
    FROM public.style_logs
    WHERE created_at >= v_start
    GROUP BY 1
  )
  SELECT json_agg(
    json_build_object(
      't', ser.b,
      'signups', COALESCE(au.c, 0),
      'styleLogs', COALESCE(sl.c, 0)
    )
    ORDER BY ser.b
  )
  INTO r
  FROM series ser
  LEFT JOIN au ON au.b = ser.b
  LEFT JOIN sl ON sl.b = ser.b;

  RETURN json_build_object(
    'ok', true,
    'range', p_range,
    'granularity', v_trunc,
    'membersBefore', COALESCE(v_members_before, 0),
    'styleLogsBefore', COALESCE(v_logs_before, 0),
    'buckets', COALESCE(r, '[]'::json)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_dashboard_trends(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_dashboard_trends(text) TO service_role;

COMMENT ON FUNCTION public.admin_dashboard_trends IS 'Admin API: time-bucket signups (auth.users) and style_logs counts + baselines for cumulative charts; service_role only.';
