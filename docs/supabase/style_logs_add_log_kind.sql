-- style_logs — 4.0V 레퍼런스·스크랩 (단일 테이블, log_kind)
-- 앱 허용 값: my_outfit | reference (CHECK 는 앱·주석 기준, DB 제약은 두지 않음)
--
-- (선택) source_reference_id → style_logs(id) FK 는 운영 정책에 따라 별도 추가:
--   ALTER TABLE public.style_logs
--     ADD CONSTRAINT style_logs_source_reference_id_fkey
--     FOREIGN KEY (source_reference_id) REFERENCES public.style_logs(id) ON DELETE SET NULL;

ALTER TABLE public.style_logs
  ADD COLUMN IF NOT EXISTS log_kind text DEFAULT 'my_outfit';

ALTER TABLE public.style_logs
  ADD COLUMN IF NOT EXISTS reference_source_url text DEFAULT NULL;

ALTER TABLE public.style_logs
  ADD COLUMN IF NOT EXISTS scrap_group text DEFAULT NULL;

ALTER TABLE public.style_logs
  ADD COLUMN IF NOT EXISTS source_reference_id uuid DEFAULT NULL;

COMMENT ON COLUMN public.style_logs.log_kind IS '기록 종류: my_outfit(내 착장, 기본) | reference(레퍼런스). 앱에서 normalizeLogKind 로 검증.';
COMMENT ON COLUMN public.style_logs.reference_source_url IS '레퍼런스 원문 URL (http/https 만 저장 권장)';
COMMENT ON COLUMN public.style_logs.scrap_group IS '레퍼런스 스크랩 묶음 이름 (선택)';
COMMENT ON COLUMN public.style_logs.source_reference_id IS '내 착장으로 옮길 때 참고한 레퍼런스 style_logs.id (선택 FK)';

UPDATE public.style_logs
SET log_kind = 'my_outfit'
WHERE log_kind IS NULL;

NOTIFY pgrst, 'reload schema';
