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

## Supabase migration gate

Files in `supabase/migrations/` are version-controlled database change instructions. Git merge, GitHub Actions, Cloud Run deployment, and Cloudflare deployment do **not** execute those SQL files against the production Supabase project automatically.

### Current production procedure

The current production project has had schema changes applied manually. Until its remote migration history has been reconciled with the repository and a linked CLI release procedure is reviewed, the approved production path is an operator-mediated execution in the Supabase SQL Editor.

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
