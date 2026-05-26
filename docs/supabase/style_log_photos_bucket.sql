-- StyleLog — 착장 사진 저장소 (행당 ~수 MB의 base64 text[] PATCH 타임아웃 방지)
-- 적용 순서:
--   1) Dashboard → Storage 에서 이름이 정확히 style-log-photos 인 버킷을 만들거나, 아래 INSERT 로 생성
--   2) 이 파일 전체 실행
--   3) 브라우저에서 새 기록 작성·저장으로 업로드·표시 테스트
--
-- 개념:
--   - DB style_logs.photos(text[])에는 더 이상 data URL 긴 문자열을 넣지 않고, HTTPS 공개 URL만 저장 (리스트 부담 동일 플로)
--   - 각 슬롯마다 두 파일 저장: display (화면용 압축), original (포맷 보존 또는 고화질 JPEG)
-- 경로 패턴:
--   {user_uuid}/{style_log_uuid}/{index}/display.jpg
--   {user_uuid}/{style_log_uuid}/{index}/original{.jpg|.png|.webp}

-- ── 버킷 (이미 있으면 무시 가능) ─────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'style-log-photos',
  'style-log-photos',
  true,
  20971520, -- 원본 허용 20MiB 안팎 (플랜·정책에 맞게 조정)
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ── 정책 (storage.objects)
-- ⚠ 호스티드 대시보드에서는 아래 때문에 SQL 이 실패할 수 있습니다.
--     ERROR 42501: must be owner of table objects
--   - Supabase 에서 storage.objects 테이블 소유자는 내부 역할이라
--     `ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY` 는 에디터 연결로는 불가합니다.
--   - Storage 의 RLS 는 기본으로 켜져 있어 이 스크립트에는 ALTER 줄을 두지 않습니다.
--   - 그래도 정책 CREATE/DROP 까지 42501 이면: Dashboard → Storage → style-log-photos →
--     Policies 에서 같은 조건으로 수동 추가하거나 Supabase 의 “New policy” 템플릿을 사용하세요.

-- ── 정책: 본인 폴더(첫 번째 세그먼트 = auth.uid())에만 업로드/수정/삭제 ──
-- 기존 동일 이름 정책이 있으면 충돌하므로 먼저 Dashboard에서 제거하거나 이름을 바꿔 주세요.

drop policy if exists "style_log_photos_select_public" on storage.objects;
create policy "style_log_photos_select_public"
on storage.objects for select
to public
using (bucket_id = 'style-log-photos');

drop policy if exists "style_log_photos_insert_own" on storage.objects;
create policy "style_log_photos_insert_own"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'style-log-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "style_log_photos_update_own" on storage.objects;
create policy "style_log_photos_update_own"
on storage.objects for update
to authenticated
using (
  bucket_id = 'style-log-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'style-log-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "style_log_photos_delete_own" on storage.objects;
create policy "style_log_photos_delete_own"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'style-log-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);
