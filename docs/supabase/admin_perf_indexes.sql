-- =============================================================================
-- 관리자 집계 속도 (선택) — Alpha·Production 각각 실행
-- 데이터가 많아질 때 style_logs 카운트·기간 필터가 빨라집니다.
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_style_logs_created_at ON public.style_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_style_logs_user_id ON public.style_logs (user_id) WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_style_logs_is_favorite_true
  ON public.style_logs (is_favorite)
  WHERE is_favorite IS TRUE;
