-- Read-only retention purge health evidence query.
--
-- Scope:
--   - cron.job
--   - cron.job_run_details
--
-- This query does not read application/product tables and does not mutate
-- cron configuration, retention state, or application data.

with evidence_clock as (
  select clock_timestamp() as checked_at
),
target_jobs as (
  select
    jobid,
    jobname,
    schedule,
    active
  from cron.job
  where jobname in (
    'purge-expired-observation-records',
    'purge-expired-active-challenges'
  )
),
ranked_runs as (
  select
    r.jobid,
    r.status,
    r.start_time,
    r.end_time,
    row_number() over (
      partition by r.jobid
      order by r.start_time desc, r.runid desc
    ) as run_rank
  from cron.job_run_details r
  join target_jobs j on j.jobid = r.jobid
),
job_evidence as (
  select
    jsonb_build_object(
      'jobname', j.jobname,
      'schedule', j.schedule,
      'active', j.active,
      'recent_non_succeeded_count_30h',
      (
        select count(*)
        from cron.job_run_details r
        cross join evidence_clock c
        where r.jobid = j.jobid
          and r.status is distinct from 'succeeded'
          and coalesce(r.end_time, r.start_time)
            >= c.checked_at - interval '30 hours'
          and coalesce(r.end_time, r.start_time) <= c.checked_at
      ),
      'runs',
      coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'status', rr.status,
              'start_time', rr.start_time,
              'end_time', rr.end_time
            )
            order by rr.start_time desc
          )
          from ranked_runs rr
          where rr.jobid = j.jobid
            and rr.run_rank <= 7
        ),
        '[]'::jsonb
      )
    ) as job
  from target_jobs j
)
select jsonb_build_object(
  'schema_version', 'retention-purge-health-evidence-v1',
  'checked_at', c.checked_at,
  'jobs',
  coalesce(
    (
      select jsonb_agg(job order by job ->> 'jobname')
      from job_evidence
    ),
    '[]'::jsonb
  )
) as evidence
from evidence_clock c;