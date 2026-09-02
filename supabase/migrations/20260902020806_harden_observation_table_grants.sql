revoke all on table public.blood_pressure_observations from anon, authenticated;
revoke all on table public.challenge_events from anon, authenticated;

grant select, insert, update, delete on table public.blood_pressure_observations to authenticated;
grant select, insert, update, delete on table public.challenge_events to authenticated;