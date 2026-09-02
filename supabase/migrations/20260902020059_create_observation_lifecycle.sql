SET local check_function_bodies = off;

CREATE EXTENSION "pg_cron";

CREATE TABLE "public"."blood_pressure_observations" (
  "id"          uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "user_id"     uuid                     NOT NULL,
  "observed_on" date                     NOT NULL,
  "period"      text                     NOT NULL,
  "systolic"    smallint                 NOT NULL,
  "diastolic"   smallint                 NOT NULL,
  "created_at"  timestamp with time zone NOT NULL DEFAULT now(),
  "expires_at"  timestamp with time zone NOT NULL DEFAULT (now() + '30 days'::interval),
  CONSTRAINT "blood_pressure_observations_diastolic_check" CHECK (((diastolic >= 30) AND (diastolic <= 160))),
  CONSTRAINT "blood_pressure_observations_period_check" CHECK ((period = ANY (ARRAY['morning'::text, 'evening'::text]))),
  CONSTRAINT "blood_pressure_observations_pkey" PRIMARY KEY (id),
  CONSTRAINT "blood_pressure_observations_systolic_check" CHECK (((systolic >= 60) AND (systolic <= 260))),
  CONSTRAINT "blood_pressure_observations_user_id_observed_on_period_key" UNIQUE (user_id, observed_on, period)
);

ALTER TABLE "public"."blood_pressure_observations"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."challenge_events" (
  "id"          uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "user_id"     uuid                     NOT NULL,
  "observed_on" date                     NOT NULL,
  "action_id"   text                     NOT NULL,
  "status"      text                     NOT NULL,
  "created_at"  timestamp with time zone NOT NULL DEFAULT now(),
  "expires_at"  timestamp with time zone NOT NULL DEFAULT (now() + '30 days'::interval),
  CONSTRAINT "challenge_events_action_id_check" CHECK ((action_id ~ '^[a-z0-9-]{1,40}$'::text)),
  CONSTRAINT "challenge_events_pkey" PRIMARY KEY (id),
  CONSTRAINT "challenge_events_status_check" CHECK ((status = ANY (ARRAY['completed'::text, 'skipped'::text]))),
  CONSTRAINT "challenge_events_user_id_observed_on_action_id_key" UNIQUE (user_id, observed_on, action_id)
);

ALTER TABLE "public"."challenge_events"
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."blood_pressure_observations"
  ADD CONSTRAINT "blood_pressure_observations_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "public"."challenge_events"
  ADD CONSTRAINT "challenge_events_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX blood_pressure_observations_user_observed_on_idx ON public.blood_pressure_observations USING btree (user_id, observed_on DESC);

CREATE INDEX challenge_events_user_observed_on_idx ON public.challenge_events USING btree (user_id, observed_on DESC);

CREATE POLICY "Users manage own blood pressure observations" ON "public"."blood_pressure_observations"
  FOR ALL
  TO "authenticated"
  USING ((( SELECT auth.uid() AS uid) = user_id))
  WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY "Users manage own challenge events" ON "public"."challenge_events"
  FOR ALL
  TO "authenticated"
  USING ((( SELECT auth.uid() AS uid) = user_id))
  WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));

COMMENT ON EXTENSION "pg_cron" IS 'Job scheduler for PostgreSQL';

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."blood_pressure_observations" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."challenge_events" TO "anon", "authenticated", "postgres", "service_role";

SELECT
  cron.schedule_in_database('purge-expired-observation-records', '17 0 * * *',
  'delete from public.blood_pressure_observations where expires_at <= now(); delete from public.challenge_events where expires_at <= now();', 'postgres', NULL, true);

