# F1 Correction Pass 02 — local implementation handoff

Completed 2026-09-24 KST in the existing worktree
`/Users/gom/Projects/AH_05_07-first-paint-f1`, branch
`fix/companion-first-paint-identity`. HEAD and fetched `origin/main` both:
`fea1519d5c640fc96c7d01ccf05de09f61d84096`. No open PRs at initial inspection.
All changes remain uncommitted. No other worktree was touched.

## Retained and corrected

Retained the interrupted owner-tree descriptor plumbing, identity-neutral S02/S10
fallback, channel/reducer direction, interaction admission guard, held-GLB/GPU
coverage, and historical-poster/source-compatibility evidence downgrade.
Corrected tier/subvisit ownership, stale-closure failure guarding, duplicate
readiness ownership, deprecated witness aliases, browser-evaluation helper scope,
race assertions, in-memory selection navigation, and the stale hosted off-test
selector. Added exact descriptor/capability negative tests, real context-loss
revocation, same-identity SPA/tier token tests, evidence-schema negative tests,
and isolated channel routing.

## Runtime design and proof

- `SceneRuntimeBoundary` owns a synchronous terminal failure ref plus its render
  state. It stays outside recipe/tier-remounted subvisits. Ready callbacks check
  that latch and mounted state; failure is not reset by motion/tier transitions.
  Route/identity unmount creates a fresh boundary; no retry or backoff was added.
- Every mounted tier-2 subvisit allocates a module-counter token. Tier 1 has no
  token. Tokens are ephemeral visit identifiers; no clock, randomness, storage,
  query, or product-identity meaning. Recipe/URL/tier keys preserve renderer
  disposal boundaries. Same-identity SPA and tier returns get different tokens.
- One SceneShell-local reducer channel owns the active visit. Activation replaces
  the previous visit; ready/failed/clear only affect the current token. Failed
  rejects ready, and reactivation of the identical visit cannot reset its phase.
  Scalar effect dependencies prevent new publication on unrelated renders.
  Deprecated witness hooks were removed; there is no parallel old provider.
- The bridge consumes the channel's active token, active screen and exact owner
  descriptor asset ID/URL, with ready phase. Local interaction additionally
  requires its own current token/readiness. DOM diagnostics do not authorize
  readiness. Existing DOM geometry measurement and Presence fences remain.
  The bridge no longer reads identity from storage.
- Same-session A→S14→B uses app navigation and the existing species selector;
  the test verifies exactly one document navigation, distinct tokens, A's deleted
  GPU fence, and no identity/target until B's held reveal is released. A cannot
  physically invoke a disposed renderer callback. Pure reducer tests cover stale
  A ready/failed/cleanup while B loads and after B is ready; no production callback
  is fabricated. A separate same-species/same-recipe return checks token freshness.
- Real `WEBGL_lose_context` exercises both loading→failed and ready→failed.
  Both revoke observed identity/targets and retain neutral failure across
  reduced-motion→normal tiers. Renderer disposal prevents later ready callbacks;
  reducer tests also reject ready-after-failed. The renderer itself is unchanged.
- Passed descriptor validation returns that exact object, or throws on mismatched
  assetId/URL/SHA/species/variant or missing required clips. All 11 species ×
  S01/S02/S05/S10 are checked; negative tests remove each required clip in test
  memory and restore it. Product active membership and review catalog stay separate.
- GPU-held S02 has a registered world-root port while the local visit remains
  loading, observed identity is none, canvas is hidden, neutral fallback is present,
  and no target exists. Release exposes the exact cat and admits existing drag.
- S10 holds GLB delivery and then GPU completion separately; neutral/loading stays
  until the exact fox reveals. There is no S10 interaction expansion.
- #713 direct drag, unsafe correction, cancel/capture/Escape/route invalidation,
  responsive placement and Guest direct placement pass. Seven renderer/Presence
  files were compared byte-for-byte against HEAD: s02PresencePlacement,
  s02PresenceArena, presenceSceneActorRuntime, companionPresenceKernel,
  PresenceSceneActorRuntimeContext, ThreeSceneRenderer and s02SceneActor.

## Evidence semantics

`scene-poster-runtime-compatibility.json` is schema v2, with historical canonical
poster bytes and historical 42/42/browser/pixel observations explicitly retained.
The current section is `f1-source-compatibility`, not runtime/pixel qualification.
`posterRecaptureClaim`, `pixelEquivalentPosterClaim`, and
`whiteRectangleRootCauseClaim` are false. All 25 current authority hashes match,
including the witness, channel module/declaration, App, Guest and journey plumbing.
The exact-schema verifier still checks binary identity, sources, stage geometry
and background. Seven negative tests reject claim/schema/hash weakening.
Local tests below are not current production observations or captured pixel proof.

## Verification

Environment: macOS arm64, Node 24.21.0, Playwright 1.62.1,
Chromium 151.0.7922.34; synthetic fixtures/local build gates. Scene/S10/review
configs use local Chromium defaults; Presence/Guest configs request SwiftShader.

| Command/scope | Result |
| --- | --- |
| `git diff --check` | PASS |
| `cd web && npx tsc --noEmit` | PASS |
| `uv run ruff check .` | PASS |
| `uv run ruff format . --check` | PASS, 253 files already formatted |
| `cd web && npm run build` | PASS; existing >500 kB chunk warning |
| `node web/scripts/verify-scene-manifest.mjs` | PASS, 55 assets / 28 recipes |
| `node --test web/scripts/scene-first-paint-channel.test.mjs` | 18 passed |
| `node --test web/scripts/scene-manifest.test.mjs` | 110 passed, includes those 18 channel tests |
| `node --test web/scripts/select-pr-browser-suites.test.mjs` | 36 passed |
| Full `playwright.scene.config.ts` | 172 passed, 1 intentionally skipped, 0 failed/flaky |
| Full S02 spatial-presence within scene run | 35 passed |
| Living-scene within scene run | 51 passed, 1 off-build-only skip |
| Diorama within scene run | 21 passed |
| Other tests imported/selected by scene config | 50 recap cases + 15 Seoul rollover passed |
| Separate companion-off scene build, exact hosted grep | 1 passed (covers skipped test above) |
| `playwright.s10-production.config.ts --workers=1` | 7 passed |
| `playwright.ui-candidate.config.ts presence-host-foundation.spec.ts` | 10 passed |
| `playwright.guest.config.ts` | 15 passed |
| `playwright.review.config.ts --workers=1` | 25 passed |
| Default config, scene-policy + companion-runtime-membership, one worker | 16 passed (7 policy + 9 membership) |

No final full suite failed or flaked. The initial focused run was **13 passed,
1 failed**: the new tier-token test tried to scroll a node during its intentional
remount. It was corrected to await the new realtime subvisit before scrolling;
the final full scene run passed it. That first run is not relabeled PASS.
Ruff is the existing repository lint/format gate; no frontend ESLint/Prettier
script is configured. The app TypeScript check/build was run separately.

## Hosted routing

Existing `.github/workflows/checks.yml` scene controls run
`npm run test:scene-manifest`, which imports the channel tests. Existing browser
scene module now runs the same control command, and its companion-off grep matches
the renamed neutral-fallback test. Explicit selector entries cover the witness,
channel/declaration, unit test and GPU harness, each selecting `scene` alone.
Selector tests assert both module routing and the exact off-test grep.
No workflow was added or modified. Current changed-path classification is
`frontend`, `web=true`, `scene=true`, `model_web=false`, `deployment=false`,
`full=false`. Browser modules selected for the entire diff are core,
journey-full, scene, guest and transcend-lab. This records routing, not a claim
that all hosted module payloads ran locally or that hosted CI has run.

## Exact task-owned paths

The status below lists all implementation paths; this handoff itself is the sixth
untracked file. Test-only Guest output created by this run was moved to `/tmp`
after completion; no pre-existing work was removed. Durable results are recorded
here; temporary logs/screenshots are not required restart dependencies.

```text
 M docs/evidence/scene-poster-runtime-compatibility.json
 M docs/scene-architecture.md
 M web/e2e/companion-runtime-membership.spec.ts
 M web/e2e/diorama-scene-review.spec.ts
 M web/e2e/living-scene-review.spec.ts
 M web/e2e/s02-spatial-presence.spec.ts
 M web/e2e/s10-production-scene.spec.ts
 M web/scripts/browser-ci-modules.mjs
 M web/scripts/scene-asset-inputs.mjs
 M web/scripts/scene-manifest.test.mjs
 M web/scripts/select-pr-browser-suites.mjs
 M web/scripts/select-pr-browser-suites.test.mjs
 M web/scripts/verify-scene-manifest.mjs
 M web/src/App.tsx
 M web/src/GuestJourneySandbox.tsx
 M web/src/components/CompanionPresenceHostBridge.tsx
 M web/src/components/JourneyRecap.tsx
 M web/src/components/JourneyToday.tsx
 M web/src/components/PresenceSceneActorInteraction.tsx
 M web/src/components/SceneShell.tsx
 M web/src/components/VisualStage.tsx
 M web/src/components/scene/scene-stage.css
 M web/src/ui/companionActiveAsset.ts
?? web/e2e/sceneGpuTestHarness.ts
?? web/scripts/scene-first-paint-channel.test.mjs
?? web/src/components/SceneFirstPaintWitness.tsx
?? web/src/components/sceneFirstPaintChannel.d.ts
?? web/src/components/sceneFirstPaintChannel.mjs
?? docs/first-paint-f1-pass-02-handoff.md
```

## git diff --stat

This is the actual tracked diff statistic; Git excludes the six untracked files.

```text
 .../scene-poster-runtime-compatibility.json        |  69 ++-
 docs/scene-architecture.md                         |   4 +-
 web/e2e/companion-runtime-membership.spec.ts       |  41 ++
 web/e2e/diorama-scene-review.spec.ts               | 101 ++++-
 web/e2e/living-scene-review.spec.ts                | 196 ++++----
 web/e2e/s02-spatial-presence.spec.ts               | 493 +++++++++++++++++++++
 web/e2e/s10-production-scene.spec.ts               |   2 +-
 web/scripts/browser-ci-modules.mjs                 |   3 +-
 web/scripts/scene-asset-inputs.mjs                 |  14 +-
 web/scripts/scene-manifest.test.mjs                |  16 +
 web/scripts/select-pr-browser-suites.mjs           |   5 +
 web/scripts/select-pr-browser-suites.test.mjs      |  12 +
 web/scripts/verify-scene-manifest.mjs              |  21 +-
 web/src/App.tsx                                    |  14 +-
 web/src/GuestJourneySandbox.tsx                    |   8 +
 web/src/components/CompanionPresenceHostBridge.tsx |  56 ++-
 web/src/components/JourneyRecap.tsx                |   6 +-
 web/src/components/JourneyToday.tsx                |   6 +-
 .../components/PresenceSceneActorInteraction.tsx   |  10 +-
 web/src/components/SceneShell.tsx                  |  22 +-
 web/src/components/VisualStage.tsx                 | 203 +++++++--
 web/src/components/scene/scene-stage.css           |   5 +
 web/src/ui/companionActiveAsset.ts                 |  21 +
 23 files changed, 1116 insertions(+), 212 deletions(-)

```

## Restart and limits

Owned paths are exactly the list above. Implementation and requested local checks
are complete; no unfinished code paths or external blocker. Next action: human
review of the uncommitted diff; publication remains outside this task. Reconcile
HEAD, status and source hashes before making further changes.

No physical-device or full cross-browser qualification, deployment observation,
poster recapture, pixel equivalence, or white-rectangle root-cause claim. F2/F3/F4,
API/DB/Auth/Model V2, active membership semantics, R2 and Cloud Run were not changed.
Historical assets remain unchanged. Hosted CI has not run because no publication
was authorized. Build warning does not constitute a runtime performance finding.

COMMIT=0
PUSH=0
PR=0
MERGE=0
DEPLOY=0
R2_MUTATION=0
