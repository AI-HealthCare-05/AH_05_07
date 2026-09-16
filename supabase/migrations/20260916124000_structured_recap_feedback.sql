create table public.structured_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  surface text not null,
  response text not null,
  submitted_on date not null default (timezone('Asia/Seoul', now()))::date,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days'),
  constraint structured_feedback_surface_check check (surface in ('seven_day_recap')),
  constraint structured_feedback_response_check check (response in ('clear', 'unclear', 'hard_to_understand')),
  constraint structured_feedback_user_surface_day_key unique (user_id, surface, submitted_on)
);

create index structured_feedback_user_submitted_on_idx
  on public.structured_feedback(user_id, submitted_on desc);

alter table public.structured_feedback enable row level security;

create policy "Users read own unexpired structured feedback"
  on public.structured_feedback
  for select
  to authenticated
  using ((select auth.uid()) = user_id and expires_at > now());

create policy "Users create own structured feedback"
  on public.structured_feedback
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

revoke all on table public.structured_feedback from anon, authenticated;
grant select (id, surface, response, submitted_on, created_at, expires_at)
  on table public.structured_feedback to authenticated;
grant insert (user_id, surface, response)
  on table public.structured_feedback to authenticated;

select cron.schedule_in_database(
  'purge-expired-structured-feedback',
  '23 0 * * *',
  'delete from public.structured_feedback where expires_at <= now();',
  'postgres',
  null,
  true
);
