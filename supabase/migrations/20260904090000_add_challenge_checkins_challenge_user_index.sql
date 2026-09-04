-- Covers the composite foreign key from challenge_checkins to active_challenges.
-- This is additive and does not alter rows, RLS, grants, triggers, or API behavior.
create index if not exists challenge_checkins_challenge_user_idx
  on public.challenge_checkins(challenge_id, user_id);
