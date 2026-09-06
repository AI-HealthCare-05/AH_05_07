# Deployment SSOT

## Authority

| Concern | Single source of truth | Rule |
| --- | --- | --- |
| Application code and Worker configuration | `AI-HealthCare-05/AH_05_07` `main` | `web/wrangler.jsonc` defines the production Worker name. |
| Deployment snapshot | `emotigom/ah-05-07-pages` `main` | A derived copy of upstream `main`; do not make application changes here. |
| Production web service | Cloudflare Worker `ah-05-07-pages` | The public URL is `https://ah-05-07-pages.ahnsangkyoon.workers.dev`. |
| API service | Cloud Run service `bp7-api` in `asia-northeast3` | Its allowed web origin must match the production web service. |
| Authentication and record ownership | Supabase project configuration and migrations in this repository | Browser clients use only the publishable key; row ownership remains enforced by RLS. |

`ah-05-07-pages-web` is the legacy Worker retained only during cutover verification. It is not a second production target and must not receive a separate application deployment.

## Build configuration

The Cloudflare build that publishes the production Worker owns the frontend build variables. Vite substitutes every `VITE_*` value into the generated browser assets, so none of them are runtime secrets.

| Variable | Cloudflare type | Value class |
| --- | --- | --- |
| `VITE_API_BASE_URL` | Variable | Public Cloud Run origin, without a trailing slash |
| `VITE_SUPABASE_URL` | Variable | Public Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Variable | Public Supabase publishable key |

Do not create `VITE_*` secrets. Never place a Supabase `service_role` key, SMTP credential, Cloudflare API token, or any server-only secret in the web build.

## Release classification

Classify the merged change before deploying it. A merged Git commit is not, by itself, a database, API, or web deployment.

| Changed path | Required production action | Must happen before |
| --- | --- | --- |
| `supabase/migrations/**` | Complete the [Supabase migration gate](#supabase-migration-gate) for each newly required schema change. | Any API or web release that depends on that schema. |
| `app/**`, `cloudbuild.api.yaml`, or API runtime configuration | Build and deploy a new Cloud Run revision of `bp7-api`. | Browser verification of the changed API flow. |
| `web/**` or `web/wrangler.jsonc` | Run `Sync deployment branch` in `emotigom/ah-05-07-pages`, then let Cloudflare build and deploy `ah-05-07-pages`. | Browser verification of the changed web flow. |
| `docs/**` only | No runtime deployment is required. | N/A |

## Deployment flow

1. Merge a verified change into upstream `main`.
2. Classify the change with the table above. For a release that includes a database migration, complete the migration gate first.
3. If the API changed, build and deploy the Cloud Run revision that contains the merged commit.
4. If the web changed, run `Sync deployment branch`. The sync workflow copies upstream `main` without upstream GitHub workflows; Cloudflare then builds `web` with the variables above and deploys the assets to `ah-05-07-pages`.
5. Run the dependency-free deployment smoke verifier against the production web and API origins. It checks the live URL, `/live`, `/ready`, and CORS preflight for the browser methods currently used by the web client without sending authentication or product data.
6. Verify a signed-in API read and the specific database-backed browser flow only after its migration gate has passed.

### Deployment smoke command

Run this from Cloud Shell after the required Cloudflare and Cloud Run releases complete. The values are public origins; the command neither reads nor prints credentials, user identity, or health records.

```bash
python3 scripts/ci/verify_deployment_smoke.py \
  --web-base-url "https://ah-05-07-pages.ahnsangkyoon.workers.dev" \
  --api-base-url "https://bp7-api-292436735548.asia-northeast3.run.app"
```

The verifier's local controls run in GitHub Actions with `--self-test`. A successful production result is deployment evidence, not a substitute for the signed-in flow check or rollback rehearsal.

The deployment mirror may preserve its sync workflow, but it must not generate or overwrite `web/wrangler.jsonc`. That file is copied from upstream with the application source.

## Release evidence ledger

The source repository, deployment snapshot, and runtime release are related but
distinct records. Every release note must identify each applicable record with
an immutable value rather than treating a successful sync as proof of a runtime
deployment.

| Record | Required evidence |
| --- | --- |
| Source baseline | Full upstream `main` commit SHA and the merged Issue/PR. |
| Deployment snapshot | `emotigom/ah-05-07-pages` workflow run URL and successful job result. |
| Cloudflare runtime | Complete current Worker version identifier and public smoke result. |
| Cloud Run runtime | Complete deployed revision only when `app/**` or API runtime configuration changed. |
| Supabase schema | Applied migration filename and sanitized gate evidence only when a release depends on a schema change. |
| Rollback | A complete, distinct previous runtime identifier plus the rehearsal result. |

### Historical web release and rollback evidence

- Web release commit: `856606a2a230558887e294e44e8fe99186a542a8`.
- Deployment snapshot: `emotigom/ah-05-07-pages` workflow run
  [`33822332784`](https://github.com/emotigom/ah-05-07-pages/actions/runs/33822332784),
  completed successfully on 2026-09-04.
- Worker version recorded at Issue #143:
  `38bb08b6-66ca-4933-8cbe-ee857aa4ece7`.
- Public web/API/CORS smoke and operator-reviewed magic-link/session checks:
  passed, as recorded in Issue #143.
- Cloud Run deployment, Supabase migration, and production record write: not
  performed for this rollout.
- Source baseline when this G4 evidence was reviewed:
  `61ee356e43eeb4f06120af870c4fc2b9ee5f9d41` after the test-only PR #145;
  no runtime deployment is required for that assertion-only change.
- At Issue #143, rollback was unresolved: the recorded `38bb08b6` value was only
  the then-current Worker version prefix and did not establish a distinct
  rollback target.

Issue #151 established a distinct Worker rollback target and a completed
rehearsal: `38bb08b6-66ca-4933-8cbe-ee857aa4ece7` was deployed at 100%,
the public smoke passed, and
`6d100754-7e85-4d43-b466-e7944c61a0c0` was restored at 100% with the same
smoke passing. This historical rehearsal does not close the remaining Gate C
evidence or the upgrade baseline's [O3 clean-release rehearsal](mvp1-operations-review.md),
which still requires separate approval and execution.

Issue #166 completed a bounded production Cloud Run requests-log review after a
synthetic signed-in refresh. The operator selected the `bp7-api` requests stream
in `asia-northeast3` and found request metadata only: no secret, JWT, user
identifier, request body, or health value was displayed. Do not retain raw log
output, identifiers, query strings, or screenshots as release evidence. Repeat
this review after a logging- or request-path change.

Issue #146 introduces reconciliation of this ledger and the durable restart handoff.
Future releases append a dated entry or replace the `Latest reviewed` section
only when all recorded identifiers and results have been verified.

## Supabase migration gate

Files in `supabase/migrations/` are version-controlled database change instructions. Git merge, GitHub Actions, Cloud Run deployment, and Cloudflare deployment do **not** execute those SQL files against the production Supabase project automatically.

### Current production procedure

The current production project has had schema changes applied manually. Until its remote migration history has been reconciled with the repository and a linked CLI release procedure is reviewed, the approved production path is an operator-mediated execution in the Supabase SQL Editor.

Issue #160 adds the additive `challenge_checkins(challenge_id, user_id)` index
for the current Advisor finding. Apply it only through this gate, then re-run
the Advisor and the sanitized signed-in observation-window measurement in
[`observation-load-baseline.md`](observation-load-baseline.md). Do not treat a
merged migration file as a deployed index.

### Deployed ownership verification

Issue #149 records a 2026-09-04 preflight at source commit
`1c00e903a6bf189bcabc46708d140bd8103045bc`. The linked-project migration
inventory matches the four repository migrations through exact-time retention;
the four ownership tables have RLS enabled with authenticated CRUD grants and
their expected unexpired ownership-policy intent. After explicit owner
approval, the normal signed-in product path passed synthetic owner CRUD/export,
cross-user non-disclosure, anonymous denial, and first-check-in action-lock
checks. Both synthetic accounts and their cascading records were removed.
No migration, policy, grant, production record, Cloud Run revision, or Worker
deployment was changed by this verification. The detailed boundary and
sanitized result are in
[`deployed-rls-verification-plan.md`](deployed-rls-verification-plan.md).

1. Identify the earliest migration that production has not applied. Review its table, policy, grant, trigger, and scheduled-job effects before executing it.
2. Execute only that migration in the production SQL Editor. Wait for a successful result before considering the next migration. Stop on the first SQL error; do not retry by pasting the whole migrations directory.
3. Record the migration filename, execution time, operator, and a non-sensitive verification result in the linked Issue or pull request.
4. Verify the schema and access boundary using synthetic data only: expected tables, constraints or triggers, RLS enabled, and the intended `authenticated` privileges and ownership policies. Table access grants and RLS are separate checks.
5. Only then deploy or verify the API and web change that relies on the new schema.

Do **not** use `supabase db push` as an incident-recovery shortcut while the remote migration history is unknown. It can replay a migration whose database objects already exist. First compare local and remote history with `supabase migration list --linked`; if they differ, review and deliberately reconcile them with the Supabase migration-history workflow before enabling a CLI or CI database release.

### Required release evidence

For every production release that changes `supabase/migrations/**`, attach or link all of the following to the Issue or pull request:

- Migration filename(s) applied, in chronological order, and their successful SQL Editor result.
- A schema/access check that contains no real health records and confirms the expected objects, RLS state, grants, and ownership policies.
- A signed-in synthetic-user API or browser check for the new capability, plus an ownership-negative check when access behavior changed.
- The deployed Cloud Run revision and/or Cloudflare build that consumes the migrated schema.

This gate exists because a healthy web build can otherwise reach an API whose database is missing a required table, trigger, or policy and surface a production `503`.

## Origin cutover

Before accepting production traffic on the primary URL, add `https://ah-05-07-pages.ahnsangkyoon.workers.dev` to Supabase Auth redirect URLs and Cloud Run `API_CORS_ORIGINS`. Keep the legacy `ah-05-07-pages-web` origin temporarily only while confirming the primary URL; remove it after the verification passes.

## Change rules

- Change the public web origin in one pull request: `web/wrangler.jsonc`, Supabase Auth redirect URLs, and Cloud Run `API_CORS_ORIGINS` must agree.
- Save a Cloudflare variable before triggering a new build. A previous static deployment cannot acquire a Vite variable after it has been built.
- When a browser flow adds an API method such as `PUT` or `DELETE`, update the API CORS allow-list in the same pull request and verify that method's preflight against the production origin.
- Treat changes to `supabase/migrations/**` as a production gate, not as documentation or an implicit side effect of a code deployment. Do not deploy a caller path that requires a new table, policy, trigger, or grant before the migration evidence is complete.
- Keep the current production Worker and old Worker until the verification in this document passes. Do not use Cloudflare's manual static-file uploader for source-backed releases.

## Pending preparation version 2 release classification

The Gate 1B prerequisite patch changes `app/apis/v1/risk_signal_routers.py` to
keep the unreviewed input contract explicitly unavailable. If merged, this API
change needs a classified Cloud Run revision before claiming the guard is
present in production. Data scripts/tests/docs do not require runtime releases;
no web, R2 or database deployment is required. No deployment was performed while
preparing the patch, and no model artifact is authorized for release by it.
