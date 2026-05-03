-- =============================================================================
-- StyleLog: user_feedback — 「의견 보내기」모달 (scripts/feedback.js) 전용 테이블
-- =============================================================================
-- • 테이블 이름: public.user_feedback  (고객센터 문의 support_inquiries 와 다름)
-- • Supabase SQL Editor에서 이 파일만 실행하면 됩니다. 순서는 support 와 무관.
-- • 테스트/리얼 등 앱이 붙는 프로젝트마다 한 번씩 실행하세요.
-- =============================================================================

create table if not exists public.user_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  category text not null default 'idea'
    check (category in ('idea', 'bug', 'other')),
  title text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists user_feedback_user_id_created_at_idx
  on public.user_feedback (user_id, created_at desc);

alter table public.user_feedback enable row level security;

-- 재실행 시 정책 중복 오류 방지
drop policy if exists "user_feedback_insert_own" on public.user_feedback;
drop policy if exists "user_feedback_select_own" on public.user_feedback;

create policy "user_feedback_insert_own"
  on public.user_feedback
  for insert
  with check (auth.uid() = user_id);

create policy "user_feedback_select_own"
  on public.user_feedback
  for select
  using (auth.uid() = user_id);
