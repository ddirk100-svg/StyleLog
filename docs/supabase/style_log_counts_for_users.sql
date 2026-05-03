-- 관리자 회원 목록: user_id별 style_logs 건수를 한 번에 조회 (API 왕복 N회 → 1회)
-- Supabase SQL Editor에서 실행 후, 알파/프로덕션 DB 각각 적용.

CREATE OR REPLACE FUNCTION public.style_log_counts_for_users(p_user_ids uuid[])
RETURNS TABLE(user_id uuid, log_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.user_id, COUNT(*)::bigint AS log_count
  FROM public.style_logs s
  WHERE s.user_id = ANY(p_user_ids)
  GROUP BY s.user_id;
$$;

REVOKE ALL ON FUNCTION public.style_log_counts_for_users(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.style_log_counts_for_users(uuid[]) TO service_role;

COMMENT ON FUNCTION public.style_log_counts_for_users IS 'Admin API: counts style_logs per user; service_role only.';
