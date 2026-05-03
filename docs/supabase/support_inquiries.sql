-- =============================================================================
-- StyleLog: support_inquiries — 고객센터 1:1 문의 (inquiry-write / inquiry 페이지)
-- =============================================================================
-- • 테이블 이름: public.support_inquiries  (의견 user_feedback 과 별도 테이블)
-- • user_feedback.sql 과 내용이 다릅니다. 두 파일을 합치거나 덮어쓰지 마세요.
-- • Supabase SQL Editor에서 이 파일만 실행하면 됩니다. 순서는 user_feedback 과 무관.
-- • 운영자 답변: admin_reply(및 status)만 넣으면 됨
--   - replied_at: 첫 답변 시각(자동, 이후 유지)
--   - admin_reply_updated_at: 답변 내용이 바뀔 때마다 갱신(자동)
-- =============================================================================

create table if not exists public.support_inquiries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  body text not null,
  status text not null default 'open'
    check (status in ('open', 'answered')),
  admin_reply text,
  replied_at timestamptz,
  admin_reply_updated_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.support_inquiries
  add column if not exists admin_reply_updated_at timestamptz;

create index if not exists support_inquiries_user_id_created_at_idx
  on public.support_inquiries (user_id, created_at desc);

comment on table public.support_inquiries is '고객센터 1:1 문의. 답변은 대시보드에서 admin_reply 등 수정.';

alter table public.support_inquiries enable row level security;

drop policy if exists "support_inquiries_insert_own" on public.support_inquiries;
drop policy if exists "support_inquiries_select_own" on public.support_inquiries;

create policy "support_inquiries_insert_own"
  on public.support_inquiries
  for insert
  with check (auth.uid() = user_id);

create policy "support_inquiries_select_own"
  on public.support_inquiries
  for select
  using (auth.uid() = user_id);

-- 답변 시각: 첫 작성 → replied_at, 내용 변경 시마다 → admin_reply_updated_at
drop trigger if exists support_inquiries_set_replied_at_trigger on public.support_inquiries;
drop trigger if exists support_inquiries_reply_timestamps_trigger on public.support_inquiries;
drop function if exists public.support_inquiries_set_replied_at();

create or replace function public.support_inquiries_touch_reply_timestamps()
returns trigger
language plpgsql
as $$
declare
  old_nonempty boolean;
  new_nonempty boolean;
  reply_changed boolean;
begin
  new_nonempty := new.admin_reply is not null and trim(new.admin_reply) <> '';

  if tg_op = 'INSERT' then
    if new_nonempty then
      if new.replied_at is null then
        new.replied_at := now();
      end if;
      new.admin_reply_updated_at := now();
    end if;
    return new;
  end if;

  reply_changed := old.admin_reply is distinct from new.admin_reply;
  old_nonempty := old.admin_reply is not null and trim(old.admin_reply) <> '';

  if reply_changed and new_nonempty then
    if not old_nonempty then
      new.replied_at := coalesce(new.replied_at, now());
    end if;
    new.admin_reply_updated_at := now();
  end if;

  return new;
end;
$$;

create trigger support_inquiries_reply_timestamps_trigger
  before insert or update on public.support_inquiries
  for each row
  execute procedure public.support_inquiries_touch_reply_timestamps();

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 운영자: Table Editor 또는 SQL로 답변 등록
--   update public.support_inquiries
--   set admin_reply = '...', status = 'answered'
--   where id = '문의-uuid';
--   (replied_at / admin_reply_updated_at 은 트리거가 자동. 필요 시 수동 덮어쓰기도 가능.)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 기존 행만 과거 시각 백필(선택): 답은 있는데 admin_reply_updated_at 만 비어 있을 때
--   update public.support_inquiries
--   set admin_reply_updated_at = coalesce(replied_at, now())
--   where admin_reply is not null and trim(admin_reply) <> '' and admin_reply_updated_at is null;
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
