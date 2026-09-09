# Living Journey Hybrid implementation checkpoint — 2026-09-09

## Latest local continuation
See [scene-local-resume.md](scene-local-resume.md) for Issue #390, corrected local-origin browser verification and repeated schema/GLB validation. The original checkpoint statements below are historical. Production remains disabled; this work is a review prototype.

## Authorization and source
Owner authorized implementation and production activation after Phase 0 chat review. Baseline main: `9361983ea00afa244da560ac62f0d533e9f9e942`. Working branch: `codex/living-journey-hybrid` (local only).

GitHub Issue creation returned HTTP 403 `Resource not accessible by integration`. No remote Issue, branch, commit, PR, merge, mirror sync or production activation was performed. Do not infer a remote artifact from this local branch name. Restore repository write access before the existing Issue/branch/PR/squash workflow.

## Completed local work
- Eight Phase 0 contract/schema files; weekday calendar policy; screen/motion/fallback/test matrices.
- Read-only forensics of 22 immutable GLBs: all source SHA-256 and sizes match; 77 unique species/clip pairs; zero texture assets and zero external binary dependencies.
- Offline bear-lite clip subset experiment: idle/rest/celebrate; 518636 -> 461680 bytes (56956 saved, approximately 10.98%). Retained accessor metadata and bytes match. Original assets are unchanged. Derivative is NOT selected at runtime and has NOT passed visual parity.
- S02-only review prototype integration. VisualStage, separate lazy renderer, seven modular procedural landmark candidates, neutral bear-lite, bounded DPR 1.25, no mixer and no persistent RAF. Visibility-gated activation, resize-demand rendering, loading timeout, image/error/context fallback and disposal.
- S10 policy remains a candidate; no S10 runtime integration or complete diorama is claimed. S05 implementation is unchanged. Other screens retain existing product behavior.

## Validation actually performed
| Check | Result |
|---|---|
| TypeScript + Vite production build | PASS |
| Existing generated companion manifest | 22/22 PASS |
| Scene policy/calendar unit tests | 4 PASS |
| JSON Schema Draft 2020-12 schema validity | PASS |
| Wrong schema version / unknown root field rejection | PASS |
| 22 GLB hash/size/structure inventory | PASS |
| Retained subset accessor metadata/bytes | PASS |
| git diff --check | PASS |
| Browser visual QA | BLOCKED: cloud browser ERR_BLOCKED_BY_CLIENT despite healthy preview |
| Browser E2E suite | NOT RUN: browser binary download timed out and ended HTTP 502 |
| Mobile/Safari performance and visual acceptance | NOT MEASURED |
| Runtime first-activation transfer | NOT MEASURED |

Build warns about a lazy shared Three chunk exceeding 500KB raw. It is approximately 161KB gzip; this warning is retained, not silenced. Actual cold transfer and task responsiveness still require browser evidence. The dependency versions and lockfile are unchanged.

## Runtime gate
`VITE_SK7_SCENE_MODE=review` permits the S02 prototype. Missing/unknown/off disables it. `production` is recognized but deliberately returns no plan until production recipes pass visual/performance acceptance. Existing `VITE_SK7_COMPANION_MODE` remains separate. Do not remove this guard merely to satisfy rollout wording.

## Remaining work in order
1. Complete schema cross-reference/provenance/budget verifier and runtime recipe integration; current JSON Schema validates structure, not all semantic constraints.
2. Measure prototype in actual browser at 320x568, 320x844, 390x844 and 1366x768. Verify focal-size bounds, shape/material quality, no clipped subjects, CSS fallback, first-use bytes, navigation and image failures.
3. Compare current body bind pose with approved neutral pose. Consider approved idle pose sampling only after visual evidence. Check camera framing and character anchor centering against actual bounds.
4. Replace/accept procedural environment candidates through asset forensics, source/provenance registration and visual acceptance. They are not finished production clay assets.
5. Build matching responsive 2.5D layers/posters. Existing S02 image is a temporary reviewed-source fallback; S10 has no new approved poster yet.
6. Resolve shared Seoul date rollover. Prototype intentionally uses the host's existing `today` snapshot, so it cannot independently drift from DOM. Existing midnight-refresh contract remains unimplemented here; preserve unsaved drafts and request-generation safeguards when addressing it.
7. Complete S02 signature composition; then S10 diorama; then S05 migration only with normal/recovery/remount/reduce/fallback exactly-once parity. Do not merge the review prototype as a finished redesign.
8. Execute existing regression/browser/privacy/model suites, real-device performance, release classification and controlled web-only rollout with rollback. API/DB/auth/model/topology/deployment semantics remain frozen.

## Resume in the owner's local checkout
Canonical local path remains `/Users/gom/Projects/AH_05_07`. First inspect branch, HEAD and working tree; preserve unrelated edits. The delivered patch is based on the exact baseline above. Apply only after checking applicability on an isolated branch. If main moved, review/rebase the narrow patch and rerun affected checks. Do not change backend or deploy from the mirror. Use the existing upstream main -> deployment mirror sync -> Cloudflare Worker flow only after release gates pass.
