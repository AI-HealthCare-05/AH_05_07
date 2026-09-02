create table public.active_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  action_id text not null,
  starts_on date not null,
  ends_on date not null,
  first_checkin_on date,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days'),
  constraint active_challenges_action_id_check check (action_id ~ '^[a-z0-9-]{1,40}$'),
  constraint active_challenges_status_check check (status in ('active', 'closed')),
  constraint active_challenges_seven_day_window_check check (ends_on = starts_on + 6),
  constraint active_challenges_first_checkin_window_check check (
    first_checkin_on is null or first_checkin_on between starts_on and ends_on
  ),
  constraint active_challenges_id_user_id_key unique (id, user_id)
);

create unique index active_challenges_one_active_per_user_idx
  on public.active_challenges(user_id)
  where status = 'active';

create index active_challenges_user_status_idx
  on public.active_challenges(user_id, status, starts_on desc);

alter table public.active_challenges enable row level security;

create policy "Users manage own active challenges"
  on public.active_challenges
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on table public.active_challenges from anon, authenticated;
grant select, insert, update, delete on table public.active_challenges to authenticated;

create table public.challenge_checkins (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null,
  user_id uuid not null,
  action_id text not null,
  observed_on date not null,
  status text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days'),
  constraint challenge_checkins_status_check check (status in ('completed', 'skipped')),
  constraint challenge_checkins_action_id_check check (action_id ~ '^[a-z0-9-]{1,40}$'),
  constraint challenge_checkins_challenge_user_fkey
    foreign key (challenge_id, user_id)
    references public.active_challenges(id, user_id)
    on delete cascade,
  constraint challenge_checkins_user_challenge_observed_on_key
    unique (user_id, challenge_id, observed_on)
);

create index challenge_checkins_user_observed_on_idx
  on public.challenge_checkins(user_id, observed_on desc);

alter table public.challenge_checkins enable row level security;

create policy "Users manage own challenge checkins"
  on public.challenge_checkins
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on table public.challenge_checkins from anon, authenticated;
grant select, insert, update, delete on table public.challenge_checkins to authenticated;

create function public.enforce_active_challenge_write()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.user_id is distinct from auth.uid() then
      raise exception 'challenge_owner_required';
    end if;
    if new.status <> 'active' then
      raise exception 'challenge_must_start_active';
    end if;
    return new;
  end if;

  if new.user_id is distinct from old.user_id
    or new.starts_on is distinct from old.starts_on
    or new.ends_on is distinct from old.ends_on
    or new.created_at is distinct from old.created_at
    or new.expires_at is distinct from old.expires_at then
    raise exception 'challenge_lifecycle_fields_immutable';
  end if;

  if new.first_checkin_on is distinct from old.first_checkin_on then
    if pg_trigger_depth() < 2 or old.first_checkin_on is not null then
      raise exception 'challenge_first_checkin_immutable';
    end if;
  end if;

  if old.first_checkin_on is not null and new.action_id <> old.action_id then
    raise exception 'challenge_selection_locked';
  end if;

  if new.status is distinct from old.status then
    if new.status <> 'closed'
      or old.status <> 'active'
      or (timezone('Asia/Seoul', now()))::date <= old.ends_on then
      raise exception 'challenge_cannot_close_before_window_ends';
    end if;
  end if;

  return new;
end;
$$;

create trigger active_challenges_enforce_write
before insert or update on public.active_challenges
for each row execute function public.enforce_active_challenge_write();

create function public.enforce_challenge_checkin_write()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  active_challenge public.active_challenges%rowtype;
begin
  if new.user_id is distinct from auth.uid() then
    raise exception 'challenge_owner_required';
  end if;

  if tg_op = 'UPDATE' and (
    new.challenge_id is distinct from old.challenge_id
    or new.user_id is distinct from old.user_id
    or new.action_id is distinct from old.action_id
    or new.observed_on is distinct from old.observed_on
    or new.created_at is distinct from old.created_at
    or new.expires_at is distinct from old.expires_at
  ) then
    raise exception 'challenge_checkin_lifecycle_fields_immutable';
  end if;

  select *
  into active_challenge
  from public.active_challenges
  where id = new.challenge_id and user_id = new.user_id;

  if not found then
    raise exception 'active_challenge_not_found';
  end if;

  if active_challenge.status <> 'active' then
    raise exception 'challenge_not_active';
  end if;

  if new.action_id <> active_challenge.action_id then
    raise exception 'challenge_checkin_action_mismatch';
  end if;

  if new.observed_on not between active_challenge.starts_on and active_challenge.ends_on then
    raise exception 'challenge_checkin_outside_active_window';
  end if;

  if active_challenge.first_checkin_on is null then
    update public.active_challenges
    set first_checkin_on = new.observed_on
    where id = active_challenge.id and user_id = active_challenge.user_id;
  end if;

  return new;
end;
$$;

create trigger challenge_checkins_enforce_write
before insert or update on public.challenge_checkins
for each row execute function public.enforce_challenge_checkin_write();

revoke execute on function public.enforce_active_challenge_write() from public, anon, authenticated;
revoke execute on function public.enforce_challenge_checkin_write() from public, anon, authenticated;

select cron.schedule_in_database(
  'purge-expired-active-challenges',
  '19 0 * * *',
  'delete from public.active_challenges where expires_at <= now();',
  'postgres',
  null,
  true
);
