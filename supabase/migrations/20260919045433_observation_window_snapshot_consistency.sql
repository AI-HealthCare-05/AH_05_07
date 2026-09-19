-- Issue #630: read mutually dependent challenge facts from one PostgreSQL snapshot.
--
-- SECURITY INVOKER preserves the caller's authenticated role and existing RLS.
-- STABLE makes every SELECT in the function use the snapshot established for
-- the calling query. The function is read-only and returns only the fields
-- already exposed by the current /window and /export contracts.

create or replace function public.get_owned_challenge_window(
  p_start_on date,
  p_end_on date
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with caller as (
    select auth.uid() as user_id
  ),
  active as (
    select jsonb_build_object(
      'id', challenge.id,
      'action_id', challenge.action_id,
      'starts_on', challenge.starts_on,
      'ends_on', challenge.ends_on,
      'first_checkin_on', challenge.first_checkin_on,
      'status', challenge.status,
      'created_at', challenge.created_at,
      'expires_at', challenge.expires_at
    ) as value
    from public.active_challenges as challenge
    cross join caller
    where challenge.user_id = caller.user_id
      and challenge.status = 'active'
    order by challenge.starts_on desc
    limit 1
  ),
  checkins as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', checkin.id,
          'challenge_id', checkin.challenge_id,
          'action_id', checkin.action_id,
          'observed_on', checkin.observed_on,
          'status', checkin.status,
          'created_at', checkin.created_at,
          'expires_at', checkin.expires_at
        )
        order by checkin.observed_on asc, checkin.created_at asc
      ),
      '[]'::jsonb
    ) as value
    from public.challenge_checkins as checkin
    cross join caller
    where checkin.user_id = caller.user_id
      and checkin.observed_on between p_start_on and p_end_on
  )
  select jsonb_build_object(
    'active_challenge', (select active.value from active),
    'challenge_checkins', (select checkins.value from checkins)
  );
$$;

revoke all on function public.get_owned_challenge_window(date, date) from public, anon;
grant execute on function public.get_owned_challenge_window(date, date) to authenticated;
