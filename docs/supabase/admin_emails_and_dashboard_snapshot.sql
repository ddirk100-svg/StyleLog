-- =============================================================================
-- 관리자 API 속도: 이메일 N회(GoTrue) 제거 + 대시보드 요약 1회 조회
-- Supabase SQL Editor에서 실행 (알파·프로덕션 각각). service_role 전용 실행.
-- =============================================================================

-- uuid[] → 이메일 (문의·피드백 목록에서 getUserById 반복 대신)
CREATE OR REPLACE FUNCTION public.admin_emails_for_user_ids(p_user_ids uuid[])
RETURNS TABLE(user_id uuid, email text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = auth, public
AS $$
  SELECT u.id AS user_id, COALESCE(u.email, '—')::text AS email
  FROM auth.users u
  WHERE u.id = ANY(p_user_ids);
$$;

REVOKE ALL ON FUNCTION public.admin_emails_for_user_ids(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_emails_for_user_ids(uuid[]) TO service_role;

-- 대시보드: 카운트·최근 8건·작성자 이메일까지 한 번에
CREATE OR REPLACE FUNCTION public.admin_dashboard_snapshot()
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT json_build_object(
    'inquiriesOpen', (SELECT count(*)::bigint FROM public.support_inquiries WHERE status = 'open'),
    'inquiriesAnswered', (SELECT count(*)::bigint FROM public.support_inquiries WHERE status = 'answered'),
    'inquiriesTotal', (SELECT count(*)::bigint FROM public.support_inquiries),
    'feedbackTotal', (SELECT count(*)::bigint FROM public.user_feedback),
    'feedbackIdea', (SELECT count(*)::bigint FROM public.user_feedback WHERE category = 'idea'),
    'feedbackBug', (SELECT count(*)::bigint FROM public.user_feedback WHERE category = 'bug'),
    'feedbackOther', (SELECT count(*)::bigint FROM public.user_feedback WHERE category = 'other'),
    'styleLogsTotal', (SELECT count(*)::bigint FROM public.style_logs),
    'membersTotal', (SELECT count(*)::bigint FROM auth.users),
    'recentInquiries', COALESCE(
      (
        SELECT json_agg(row_to_json(t) ORDER BY t.created_at DESC)
        FROM (
          SELECT
            si.id,
            si.title,
            si.status,
            si.user_id,
            si.created_at,
            COALESCE(u.email, '—') AS user_email
          FROM public.support_inquiries si
          LEFT JOIN auth.users u ON u.id = si.user_id
          ORDER BY si.created_at DESC
          LIMIT 8
        ) t
      ),
      '[]'::json
    ),
    'recentFeedback', COALESCE(
      (
        SELECT json_agg(row_to_json(t) ORDER BY t.created_at DESC)
        FROM (
          SELECT
            f.id,
            f.title,
            f.category,
            f.user_id,
            f.created_at,
            COALESCE(u.email, '—') AS user_email
          FROM public.user_feedback f
          LEFT JOIN auth.users u ON u.id = f.user_id
          ORDER BY f.created_at DESC
          LIMIT 8
        ) t
      ),
      '[]'::json
    )
  );
$$;

REVOKE ALL ON FUNCTION public.admin_dashboard_snapshot() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_dashboard_snapshot() TO service_role;

COMMENT ON FUNCTION public.admin_emails_for_user_ids IS 'Admin API: batch email from auth.users; service_role only.';
COMMENT ON FUNCTION public.admin_dashboard_snapshot IS 'Admin API: dashboard counts + recent rows with email; service_role only.';
