# Deployment SSOT

## Authority

| Concern | Single source of truth | Rule |
| --- | --- | --- |
| Application code and Worker configuration | `AI-HealthCare-05/AH_05_07` `main` | `web/wrangler.jsonc` defines the production Worker name. |
| Deployment snapshot | `emotigom/ah-05-07-pages` `main` | A derived copy of upstream `main`; do not make application changes here. |
| Production web service | Cloudflare Worker `ah-05-07-pages-web` | The public URL is `https://ah-05-07-pages-web.ahnsangkyoon.workers.dev`. |
| API service | Cloud Run service `bp7-api` in `asia-northeast3` | Its allowed web origin must match the production web service. |
| Authentication and record ownership | Supabase project configuration and migrations in this repository | Browser clients use only the publishable key; row ownership remains enforced by RLS. |

`ah-05-07-pages` is retained only during cutover verification. It is not a second production target and must not receive a separate application deployment.

## Build configuration

The Cloudflare build that publishes the production Worker owns the frontend build variables. Vite substitutes every `VITE_*` value into the generated browser assets, so none of them are runtime secrets.

| Variable | Cloudflare type | Value class |
| --- | --- | --- |
| `VITE_API_BASE_URL` | Variable | Public Cloud Run origin, without a trailing slash |
| `VITE_SUPABASE_URL` | Variable | Public Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Variable | Public Supabase publishable key |

Do not create `VITE_*` secrets. Never place a Supabase `service_role` key, SMTP credential, Cloudflare API token, or any server-only secret in the web build.

## Deployment flow

1. Merge a verified change into upstream `main`.
2. Run `Sync deployment branch` in `emotigom/ah-05-07-pages`.
3. The sync workflow copies upstream `main` without upstream GitHub workflows.
4. Cloudflare builds `web` with the variables above and deploys the assets to `ah-05-07-pages-web`.
5. Verify the live URL, a signed-in API read, and the Cloud Run CORS preflight before retiring the old Worker.

The deployment mirror may preserve its sync workflow, but it must not generate or overwrite `web/wrangler.jsonc`. That file is copied from upstream with the application source.

## Change rules

- Change the public web origin in one pull request: `web/wrangler.jsonc`, Supabase Auth redirect URLs, and Cloud Run `API_CORS_ORIGINS` must agree.
- Save a Cloudflare variable before triggering a new build. A previous static deployment cannot acquire a Vite variable after it has been built.
- Keep the current production Worker and old Worker until the verification in this document passes. Do not use Cloudflare's manual static-file uploader for source-backed releases.
