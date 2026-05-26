-- PostgreSQL 에서 컬럼이 없을 때: 42703 · column style_logs.items does not exist
-- PostgREST 캐시만 문제일 때: PGRST204 … schema cache (아래 notify 로 해결 시도)
--
-- [참고] information_schema 에 items 가 보여도 REST(API) 에서는 아직 모를 수 있음
-- PostgreSQL 과 PostgREST 스키마 캐시는 따로 움직입니다. 테이블에 컬럼이 있어도
-- 앱에서 계속 컬럼 없음이면 반드시 아래 notify 를 실행한 뒤 잠깐 기다렸다가 새로고침하세요.
--
-- style_logs 테이블에 착장 품목(JSON 배열) 컬럼 추가
-- 앱에서는 `scripts/write.js`, `detail.js`가 `{ category, value }[]` 형태를 사용합니다.
-- (스펙 문서명의 outfit_logs 와 대응되는 실제 테이블명은 style_logs 입니다.)

-- Supabase SQL Editor 에서 실행
alter table public.style_logs
  add column if not exists items jsonb default null;

comment on column public.style_logs.items is '착장 품목 [{ "category": "상의", "value": "…" }, …]';

-- ---------------------------------------------------------------------------
-- 여전히 API 오류: PGRST204 … "items" column … "schema cache"
-- → Table Editor 에서 items 컬럼이 보이는데도 같다면 PostgREST 캐시만 낡은 경우가 많음.
-- 아래 한 줄 실행 후 10~60초 기다렸다가 브라우저 새로고침 후 저장 재시도.
notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- 여전히 PGRST204: "Could not find the 'items' column … in the schema cache"
-- (notify 를 했는데도 REST 만 모를 때 — Supabase 쪽 알려진 케이스)
--
-- 1) 알림 큐 정리 후 다시 스키마 리로드 (SQL Editor 에서 순서대로 실행)
--    select pg_notification_queue_usage();
--    notify pgrst, 'reload schema';
--
-- 2) 1~2분 대기 후 브라우저 강력 새로고침 → PATCH 다시 시도
--
-- 3) 그래도 동일하면: Dashboard → Project Settings → 일시 중지(Pause) 후
--    다시 Resume — PostgREST 가 재시작되며 스키마 캐시가 새로 잡힙니다.
--
-- 4) 그래도 안 되면: 같은 프로젝트(ref) 맞는지·다른 분기 URL 아닌지 확인 후
--    Supabase 지원/게시판에 프로젝트 ref 와 PGRST204 전문을 남기면 됩니다.
--
-- (참고) 공식 트러블슈팅:
-- https://supabase.com/docs/guides/troubleshooting/postgrest-not-recognizing-new-columns-or-functions
-- (경로가 바뀌면 문서 검색: "PostgREST not recognizing new columns")
-- ---------------------------------------------------------------------------

-- (선택) 컬럼 존재 확인 — 결과에 items 한 줄이 나오면 DB에는 반영된 것
-- select column_name, data_type
-- from information_schema.columns
-- where table_schema = 'public' and table_name = 'style_logs' and column_name = 'items';

