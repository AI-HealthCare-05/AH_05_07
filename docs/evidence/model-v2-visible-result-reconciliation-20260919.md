# Model V2 / S11 visible local result reconciliation

> EVIDENCE — NOT CURRENT AUTHORITY
>
> Records the #642 reconciliation at its recorded source baseline.
> Current Model V2 behavior is owned by
> [the current product contract](../model-v2-product-contract.md).

Some paths inventoried below were later removed from HEAD by the documentation
lifecycle cleanup; they remain recoverable at the recorded source baseline.

Task record for [Issue #396](https://github.com/AI-HealthCare-05/AH_05_07/issues/396).
This is a scoped source audit and restart record, not policy or runtime attestation.
The [product contract](../model-v2-product-contract.md) owns current display policy.

## Phase A — read-only findings at the starting base

- Fetched canonical `origin/main`: `dbd7e9e1bf43d7ea8bc76f3452f4118a8cc04aaa`.
- Worktree: `/Users/gom/Projects/AH_05_07-model-v2-visible-result`.
- Branch: `fix/model-v2-visible-local-result` (attached; initially clean).
- Issue #396 body and 2026-09-18 comment permit the existing time-boxed plain
  decimal preview; this user's 2026-09-19 decision requires default visibility.
  The authorization window is not extended. No merge or deployment is authorized.

| Classification | Findings and authority |
| --- | --- |
| CURRENT AUTHORITY | Product contract's current decision and #396 own visibility; AGENTS owns contribution/privacy boundaries; architecture invariants own frozen model, separate facts and release identity; requirements and scene policy refer to the product contract. |
| HISTORICAL EVIDENCE | Retained T1 planning, G3–G9/R1–R3/T2–T16 research/readiness reports, ADR-0008's original non-numeric integration decision, prior production ledgers and sealed parity evidence describe their own scope/date. They are not a current instruction to disable S11. |
| STALE / CONTRADICTORY TEXT | Architecture's result-quality row forbids any provisional score and conflates the API projection with S11. Its data-classification row forbids exposure even though the intro permits preview. T1's section 8/14 and unresolved-decision list look current when deep-linked. Runtime comments about the separate two-field facade must not be read as describing the local preview return. |
| ACTIVE PRODUCTION CODE | App selects ModelV2InputFlow for signed-in non-evidence S11; unchanged draft → exact 19-field payload → adapter's 11 ordered features → SHA-verified model GET → frozen computation → continuousOutput → transient previewOutput → ModelV2Outcome. |
| TEST-ONLY / SYNTHETIC CODE | modelV2ResultState is used only by App's evidence/anonymous fallback, with query overrides gated by allowsE2eFixture. Its not_ready/result_available_not_user_visible values never control the signed-in flow. Browser parity entry and fixtures are synthetic verification, not product results. |
| ACTUAL PRIVACY / MODEL INVARIANTS | Frozen SHA/schema, exact feature semantics/order and preprocessing; age 19+, 80+ caution; no BP/challenge/prior-result/account feature join; transient memory only; asset GET is not a feature-bearing request; no inference POST/fallback/persistence/telemetry. |

Root cause: successful inference already reaches the result. ModelV2Outcome
puts the number inside a closed research disclosure after the lifestyle summary
and next action. Existing browser assertions deliberately require hidden output
until openResearch, confirming a presentation contract mismatch.

Source flow also retains requestContext generation/user guards, same-user token
refresh handling, mounted protection, pending locks and explicit-only retries.
useSeoulDate refreshes at KST midnight, visibilitychange and pageshow; submission
checks the actual clock again after inference, preventing late numeric display.

Deployment conflict: deployment-ssot calls the 2026-09-18 Worker
`07678494-b593-46ae-940f-d52e3f7d6391` current, while the 2026-09-19 S11
closeout records `f8f3ef10-fded-4b3c-95cd-399dace0bf54` for source
`3ab88f72154897cb80dffae71f93b160dc595258`. These are conflicting source
claims about currentness, not a live control-plane observation. Preserve both
dated records and mark today's serving identity unverified in this task.

## Phase B — bounded design and test contract

1. Default-visible three-decimal continuous output is the first result content,
   with its research label, non-probability/non-diagnostic limitations and precise
   local-processing privacy cue. No percent, band, threshold or severity color.
2. Keep today's starting point/lifestyle summary, state-aware navigation and
   optional 11-feature disclosure. Technical details may collapse; output may not.
3. Put pure visibility policy in `web/src/ui/modelV2VisibilityPolicy.ts`, beside
   presentation policy. `lib/model-v2` is a sealed four-module inference graph;
   adding a presentation module there would unnecessarily expire parity evidence.
4. Name the retained fixture/fallback contract explicitly synthetic. Signed-in
   tests must prove query state cannot override real results.
5. Keep one current product-contract decision; other current guidance links to it.
   Label retained historical text without rewriting historical outcomes.

| Risk / expected behavior | Direct verification |
| --- | --- |
| Numeric result hidden or misinterpreted | Signed-in actual built S11: immediately visible, no details ancestor, primary DOM/viewport position, exact frozen fixture output, three decimals, limitations visible, no percent/band/gauge. |
| Window drift or late completion | Pure policy boundary/invalid-date/nonfinite checks; browser exact KST start/end, open-result expiry, visibility/pageshow and pending-expiry tests. |
| Eligibility / invalid input / failed model | Existing under-19, age-80, incomplete/invalid combinations, missing/tampered/malformed/oversized assets, unavailable crypto, stalled body/digest, arithmetic and manual-retry tests. |
| Privacy / stale session | Existing actual-flow egress/storage/cookie/IDB/cache probes with positive leak controls; sign-out, account switch, refresh, leave/re-enter and pending guards. |
| Journey regression | Focused ui-candidate S11 → S04/S07, save → S05 → today → fresh S11, plus normal build with mocked auth inside/outside window. |
| Frozen boundary drift | Asset verifier with historical source identity and mutation tests; focused Python adapter/inference/API tests; unchanged guarded source hashes. |
| Release claim drift | No control-plane mutations/reads claimed; existing dated closeout left intact. |

Additional test inventory reviewed: model-v2-result-state synthetic states and
viewport checks; model-v2-time-wheel helper; model-v2-privacy observer;
web/tests/model-v2 verification facade and parity seal; exporter and asset
verification suites; Python Model V2 API/no-store, adapter/inference,
readiness/activation/privacy/policy transition and research-analysis test modules.
Those readiness snapshots and research-analysis suites do not control S11 display.
Scene exclusion, visual-qa synthetic S11 and seoul-date-rollover assertions keep
their existing purposes. No full unrelated browser matrix is required locally.

## Starting-base occurrence inventory

Line numbers below refer to the immutable starting base, not subsequent edits.
All requested expressions were searched repository-wide with rg. `not_ready`
also matches unrelated storage/service failures; these remain outside S11 scope.
No exact matches for `점수 표시하지`, `확률 표시하지`, `등급 표시하지` were found;
the Korean variants with particles are covered by the component/copy audit above.

| File | Starting lines | Classification / interpretation |
| --- | --- | --- |
| `AGENTS.md` | 25 | CURRENT AUTHORITY; historical/contradictory sections classified above |
| `README.md` | 30, 45 | HISTORICAL EVIDENCE; no new runtime/display authority |
| `app/apis/v1/account_routers.py` | 28 | ACTIVE PRODUCTION CODE; server/legacy or unrelated failure boundary |
| `app/apis/v1/feedback_routers.py` | 18, 21, 69, 71 | ACTIVE PRODUCTION CODE; server/legacy or unrelated failure boundary |
| `app/apis/v1/model_v2_routers.py` | 28, 36, 40, 58, 65, 113 | ACTIVE PRODUCTION CODE; server/legacy or unrelated failure boundary |
| `app/apis/v1/observation_routers.py` | 44, 47, 141, 143, 164, 166, 178, 195, 212, 248, 261, 274, 289, 334, 373 | ACTIVE PRODUCTION CODE; server/legacy or unrelated failure boundary |
| `app/apis/v1/risk_signal_routers.py` | 15 | ACTIVE PRODUCTION CODE; server/legacy or unrelated failure boundary |
| `app/dependencies/supabase_auth.py` | 38 | ACTIVE PRODUCTION CODE; server/legacy or unrelated failure boundary |
| `app/main.py` | 39, 88 | ACTIVE PRODUCTION CODE; server/legacy or unrelated failure boundary |
| `app/tests/observation_apis/test_observation_api.py` | 9, 15 | TEST-ONLY / SYNTHETIC legacy API regression |
| `app/tests/risk_signal_apis/test_risk_signal_api.py` | 18, 22, 49 | TEST-ONLY / SYNTHETIC legacy API regression |
| `docs/acceptance-test-plan.md` | 116 | HISTORICAL EVIDENCE; no new runtime/display authority |
| `docs/api-contract.md` | 64, 81, 100, 137 | CURRENT AUTHORITY; historical/contradictory sections classified above |
| `docs/api-p95-verification-preflight.md` | 62, 104, 154 | HISTORICAL EVIDENCE; no new runtime/display authority |
| `docs/architecture.md` | 7, 15 | CURRENT AUTHORITY; historical/contradictory sections classified above |
| `docs/architecture/ARCHITECTURE_INVARIANTS.md` | 20 | CURRENT AUTHORITY; historical/contradictory sections classified above |
| `docs/architecture/recovery-r10.json` | 62 | HISTORICAL EVIDENCE; no new runtime/display authority |
| `docs/character-preview-verification.md` | 6 | HISTORICAL EVIDENCE; no new runtime/display authority |
| `docs/data-feature-semantics.md` | 64 | HISTORICAL EVIDENCE; no new runtime/display authority |
| `docs/diagrams/mvp1-architecture.svg` | 16 | HISTORICAL EVIDENCE; no new runtime/display authority |
| `docs/evidence/local-reliability.json` | 762 | HISTORICAL EVIDENCE; no new runtime/display authority |
| `docs/evidence/scene-android-memory.json` | 1045, 1242 | HISTORICAL EVIDENCE; no new runtime/display authority |
| `docs/evidence/scene-ios-simulator-safari-position-fix.json` | 35 | HISTORICAL EVIDENCE; no new runtime/display authority |
| `docs/evidence/scene-phone-review-https-smoke.json` | 37 | HISTORICAL EVIDENCE; no new runtime/display authority |
| `docs/input-question-review.md` | 103 | HISTORICAL EVIDENCE; no new runtime/display authority |
| `docs/model-card.md` | 18, 123 | HISTORICAL EVIDENCE; no new runtime/display authority |
| `docs/model-gate-1b-evidence.md` | 63 | HISTORICAL EVIDENCE; no new runtime/display authority |
| `docs/model-gate-1b-runbook.md` | 8 | HISTORICAL EVIDENCE; no new runtime/display authority |
| `docs/model-input-adapter-contract.md` | 26, 132 | HISTORICAL EVIDENCE; no new runtime/display authority |
| `docs/model-promotion.md` | 55 | HISTORICAL EVIDENCE; no new runtime/display authority |
| `docs/model-release-readiness.md` | 35, 37, 108, 143, 212 | HISTORICAL EVIDENCE; no new runtime/display authority |
| `docs/model-v2-product-contract.md` | 3, 8, 18, 291 | CURRENT AUTHORITY; historical/contradictory sections classified above |
| `docs/mvp1-closeout.md` | 15, 38, 69 | HISTORICAL EVIDENCE; no new runtime/display authority |
| `docs/mvp1-submission-package.md` | 146 | HISTORICAL EVIDENCE; no new runtime/display authority |
| `docs/mvp1-validation.md` | 6 | HISTORICAL EVIDENCE; no new runtime/display authority |
| `docs/o3-clean-release-preflight.md` | 47 | HISTORICAL EVIDENCE; no new runtime/display authority |
| `docs/project-handoff.md` | 447 | HISTORICAL EVIDENCE; no new runtime/display authority |
| `docs/requirements.md` | 3, 26, 54 | CURRENT AUTHORITY; historical/contradictory sections classified above |
| `docs/research/architecture-research-run-01.md` | 18 | HISTORICAL EVIDENCE; no new runtime/display authority |
| `docs/research/model-v2-finite-reference-comprehension-contract.md` | 27 | HISTORICAL EVIDENCE; no new runtime/display authority |
| `docs/research/model-v2-r2-inference-contract.md` | 63, 133 | HISTORICAL EVIDENCE; no new runtime/display authority |
| `docs/research/model-v2-r2-inference-result.md` | 38, 39, 49 | HISTORICAL EVIDENCE; no new runtime/display authority |
| `docs/research/model-v2-r3-activation-readiness-contract.md` | 48 | HISTORICAL EVIDENCE; no new runtime/display authority |
| `docs/research/model-v2-r3-activation-readiness-result.md` | 27 | HISTORICAL EVIDENCE; no new runtime/display authority |
| `docs/research/model-v2-reference-distribution-contract.md` | 155 | HISTORICAL EVIDENCE; no new runtime/display authority |
| `docs/research/model-v2-reference-distribution-result.md` | 6, 276 | HISTORICAL EVIDENCE; no new runtime/display authority |
| `docs/research/model-v2-t10-operational-readiness-result.md` | 91, 120, 153 | HISTORICAL EVIDENCE; no new runtime/display authority |
| `docs/research/model-v2-t4-authenticated-api-result.md` | 19 | HISTORICAL EVIDENCE; no new runtime/display authority |
| `docs/research/model-v2-t6-result-state-ui-result.md` | 19, 22, 24, 28, 33, 36 | HISTORICAL EVIDENCE; no new runtime/display authority |
| `docs/research/model-v2-t8-product-readiness-result.md` | 69 | HISTORICAL EVIDENCE; no new runtime/display authority |
| `docs/s2-design-selection.md` | 58 | HISTORICAL EVIDENCE; no new runtime/display authority |
| `docs/scene-policy-contract.md` | 78, 79, 81 | CURRENT AUTHORITY; historical/contradictory sections classified above |
| `docs/upgrade-execution.md` | 241 | HISTORICAL EVIDENCE; no new runtime/display authority |
| `docs/upgrade-local-reliability.md` | 37, 46, 134 | HISTORICAL EVIDENCE; no new runtime/display authority |
| `docs/upgrade-usability.md` | 24 | HISTORICAL EVIDENCE; no new runtime/display authority |
| `docs/ux-flow.md` | 164 | CURRENT AUTHORITY; historical/contradictory sections classified above |
| `scripts/ci/verify_model_gate_1b_contract.py` | 156 | TEST-ONLY / SYNTHETIC or verification tooling |
| `scripts/model/verify_model_v2_r2_integration.py` | 184, 332 | TEST-ONLY / SYNTHETIC or verification tooling |
| `scripts/model/verify_model_v2_r3_activation_readiness.py` | 147, 170, 171 | TEST-ONLY / SYNTHETIC or verification tooling |
| `scripts/ops/verify_recovery_contract.py` | 255 | TEST-ONLY / SYNTHETIC or verification tooling |
| `tests/account_apis/test_account_api.py` | 302 | TEST-ONLY / SYNTHETIC or verification tooling |
| `tests/api/test_model_v2_api_boundary.py` | 70, 147 | TEST-ONLY / SYNTHETIC or verification tooling |
| `tests/api/test_model_v2_no_store.py` | 58, 184, 241 | TEST-ONLY / SYNTHETIC or verification tooling |
| `tests/api/test_structured_feedback_api.py` | 107 | TEST-ONLY / SYNTHETIC or verification tooling |
| `tests/health/test_health.py` | 45 | TEST-ONLY / SYNTHETIC or verification tooling |
| `tests/model/test_model_v2_r2_router_guard.py` | 4, 7 | TEST-ONLY / SYNTHETIC or verification tooling |
| `tests/model/test_model_v2_r3_activation_readiness.py` | 34 | TEST-ONLY / SYNTHETIC or verification tooling |
| `tools/local-reliability/run.py` | 475, 507 | TEST-ONLY / SYNTHETIC historical verification/presentation tooling |
| `tools/submission-slides.mjs` | 47 | TEST-ONLY / SYNTHETIC historical verification/presentation tooling |
| `web/e2e/living-cycle.cases.ts` | 47 | TEST-ONLY / SYNTHETIC or verification tooling |
| `web/e2e/model-v2-result-state.spec.ts` | 4, 7, 12, 17, 40, 43 | TEST-ONLY / SYNTHETIC or verification tooling |
| `web/e2e/model-v2-user-input-flow.spec.ts` | 472, 501, 512, 525, 548 | TEST-ONLY / SYNTHETIC or verification tooling |
| `web/e2e/recap-candidate.cases.ts` | 857, 904 | TEST-ONLY / SYNTHETIC or verification tooling |
| `web/e2e/signed-in-harness.spec.ts` | 450, 490, 529 | TEST-ONLY / SYNTHETIC or verification tooling |
| `web/e2e/usability.spec.ts` | 25 | TEST-ONLY / SYNTHETIC or verification tooling |
| `web/src/App.tsx` | 56, 374, 378, 1994 | ACTIVE PRODUCTION CODE (App branches audited separately) |
| `web/src/components/ModelV2InputFlow.tsx` | 5, 10, 69, 70, 72, 619, 621, 622, 704 | ACTIVE PRODUCTION CODE (App branches audited separately) |
| `web/src/components/ModelV2Outcome.tsx` | 41 | ACTIVE PRODUCTION CODE (App branches audited separately) |
| `web/src/lib/model-v2/runtime.ts` | 20, 123, 129 | ACTIVE PRODUCTION CODE (App branches audited separately) |
| `web/src/ui/modelV2ResultState.ts` | 3, 4, 7, 10, 20, 25, 26, 46, 47, 64 | TEST-ONLY / SYNTHETIC fallback |
| `web/tests/model-v2/verification.ts` | 3, 36, 37, 39, 41, 56 | TEST-ONLY / SYNTHETIC or verification tooling |

## Restart / verification checkpoint

Implementation and local verification are complete against the reviewed base
above. The candidate commit containing this record is the reviewed local HEAD;
its SHA and publication status are reported in the PR/final handoff. Owned paths:
the eight changed contract/reference docs, this record, App's synthetic branch
naming, ModelV2InputFlow, ModelV2Outcome/CSS, the new UI visibility policy, renamed
synthetic fallback, and four directly related E2E files. No unrelated task paths
are owned. Recover this record and its tests from the branch, not temporary logs.

Local environment: macOS, repository npm lockfile dependencies, installed
Playwright Chromium/Firefox/WebKit, existing canonical-clone Python virtualenv.
All UI/auth/API data in these checks are synthetic. No production or physical
device acceptance is claimed.

| Command / scope | Final result |
| --- | --- |
| `npm run build` (web) | PASS |
| `CI=1 npm run test:e2e:model-v2` (web) | 213/213 PASS; 71 each Chromium, Firefox and WebKit |
| `npx playwright test --config=playwright.ui-normal.config.ts --grep 'normal mocked auth'` (web) | 2/2 PASS; normal build without fixture mode, inside/outside preview window |
| `npx playwright test --config=playwright.ui-candidate.config.ts ui-candidate.cases.ts --grep 'S11 (outcome\|post-survey)'` (web) | 3/3 PASS; result → BP/detail and save → confirmation → today → fresh S11 |
| `python -m pytest tests/model/test_model_v2_input_adapter.py tests/model/test_model_v2_inference_boundary.py tests/api/test_model_v2_product_api.py tests/api/test_model_v2_no_store.py tests/api/test_model_v2_api_boundary.py -q` (existing `.venv`) | 198/198 PASS |
| `node web/scripts/verify-model-v2-assets.mjs --history --fetch-source` | PASS; historical source/asset identity retained |
| `node --test web/scripts/verify-model-v2-assets.test.mjs` | 23/23 PASS; asset/boundary mutation tests |
| `python3 scripts/ci/verify_secret_boundary.py --self-test` and `--web-dist web/test-results/ui-release/normal` | PASS; normal-built bundle and detector checks |
| `ruff check .` and `ruff format . --check` (existing `.venv`) | PASS; separate lint and formatter gates |
| Changed Markdown relative links/anchors; `git diff --check` | PASS; 17 changed links checked |
| `python3 scripts/git/autopilot_guard.py --base origin/main` | PROTECTED; PR allowed, autonomous merge prohibited |
| Synthetic local result visual inspection, 390px and 1366px | PASS; decimal and limitations appear before lifestyle summary |

The first browser run passed 209/213; four macOS WebKit keyboard tests failed
because native Tab skips buttons. An isolated HTML control reproduced this
without the app (Tab → summary, Option+Tab → button). The harness now uses
Option+Tab only on macOS WebKit, preserving the same ordered focus and viewport
assertions. The final focused three-engine rerun passed 213/213. An initial
anchored journey name filter selected no tests; the corrected command above
executed and passed all three intended tests. No failed test was skipped.

Final boundary audit: no diff in sealed `web/src/lib/model-v2`, public model
assets, parity seal/verification facade, draft/step input semantics, API/server,
Supabase, dependencies or research/evidence records. Schema remains
`model-v2-r1-schema-v1`; canonical artifact SHA-256 remains
`d0f3bc407edae83db0852e9b393831b02cc5420a49fbc447d8d108f99c69ed84`.
Frozen 11-feature order/preprocessing and `입력 기반 위험군 선별 신호` remain
unchanged. No new persistence, inference POST/fallback, telemetry/logging,
BP/challenge/prior-result/account feature join, S10/history/PDF result, or risk
semantics were introduced. Existing expiry/session/failure protections pass.

Next: commit through `scripts/git/codex-commit`, publish the single branch/PR,
check required hosted CI and await human review. No merge, auto-merge,
deployment, mirror sync or production data/config mutation. A separate approved
web deployment will be required for this source change to reach production.
No external blocker identified at this checkpoint. Hosted CI is the merge gate;
local checks above do not claim a full unrelated browser or deployment matrix.
