-- Enforce the seven-day challenge lifecycle at the database boundary so an
-- authenticated Data API caller cannot bypass the FastAPI lifecycle rules.
--
-- Preserve the existing RLS, grants, exact 30-day retention, immutable fields,
-- action lock, and challenge/check-in consistency semantics.

create or replace function public.enforce_active_challenge_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    -- The product lifecycle closes challenge rows; authenticated clients do not
    -- have a product operation that deletes them. Keep administrative/retention
    -- deletion outside this authenticated Data API restriction.
    if current_user = 'authenticated' then
      raise exception 'challenge_delete_not_allowed';
    end if;
    return old;
  end if;

  if tg_op = 'INSERT' then
    if new.user_id is distinct from auth.uid() then
      raise exception 'challenge_owner_required';
    end if;

    if new.status <> 'active' then
      raise exception 'challenge_must_start_active';
    end if;

    if new.starts_on is distinct from (timezone('Asia/Seoul', now()))::date then
      raise exception 'challenge_must_start_today';
    end if;

    new.expires_at := now() + interval '30 days';
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

  if new.action_id <> old.action_id
    and (
      old.first_checkin_on is not null
      or (timezone('Asia/Seoul', now()))::date > old.ends_on
    ) then
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

create or replace function public.enforce_challenge_checkin_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  active_challenge public.active_challenges%rowtype;
begin
  if tg_op = 'DELETE' then
    -- Preserve administrative/cascading deletion outside the authenticated
    -- caller boundary.
    if current_user <> 'authenticated' then
      return old;
    end if;

    if old.user_id is distinct from auth.uid() then
      raise exception 'challenge_owner_required';
    end if;

    select *
    into active_challenge
    from public.active_challenges
    where id = old.challenge_id and user_id = old.user_id;

    if not found then
      raise exception 'active_challenge_not_found';
    end if;

    if active_challenge.status <> 'active'
      or (timezone('Asia/Seoul', now()))::date > active_challenge.ends_on then
      raise exception 'challenge_checkin_not_editable';
    end if;

    return old;
  end if;

  if new.user_id is distinct from auth.uid() then
    raise exception 'challenge_owner_required';
  end if;

  if tg_op = 'INSERT' then
    new.expires_at := now() + interval '30 days';
  elsif new.challenge_id is distinct from old.challenge_id
    or new.user_id is distinct from old.user_id
    or new.action_id is distinct from old.action_id
    or new.observed_on is distinct from old.observed_on
    or new.created_at is distinct from old.created_at
    or new.expires_at is distinct from old.expires_at then
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

  if tg_op = 'UPDATE'
    and (timezone('Asia/Seoul', now()))::date > active_challenge.ends_on then
    raise exception 'challenge_checkin_not_editable';
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

drop trigger if exists active_challenges_enforce_write
on public.active_challenges;

create trigger active_challenges_enforce_write
before insert or update or delete
on public.active_challenges
for each row
execute function public.enforce_active_challenge_write();

drop trigger if exists challenge_checkins_enforce_write
on public.challenge_checkins;

create trigger challenge_checkins_enforce_write
before insert or update or delete
on public.challenge_checkins
for each row
execute function public.enforce_challenge_checkin_write();
