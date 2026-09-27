# Deployment runbook

[AGENTS.md](../AGENTS.md) owns workflow, publication authorization and verification
budget. Merge is not deployment; documentation changes need no publication.

## Topology

- Develop in `AI-HealthCare-05/AH_05_07`; `emotigom/ah-05-07-pages` is a derived
  deployment snapshot. Its `.github/workflows/sync-upstream.yml` controls sync.
- The human owner controls mirror-to-Cloudflare publication by default. An agent
  may publish only with explicit current-task authorization; earlier permission
  does not carry forward.
- `web/wrangler.jsonc` defines the application Worker for `hyeol.app` and its
  workers.dev fallback. Only that Worker connects to the deployment mirror;
  the legacy redirect Worker in `ops/legacy-pages-web-redirect/` stays disconnected.
- Cloud Run `bp7-api` serves the API; Supabase supplies Auth and PostgreSQL/RLS.
  Keep public origins, Auth redirect URLs and API CORS methods consistent.

## Authorized deployment

1. Resolve the exact reviewed canonical source SHA. Classify DB, API and web
   artifact/configuration effects separately; test/dev/docs-only changes need
   no production action.
2. Read live source/build/runtime/configuration and concurrent release activity
   from their control planes. Capture distinct, complete, compatible known-good
   Worker/API rollback identities before mutation; do not infer them from docs.
3. Apply required DB changes before dependent callers. Reconcile remote migration
   history, review policies/grants/triggers, execute only the earliest unapplied
   migration and stop on error. Never replay the migration directory or use
   `db push` to recover unknown history. Verify affected ownership/RLS and grants
   separately with synthetic data; merge/build success does not prove schema state.
4. Deploy the API only for changed API artifacts/configuration. Preserve runtime
   configuration, secrets, IAM and CORS; verify the candidate before traffic activation.
5. Publish changed web artifacts/configuration through the mirror's existing
   exact-SHA sync and Cloudflare source build. Inspect the live sync workflow first:
   its source SHA, parentless mirror snapshot and run are separate identities.
   Do not use an ad-hoc static uploader or edit mirror application files.
6. Verify the intended build and serving runtime independently. Source, build,
   API revision/image, Worker version, schema and rollback identities are separate
   facts. A successful sync or image tag alone is not runtime/source-provenance proof.
7. Verify the changed contract using AGENTS.md's budget. For a presentation-only
   release, one public smoke plus decision-relevant changed-surface sanity suffices;
   signed-in replay is needed only for changed behavior or an explicit owner request.
   The public smoke tool is `scripts/ci/verify_deployment_smoke.py`, with live
   web/API origins supplied by the operator. It sends no auth or product data.
8. Retain rollback targets through verification. On a verified release regression,
   restore the affected runtime and check recovery. Runtime rollback does not
   restore database rows or Auth identities; follow the [recovery contract](architecture/RECOVERY_CONTRACT.md).

## Configuration and evidence

`VITE_*` values are public browser build inputs, never secrets. Preserve the
existing production env and frozen Model V2 prebuild guards; server credentials
remain server-only. Changed public values require a new build.

Record only applicable immutable identities, sanitized results and limitations
in the release Issue. Never store tokens, account/health data, raw responses or
logs. Prior evidence keeps its original scope. Offline provenance records can be
checked with `scripts/ops/verify_release_provenance.py`; a recorded image tag is
not native Git provenance. No separate evidence document or broad replay is a
default closeout requirement, and historical Issue gates do not carry forward.
