# S4 O3 clean release/revision verification preflight

## Scope and final preflight state

This is a **DOCS / READ-ONLY RECONCILIATION ONLY** record for the future AC-10
clean release, public smoke, rollback, and restore rehearsal. No Cloud Build
submit, Cloud Run deploy or traffic change, Cloudflare deploy, Supabase SQL or
migration, R2 change, production account/data write, model execution, or UI
change was performed while preparing this preflight.

**O3 state: PREPARED / OPERATOR APPROVAL REQUIRED**

The candidate release is not approved, deployed, or verified by this document.
Legacy `scripts/deployment.sh` is not an O3 path. A clean checkout, an exact
approved SHA, a migration decision, and live rollback-target reconfirmation are
required before any execution.

## Candidate and known production baselines

| Area | Deployed baseline | Candidate | Runtime delta | O3 action |
| --- | --- | --- | --- | --- |
| Web | Recorded source `30fd65eda8d988804c8af208276934226e0eb67d`; Worker `ah-05-07-pages`, version `70f9d4d5-6377-4087-a405-63993382441c` | `3106537d61396b20a18a85cd6d0d74c498a91aab` | No `web/**` or `web/wrangler.jsonc` diff. Changes after the recorded web source are docs/evidence and do not require a web runtime release by themselves. | **Operator decision required:** reproduce web for AC-10 clean-release evidence, or treat this as an API-only clean release. Do not trigger the mirror automatically. |
| API/app | Cloud Run `bp7-api`, project `ah-05-07-api`, region `asia-northeast3`; revision `bp7-api-00013-qbz`, traffic `100%`; image `sha256:f0acce9e03f480bf17851e7e025b5e1e9cde3eb27c386df957c68555d701d1ee`; tag `921a35e`; operational source mapping `921a35e38261104aec1cdd7095f86a16c48f357c`; source attestation unavailable / not claimed | `3106537d61396b20a18a85cd6d0d74c498a91aab` | Runtime and build-input deltas exist since `921a35e`: observation-window read parallelization (#159), risk-signal safety gate (#210), and Python/uv dependency contract changes. | Requires clean frozen build, provenance capture, no-traffic revision, readiness, explicit traffic approval, rollback, restore, and final smoke. |
| Migrations | First four required migrations recorded as applied; check-in index not applied | Candidate contains both `20260903055923_enforce_exact_time_retention` and `20260904090000_add_challenge_checkins_challenge_user_index` | Retention migration is already in the applied first four. The composite index remains remote drift. | **OPERATOR DECISION REQUIRED**; choose neither apply nor retain automatically. |
| Docs | Current production/runtime evidence is separate from repository docs | Candidate includes post-web-baseline docs/evidence, including O1 closeout | Documentation/evidence only; no runtime delta. | No deployment action from docs alone. |
| Companion assets/R2 | Existing S3E production Worker/R2 evidence; no new R2 target in this preflight | No companion asset or R2 object diff in the candidate comparison | No R2/runtime asset delta identified. | No R2 action. Preserve the deferred integrated UI/companion findings. |
| CI/workflows | Existing repository CI and external deployment mirror | Candidate docs/evidence changes only after the recorded web source; external mirror workflow remains the deployment SSOT | CI validates controls; it does not authorize production deployment. | Run CI for this PR; do not trigger production workflows. |

This comparison does **not** say current `main` is identical to production. The
candidate is a source/release proposal whose API and dependency deltas require a
new clean-release decision.

## Candidate-vs-baseline evidence

Git history and path diffs were inspected rather than inferred:

- `30fd65eda8d988804c8af208276934226e0eb67d..3106537d61396b20a18a85cd6d0d74c498a91aab`
  has no `web/**` change. The post-baseline commits are docs/evidence commits;
  therefore the candidate has **no web runtime code change** since the recorded
  production web source.
- `921a35e38261104aec1cdd7095f86a16c48f357c..3106537d61396b20a18a85cd6d0d74c498a91aab`
  includes these API/build-relevant changes:

  | Commit / Issue | Files or change | Classification | O3 implication |
  | --- | --- | --- | --- |
  | `1e4f9ce` / #159 | `app/apis/v1/observation_routers.py`, `app/services/observation_store.py`; concurrent observation-window reads over one client | Performance-only runtime change | Must be included in the clean API build and smoke; do not treat the old image as candidate evidence. |
  | `6760451` / #210 | `app/apis/v1/risk_signal_routers.py`; legacy artifact execution removed and the endpoint remains `model_not_ready` until the reviewed input contract exists | Functional safety/runtime contract change; model execution remains unavailable | Candidate API behavior differs from the deployed operational mapping; no model execution is authorized in O3. |
  | `6760451` / #210 | `pyproject.toml`, `uv.lock`; removed direct Redis/Torch/Sentence Transformers dependencies and added bounded pandas/pyarrow/joblib AI tooling | Build/dependency runtime input change | The resulting image is not assumed bit-identical to the deployed image; record the actual digest and provenance. |
  | `6760451` / #210 | risk-signal tests and preparation tooling | Test/docs/tooling-only portions | Run repository CI in the clean checkout; do not promote a model artifact. |

- Migration diff from the API baseline contains:
  - `20260903055923_enforce_exact_time_retention.sql`: applied in the known
    first-four remote inventory; no new O3 migration decision for this file.
  - `20260904090000_add_challenge_checkins_challenge_user_index.sql`: candidate
    contains an additive `(challenge_id, user_id)` index; remote is recorded as
    **NOT APPLIED**. O3 must not silently inherit O1's non-blocking exception.

The candidate `app/Dockerfile` and `cloudbuild.api.yaml` are the inspected build
inputs. The Dockerfile installs `app` and `ai` groups with `uv sync --frozen` and
uses a floating `uv:latest` builder source; therefore frozen lockfiles do not
justify a bit-identical image claim. Capture the actual image and base-image
digests if discoverable during approved execution.

## Migration gate

**O3 migration disposition: OPERATOR DECISION REQUIRED.**

The operator must explicitly choose one of these before a release that could
consume the schema:

- **A — Apply the missing additive index:** approve production DDL separately,
  apply only the named migration through the approved production path, capture
  sanitized success and schema evidence, then continue the release gate.
- **B — Retain schema drift:** explicitly approve an O3 release that does not
  reconcile the index, confirm that the candidate does not depend on it, and
  record the accepted drift and performance boundary.

This preflight chooses neither A nor B and applies no migration.

## Clean checkout and verification plan

The operator must use a fresh clone or separate clean worktree, never a dirty
working tree. All commands below are a plan and were **not executed against
production** during this preflight.

```bash
git fetch origin
git worktree add --detach ../AH_05_07-o3-clean 3106537d61396b20a18a85cd6d0d74c498a91aab
cd ../AH_05_07-o3-clean
git status --short
git rev-parse HEAD
git --version
python --version
uv --version
node --version
npm --version
gcloud version
npx --no-install wrangler --version

uv sync --frozen --group app --group ai
npm --prefix web ci
npm --prefix web run build
python scripts/ci/verify_secret_boundary.py --web-dist web/dist

python scripts/ci/verify_deployment_smoke.py --self-test
python scripts/ci/verify_secret_boundary.py --self-test
python scripts/ci/verify_ai_toolchain.py --self-test
python scripts/ci/verify_ai_toolchain.py
python scripts/ci/verify_model_gate_1b_contract.py --self-test
python scripts/ci/verify_model_gate_1b_contract.py
uv run ruff check .
uv run ruff format . --check
uv run coverage run -m pytest app
uv run coverage report -m
```

Record only versions, commit, exit status, sanitized failures, and artifact
digests. No production mutation is allowed until the exact release SHA,
migration disposition, target identities, execution window, and release approval
are recorded.

## API no-traffic rollout and rollback plan

The following is the intended sequence, not an execution log. The operator must
fill the approved Artifact Registry image reference and capture sanitized IDs.

1. In the clean checkout, verify `HEAD` equals the approved candidate SHA.
2. Build the candidate image with the only configured Cloud Build substitution:

   ```bash
   gcloud builds submit --project ah-05-07-api \
     --config cloudbuild.api.yaml \
     --substitutions=_IMAGE="$APPROVED_IMAGE"
   ```

   Capture the Cloud Build ID, image tag/reference, resulting image digest, and
   actual base-image digest if discoverable. Do not claim frozen locks make the
   image bit-identical.
3. Deploy the image to Cloud Run with no traffic, preserving current environment,
   Secret Manager references, IAM, CORS, and service settings:

   ```bash
   gcloud run deploy bp7-api --project ah-05-07-api \
     --region asia-northeast3 --image "$APPROVED_IMAGE_DIGEST" --no-traffic
   ```

   Capture the new revision name and readiness result. If a safe direct revision
   URL is available, test only the no-auth readiness/smoke contract against it;
   do not move production traffic to test it.
4. Obtain separate operator approval after build, provenance, migration gate,
   revision readiness, and rollback targets are reviewed.
5. Move traffic to the approved new revision at `100%`, then run the public smoke.
6. Roll back to the exact previous API revision at `100%`, run the same public
   smoke, and record the rollback result.
7. Restore the approved new revision at `100%`, run final public smoke, and record
   the final revision/traffic state.
8. Do not downgrade the database. Retain or clean temporary image/revision
   artifacts only under an explicit retention decision.

No command in this section was run by this preflight.

## Web release decision and mirror plan

The deployment SSOT identifies:

- upstream: `AI-HealthCare-05/AH_05_07`
- mirror: `emotigom/ah-05-07-pages`
- workflow: `Sync deployment branch` (`sync-upstream.yml`)
- production Worker: `ah-05-07-pages`

The inspected mirror workflow checks out upstream `main`, excludes upstream
workflows, creates a deployment snapshot, and force-pushes the mirror `main`.
The latest read-only observed mirror run completed successfully and its snapshot
commit message was `sync: 3106537`; this confirms that observed snapshot matched
the candidate, but it is not a new O3 deployment or rollback rehearsal.

Because there is no `web/**` runtime diff since the recorded production web
source, the **WEB O3 ACTION is OPERATOR DECISION REQUIRED**:

- **API-only option:** do not reproduce the web; record that O3 clean-release
  evidence covers the API revision and public web remains the existing runtime.
- **Web-reproduction option:** before triggering `Sync deployment branch`, verify
  upstream `main` still equals the exact approved candidate SHA. If it differs,
  STOP. Record the prior full Worker version, new full Worker version, public
  smoke, rollback to the exact prior full version, smoke, restore to the approved
  version, and final smoke.

This preflight did not trigger the mirror workflow or any Cloudflare deployment.

## Live rollback targets and required reconfirmation

Known historical targets to reconfirm immediately before O3 execution:

- API rollback target: `bp7-api-00013-qbz`
- Web rollback target: `70f9d4d5-6377-4087-a405-63993382441c`

The preflight environment did not have authenticated `gcloud` or Wrangler
available for live target queries. Therefore these are **not claimed as current
live targets**. Before execution, the operator must run read-only inventory:

```bash
gcloud run services describe bp7-api --project ah-05-07-api \
  --region asia-northeast3 \
  --format='yaml(status.latestReadyRevisionName,status.traffic)'
npx wrangler deployments status --name ah-05-07-pages --json
npx wrangler versions list --name ah-05-07-pages --json
```

Record only the current full revision/version IDs, traffic, source/snapshot
class, and sanitized query result. Do not retain raw JSON, headers, tokens,
author information, or console output.

## Public smoke contract

The O3 smoke is no-auth deployment evidence only. It sends no authenticated
product request and performs no product write.

```bash
python scripts/ci/verify_deployment_smoke.py \
  --web-base-url "https://ah-05-07-pages.ahnsangkyoon.workers.dev" \
  --api-base-url "https://bp7-api-292436735548.asia-northeast3.run.app"
```

Required checks: web `200`, API `/live`, API `/ready`, and CORS preflight for
`GET`, `POST`, `PUT`, and `DELETE`. Record pass/fail only. O1 owns product-flow
evidence; do not repeat Synthetic A writes for O3.

## Existing evidence and deferred findings

- O1 is **COMPLETE / VERIFIED** and Issue #257 is **CLOSED**. O3 must not repeat
  Synthetic A production writes.
- Existing #151 rollback evidence is historical and does not substitute for this
  candidate's clean-release rehearsal.
- Preserve, without fixing here, the deferred integrated UI/UX findings that the
  rolling recent-7-day path can resemble challenge day 7 and the export success
  notice persists across navigation.

## Evidence fields and stop conditions

Record:

- approved candidate SHA and clean-checkout `HEAD`
- tool versions and frozen-install/build/test exit status
- migration decision and sanitized schema evidence, if explicitly approved
- Cloud Build ID, image/tag, image digest, and base-image digest if available
- no-traffic revision and readiness result
- operator approval before traffic change
- API/web current and rollback target IDs, traffic, smoke at each phase
- final restored revision/version and final public smoke
- temporary image/revision retention or cleanup decision

STOP if the candidate SHA, mirror source, image provenance, migration decision,
environment/secrets/IAM/CORS, revision, traffic, rollback target, or smoke result
is unclear; if a migration is needed without separate approval; if a web mirror
run would use a different upstream `main`; if any product write, model execution,
R2/UI change, DB downgrade, or legacy deployment script is proposed; or if a
raw secret/identifier/log must be retained.

## Operator inputs remaining

- approve exact candidate release SHA `3106537d61396b20a18a85cd6d0d74c498a91aab`
- choose migration disposition A or B
- choose web reproduction or API-only O3 scope
- reconfirm live API and Worker rollback targets with read-only queries
- provide execution window and rollback operator/role
- decide retention/cleanup policy for the new test revision and image

Until these inputs are recorded, O3 remains **PREPARED / OPERATOR APPROVAL
REQUIRED** and is not complete.

## Execution outcome and successor evidence — 2026-09-07

The sections above retain their original purpose as the historical preflight
record. They describe the gates and intended commands before execution; they
are not rewritten as though they had always been an execution log. The
operator-approved execution was completed afterward and is recorded in the
[sanitized O3 execution evidence](evidence/o3-clean-release-execution.md).

**O3: COMPLETE / VERIFIED.** The approved scope was an API-only clean release.
Web reproduction was intentionally not performed because the approved
candidate had no web runtime delta from the recorded production web source.
No Cloudflare Worker deployment, web rollback, or web restore was performed.
