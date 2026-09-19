# SK7 Visual Factory → Runtime activation boundary

Status: architecture only; no production, test, asset, manifest, CI, or deployment change
Repository baseline: `origin/main` at `f36a9eb3aa2a44ee4a544854e712d670859d8664`
Investigated: 2026-09-19 KST

## Scope and decision

This document answers one question: what must stand between “the Factory has an
asset” and “the SK7 production runtime may select that asset”?

The current repository already has most of the necessary controls. It has a
review-only candidate inventory, binary/provenance verification, immutable
delivery evidence, generated runtime descriptors, a scene allowlist/registry,
exact build-mode gates, lazy renderers, and semantic fallbacks. The missing seam
is not a new asset platform. It is one unambiguous production lookup that every
companion renderer can consume without treating the broader published inventory
or the Factory candidate inventory as active.

The recommended architecture is therefore:

```text
Factory/archive evidence (not runtime-readable)
  → candidate intake (review-only; cannot carry activation fields)
  → technical + human review
  → immutable delivery evidence (eligible inventory)
  → generated asset descriptors (available, not automatically active)
  → checked-in active allowlist + verified registry lookup (activation authority)
  → screen/clip/framing policy (selection authority)
  → lazy renderer/load
  → poster/CSS/semantic fallback
```

Do not add a database, remote registry, runtime control plane, generic scene
engine, or a second state-management system. Do not make candidate generation,
archive refresh, upload, or generated-manifest refresh activate production.

## Repository evidence used

The baseline was resolved after `git fetch origin`; older document SHAs and
historical line references were not used as source authority.

| Concern | Current source |
| --- | --- |
| Factory authoring and local manifest | [`tools/companions/build.py`](../../tools/companions/build.py) |
| Independent GLB audit / pre-publish candidate check | [`tools/companions/glb_audit.py`](../../tools/companions/glb_audit.py), [`tools/companions/candidate_check.py`](../../tools/companions/candidate_check.py) |
| External archive inventory / preserved selection | [`tools/companions/inventory.py`](../../tools/companions/inventory.py), [`tools/companions/verify_selection.py`](../../tools/companions/verify_selection.py) |
| Repository candidate intake | [`web/asset-candidates/companion-candidates.v1.json`](../../web/asset-candidates/companion-candidates.v1.json) |
| Candidate intake verifier | [`web/scripts/verify-companion-candidates.mjs`](../../web/scripts/verify-companion-candidates.mjs) |
| Current immutable delivery evidence | [`docs/evidence/companion-r2-v1.json`](../evidence/companion-r2-v1.json) |
| Generated companion inventory | [`web/scripts/generate-companion-manifest.mjs`](../../web/scripts/generate-companion-manifest.mjs), [`web/src/ui/companionAssets.generated.ts`](../../web/src/ui/companionAssets.generated.ts) |
| Authored/generated scene inventory | [`web/src/ui/scene-manifest.v2.json`](../../web/src/ui/scene-manifest.v2.json), [`web/src/ui/sceneManifest.generated.ts`](../../web/src/ui/sceneManifest.generated.ts) |
| Scene manifest verifier | [`web/scripts/verify-scene-manifest.mjs`](../../web/scripts/verify-scene-manifest.mjs) |
| Current active scene bridge | [`web/src/ui/companionSceneRegistry.ts`](../../web/src/ui/companionSceneRegistry.ts) |
| Companion policy and production selection | [`web/src/ui/companion.ts`](../../web/src/ui/companion.ts) |
| Full-scene policy and recipe binding | [`web/src/ui/scenePolicy.ts`](../../web/src/ui/scenePolicy.ts), [`web/src/ui/sceneRecipes.ts`](../../web/src/ui/sceneRecipes.ts) |
| Shell ownership decision | [`web/src/App.tsx`](../../web/src/App.tsx), [`web/src/components/SceneShell.tsx`](../../web/src/components/SceneShell.tsx) |
| Legacy companion lazy boundary / renderer | [`web/src/components/CompanionRuntimeBoundary.tsx`](../../web/src/components/CompanionRuntimeBoundary.tsx), [`web/src/components/CompanionReviewRenderer.tsx`](../../web/src/components/CompanionReviewRenderer.tsx) |
| S02/S10 full-scene lazy boundary / renderer | [`web/src/components/VisualStage.tsx`](../../web/src/components/VisualStage.tsx), [`web/src/components/scene/ThreeSceneRenderer.tsx`](../../web/src/components/scene/ThreeSceneRenderer.tsx) |
| S05 saved-scene lazy boundary / renderer | [`web/src/components/SavedSceneBoundary.tsx`](../../web/src/components/SavedSceneBoundary.tsx), [`web/src/components/scene/SavedSceneRenderer.tsx`](../../web/src/components/scene/SavedSceneRenderer.tsx) |
| Fallback contracts | [`docs/scene-fallback-contract.md`](../scene-fallback-contract.md), [`web/src/components/StaticSceneFallback.tsx`](../../web/src/components/StaticSceneFallback.tsx) |
| Release and served-state authority | [`docs/scene-release-gates.md`](../scene-release-gates.md), [`docs/deployment-ssot.md`](../deployment-ssot.md) |
| Focused tests / CI routing | [`web/e2e/scene-policy.spec.ts`](../../web/e2e/scene-policy.spec.ts), [`web/e2e/companion-production.spec.ts`](../../web/e2e/companion-production.spec.ts), [`web/e2e/s10-production-scene.spec.ts`](../../web/e2e/s10-production-scene.spec.ts), [`web/scripts/select-pr-browser-suites.mjs`](../../web/scripts/select-pr-browser-suites.mjs), [`.github/workflows/companion-assets.yml`](../../.github/workflows/companion-assets.yml) |

## A. Current data flow

There are two deliberately different flows: a Factory/candidate flow and a
currently active delivery/runtime flow. They meet only through an explicit,
reviewed promotion change.

### A1. Factory and candidate flow

| Stage | Source of truth | Input | Output | Owner | Validation | Failure behavior |
| --- | --- | --- | --- | --- | --- | --- |
| Authoring | `tools/companions/build.py` plus the committed generator bytes | Explicit species, clean committed generator, new external output directory | `standard.glb`, `light.glb`, Blender sources, `generator.py`, `asset-manifest.json` | Local asset authoring workflow | Clean Git/source byte match before and after generation; hashes, bytes, clip list, duration, geometry metadata | Refuses in-repository/overlapping output; a failed run is not verified or active |
| Binary verification | `glb_audit.py`, `candidate_check.py` | One external candidate directory | Two immutable audit reports plus bounded candidate summary in a new external directory | Asset verification tooling | GLB structure, geometry, materials, skin, exact seven clips, duration, generator Git bytes, manifest SHA/bytes; input stability across both variants | No result directory is published on failure; no visual or release approval inferred |
| Archive inventory | External `catalog.json` plus generated per-candidate manifests, read by `inventory.py` | Explicit external asset root | External inventory JSON | Archive operator | Safe direct-file scope, selected folders only, hashes, generator digest, required files, stable controls/stats | Missing or changed artifacts are reported/fail; unselected candidates are not entered |
| Preserved selection verification | `verify_selection.py` | Supplied external inventory, asset root, optional checkpoint | Read-only pass/fail summary | Archive operator | Recreates inventory, matches catalog/inventory hashes, checks 11 selected families/77 clip pairs and explicit exclusion | Does not copy, upload, approve, or activate anything |
| Repository intake | `web/asset-candidates/companion-candidates.v1.json` | Reviewed metadata copied from external evidence | Checked-in candidate records | Product repository reviewer | Unique candidate/digest, safe relative source path, positive bounded bytes, clips, provenance; URL/object key/screen/production/active fields forbidden | Candidate stays outside runtime even when status is `review` |
| Candidate browser review | Isolated `tools/character-preview` preparation/verifiers | Candidate inventory plus the exact supplied archive | External technical review evidence | Review tooling and human reviewer | Exact candidate bytes, variants, clips, fallback, reduced motion, layout, resource bounds; product-screen review substitutes bytes only inside E2E | No active type, URL, registry, R2, or production flag is changed |

Current repository fact: the candidate intake contains 30 `review` records across
15 species keys and four variant-key forms. It intentionally contains no runtime
URL or activation flag. The World v2 records remain candidates even though
several technical, device, and human-review gates have evidence.

### A2. Active delivery and runtime flow

| Stage | Source of truth | Input | Output | Owner | Validation | Failure behavior |
| --- | --- | --- | --- | --- | --- | --- |
| Immutable delivery evidence | `docs/evidence/companion-r2-v1.json` | Already reviewed and published object identities | 22 standard/lite object records for the current 11 species | Delivery/release evidence | Exact count, bucket/prefix/origin, GET/CORS/MIME/cache evidence, bytes and SHA-256 | Generator rejects missing or mismatched evidence |
| Generated available inventory | `generate-companion-manifest.mjs` | Delivery evidence; candidate inventory is validated but is not an input | `companionAssets.generated.ts` with `assetId/species/version/variant/url/bytes/sha256` | Build tooling | Exact species and variants, verified delivery, deterministic generated source | Build/verification fails if stale or divergent |
| Scene registration | `scene-manifest.v2.json` and its verifier | Current published lite identities, scene/poster/environment evidence | Verified generated scene manifest | Scene author/reviewer | Exact delivery/provenance/clip identity, empty decoder/extensions, budgets, fallbacks, source hashes | Invalid registration or fallback blocks build |
| Active scene set | `s02SelectableCharacters` consumed by `companionSceneRegistry.ts` | 11 scene character IDs | Map of 11 active lite species descriptors | Reviewed source PR | Every scene entry must match the immutable companion descriptor; missing/duplicate/mismatched species throws | Fails closed during module initialization/build/test |
| Product selection | `companion.ts`, `scenePolicy.ts`, `App.tsx` | Exact mode, screen, confirmed-save event, non-medical saved species, reduced motion/WebGL facts | Complete selection or no selection | Product policy | Exact enums and screen/clip rules; query overrides are ignored in production | Unknown/off/ineligible returns no renderer or poster-only plan |
| Lazy module and asset load | Runtime boundary components | Complete approved selection/recipe | One lazy Three renderer chunk and at most one selected GLB | Presentation runtime | Renderer imports only after policy; scene waits for visibility and first GPU-complete frame | Error boundary/loading callback removes decoration or keeps poster; semantic UI stays live |
| Deployment activation | Reviewed source plus Cloudflare build variables and operator rollout | Merged mapping/policy and exact `journey`/`production` variables | A served Worker version | Release operator | Required CI, source/mirror/Worker identity, public smoke, signed-in affected flow, rollback target | Stop or rollback; a merged descriptor alone does not prove served activation |

Important current semantics:

- `companionAssets.generated.ts` is an **available published inventory**, not by
  itself a production activation map.
- `scene-manifest.v2.json` currently labels all 55 assets `review`, while current
  source policy can select qualified S02/S10 recipes under exact production mode.
  Therefore its `status` field is evidence/qualification state, not the production
  activation bit. Do not overload it.
- The current production-active scene identity membership is effectively the
  checked-in `s02SelectableCharacters` allowlist plus the registry cross-check.
  The field name is historical; current `sceneRecipes.ts` uses the registry for
  both S02 and S10.
- The legacy companion renderer still looks up the broader generated inventory
  directly after receiving a selection, and S05 `SavedSceneRenderer` directly
  names `companionAssetManifest.bear.lite`. Those are the two remaining lookup
  paths that should converge on the existing active registry seam.
- Current source and currently served production are distinct facts. The latest
  deployment SSOT records a served source older than this document's
  `origin/main`. A repository merge is not deployment evidence.

## B. Factory versus runtime contract

### Runtime-readable minimum

Reuse the existing generated `CompanionAsset` shape rather than introduce a new
Factory schema. A renderer-bound active descriptor needs only:

| Field | Runtime need | Notes |
| --- | --- | --- |
| `assetId` | Yes | Stable review/rollback identity; do not derive it from the filename |
| `species` | Yes | Non-medical identity selection only |
| `variant` | Yes | Current production surfaces use `lite`; review may explicitly use `standard` |
| `url` | Yes | Resolved only from verified immutable delivery evidence |
| `bytes` | Yes at build/selection boundary | Budget and exact-identity check; no need to display it |
| `sha256` | Yes at build/selection boundary | Provenance/rollback identity; do not recompute it on every ordinary request |
| required clip names | Yes as a selection precondition | Reuse `companionClips` and scene manifest evidence; do not create an open-ended animation capability language |
| `version` | Useful, already present | Review/debug/rollback label; identity remains assetId + digest |

### Keep outside runtime

The runtime must not receive or interpret:

- Factory archive layout, catalog history, rejected/old candidates, Blender
  sources, generation timing, or run bookkeeping;
- `sourceRun`/source archive paths, human-review worksheets, audit report paths,
  or production history;
- Factory `quality_status` or candidate `status` as an activation signal;
- R2 credentials, upload capability, bucket mutation capability, or release
  operator notes;
- health, model, blood-pressure, challenge, or record facts for species/asset
  selection.

`sourceRevision`/future `sourceRun` belongs in promotion provenance and evidence.
It can help reproduce or audit an asset, but it is not needed to render it.
Fallback and framing are product/surface policy, not Factory asset metadata.

## C. Activation states

A single long state machine would blur independent facts. Use three orthogonal
classifications instead:

1. **Candidate review state**: `candidate` or `review` in the candidate inventory.
   Neither is runtime eligible.
2. **Delivery eligibility**: exact bytes have qualified immutable delivery
   evidence and appear in the generated available inventory. Eligible does not
   mean active.
3. **Activation/deployment state**:
   - inactive: not referenced by the checked-in active allowlist;
   - active-in-source: explicitly referenced and verified by the active registry;
   - served: a specific reviewed build carrying that mapping is deployed under
     the exact production gates.

This is intentionally smaller than
`candidate → verified → registered → production-eligible → active` as one
mutable record. The repository already records verification in separate immutable
evidence. The one new architectural rule is that production selection must resolve
through active membership, not merely through availability.

## D. Activation authority

The closest existing authority is the checked-in scene allowlist plus
`companionSceneRegistry.ts`. Keep it human-reviewed and deterministic.

Production activation requires all of the following, with no inference between
them:

1. immutable delivery evidence contains the exact asset ID, bytes and digest;
2. generated descriptors reproduce that evidence;
3. a reviewed source PR changes active membership or the asset identity behind
   an existing member;
4. build checks resolve every active member and required clip/capability;
5. the affected runtime tests and release qualification pass;
6. a release operator deploys the exact reviewed source with exact production
   build gates.

Factory runs, archive changes, candidate intake, review PASS, or object upload
must never edit active membership automatically. A generator may verify or
materialize descriptors, but it must not decide membership.

Rollback is two-layered:

- source rollback: revert the active mapping/descriptor change to the previous
  asset ID/digest;
- served rollback: route back to the previous verified Worker/build variables.

Do not delete or overwrite the previous content-addressed/versioned object as
part of activation.

## E. Runtime selection

### Current selection rules

| Surface | Current selector | Species | Variant | Clip/motion | Framing / fallback |
| --- | --- | --- | --- | --- | --- |
| S01 narrator | `resolveLoginCompanion` | saved non-medical preference; invalid becomes bear before selection | fixed `lite` | fixed `greet` | `login-narrator`; legacy renderer failure removes decoration |
| S02 full scene | `App` ownership + `resolveScenePlan` + `resolveS02CharacterRecipe` | saved preference when companion mode is not off; null forces poster | active registered `lite` | neutral static scene | scene recipe camera/profile; poster then CSS |
| S10 full scene | explicit Journey production ownership + `resolveS10CharacterRecipe` | saved preference; invalid becomes bear | active registered `lite` | neutral static plus bounded optional look cue | diorama profile; poster then CSS; separate companion suppressed |
| S10 legacy fallback | `resolveProductionCompanion` when full scene does not own decoration | saved preference | fixed `lite` | `idle` | default companion framing; decorative null on error |
| S05 legacy companion | `resolveProductionCompanion` after confirmed save | fixed bear | fixed `lite` | `celebrate_then_idle` | `journey-s05`; semantic confirmation and CTAs remain outside |
| S05 saved scene | `allowsSavedScene` after confirmed event | fixed bear | direct current bear-lite descriptor | one celebrate opportunity, then static idle | verified byte cache; CSS/semantic S05 on failure |
| Review companion | explicit validated query on allowed screens | active `CompanionSpecies` only | explicit `lite` or `standard` | allowed/conditional clip policy | review-only, exact query, fail closed |

There is no automatic device-based standard/lite choice. Production deliberately
uses `lite`. Device/performance and reduced-motion constraints select a rendering
tier or stop motion; they do not silently substitute an unreviewed binary.

### Hard-coded policy versus registry data

Keep hard-coded because it is product policy:

- S05 is bear-lite and confirmed-save-only;
- S01 is greet; S10 fallback is idle; S05 is celebrate then idle;
- production surfaces use lite until a separately measured decision changes it;
- saved identity is non-medical and health/model/challenge facts cannot select it;
- framing profiles and S02/S10 scale overrides are presentation policy.

Move behind the verified active lookup because it is asset identity:

- the exact `assetId`, URL, bytes and digest used by production;
- direct `companionAssetManifest.bear.lite` access in `SavedSceneRenderer`;
- production renderer lookup based only on the broader available manifest.

Do not create a generic scene engine or data-drive all screen behavior.

## F. Failure and fallback

| Failure | Current behavior | Minimum future contract |
| --- | --- | --- |
| Active registry entry missing | Scene registry throws/fails closed; policy may return no plan | CI/build must reject an unresolved active entry. Production must not fall through to an available-but-inactive candidate |
| Remote file missing / HTTP failure | GLTF loader fails; direct companion disappears, full scene keeps poster, S05 keeps semantic/CSS surface | No automatic alternate asset or write retry. Keep current-visit fallback and navigation/forms available |
| Hash/byte mismatch | Generated manifests are checked against evidence; S05 additionally hashes fetched bytes at runtime | Block promotion/build/deployment evidence. Preserve S05's existing check, but do not add per-request hashing to every renderer |
| GLB parse/load/context/chunk failure | Error boundaries/callbacks remove decoration or preserve poster; one stale-chunk reload exists at the app boundary | At most the existing bounded recovery; then poster/CSS/semantic fallback, no infinite retry |
| Incompatible/missing clip | Companion renderer verifies the seven-name set; scene renderer requires idle; S05 requires celebrate and idle | Reject at promotion/build for required surface clips; retain runtime defensive check and fallback |
| Unsupported optional capability | S10 look marks itself unavailable if expected head bone is absent; core scene remains | Required capability blocks that activation; optional capability degrades locally without changing product facts |
| Device/performance constraint | Full scenes use poster when WebGL2 is unavailable; current production asset remains lite | Prefer registered lite, then Tier 1 poster/Tier 0 CSS. Do not select standard or a new asset from user-agent guessing |
| Reduced motion | Full scenes use poster and do not import/request GLB; legacy companion loads a neutral static model without mixer/RAF/tactile; S05 skips celebration and settles neutral | Preserve the per-surface behavior and zero semantic loss; do not force one universal implementation in this slice |
| Poster/image failure | Image removes itself; CSS and semantic UI remain | No toast, state mutation, or automatic promotion/retry |

The health journey, save/recovery controls, and factual content never depend on a
visual asset succeeding.

## G. Integrity and provenance

| Phase | Required checks | Explicitly not required |
| --- | --- | --- |
| Factory creation | Generator source/commit identity, new external output, per-file bytes/SHA, manifest, GLB structure and animation contract | Production URL, active status, upload credentials |
| Intake/review | Candidate metadata validation; when an archive is supplied, recompute candidate bytes/SHA and compare with the canonical record; preserve review evidence | Trusting metadata without bytes; reading the entire archive when only selected direct files are needed |
| CI/build | Resolve each active ID to one eligible immutable descriptor; verify variant, digest, required clips, registered decoder/extensions, scene budget/fallback, and deterministic generated source | Network fetch on every ordinary build if unchanged public delivery evidence is already pinned |
| Deployment | Confirm exact source/mirror/Worker/build variables; for a newly activated object, verify public delivery identity/headers and affected smoke; retain rollback target | Rehashing every historical object on every deployment |
| Runtime | Load only the selected descriptor; keep defensive parser/clip/error boundaries and existing S05 byte check | SHA-256 recomputation for every production request; archive/provenance history in the browser |

Immutable/versioned object keys plus SHA-256 provide reproducible rollback
identity. `sourceRun` is useful in evidence that explains how an eligible object
was produced, but activation and rollback should name the published `assetId`,
object identity, digest, reviewed source commit, and served Worker/build.

## H. Testing boundary

### Unit/build-contract checks

- active descriptor resolves to exactly one eligible published asset;
- candidate-only or inactive asset cannot resolve through the production lookup;
- every active species deterministically selects its current lite descriptor;
- active ID/species/variant/digest drift fails closed;
- surface-required clips are present; invalid clip/capability is rejected;
- candidate inventory continues to forbid URL, object key, screen, production,
  and active fields;
- generated companion and scene manifests remain deterministic and current.

### Focused browser checks

- off/unknown gates import no renderer and request no GLB;
- production S01/S02/S10/S05 requests the descriptor selected by the active
  registry, with one character owner and no inactive/standard request;
- missing/404/parse/context/chunk failures keep semantic controls and the correct
  poster/CSS fallback;
- reduced motion preserves current per-surface request and motion behavior;
- lazy import remains after policy/visibility gates;
- request count remains bounded (one selected GLB; no candidate probing or
  fallback cascade);
- S05 still celebrates only after confirmed persistence and never replays.

### Release review

An activation PR is protected-boundary work. It needs an explicit Issue/approval
record, directly affected checks, required `lint` and `test`, exact final-candidate
delivery evidence, and rollback identity. It does not require every species ×
browser × viewport combination by default. A new binary or changed renderer,
motion, media, or device boundary triggers only the conditional physical/browser
checks named by the scene release gates.

## I. Minimum seam

The smallest useful seam is **one verified active descriptor lookup**, built on
the existing `companionSceneRegistry.ts` membership and cross-checks.

The first implementation should make that module expose the complete current
active lite `CompanionAsset` descriptor, not just `{id, species, url, sha256}`.
Production consumers then receive an already-resolved descriptor:

```text
checked-in s02SelectableCharacters membership
  + generated eligible companion descriptor
  + scene-manifest identity cross-check
  → getActiveCompanionAsset(species)
  → { assetId, species, version, variant: "lite", url, bytes, sha256 }
```

Review mode may continue to resolve explicit standard/lite entries from the
broader generated inventory. Production mode, S02/S10 recipes, and S05 must use
the active lookup. This keeps review breadth without allowing availability to
become production activation.

Do not rename the historical manifest field, rewrite the scene manifest, add a
new JSON schema, or migrate all presentation policy in this first slice.

## J. Options

| Option | Required change | Advantages | Risks | Migration cost | Rollback | Fit for current SK7 |
| --- | --- | --- | --- | --- | --- | --- |
| 1. Keep hard-coded/runtime-local lookups | No architecture change; continue direct generated-manifest access and fixed bear-lite access | Zero immediate code change; existing behavior is well tested | “available” and “active” remain easy to confuse; three production paths can drift; promotion review must reason across multiple lookups | None now, increasing with each promotion | Revert each consumer and manifest change separately | Acceptable only while no new asset is promoted; weak for the stated Factory boundary |
| 2. Lightweight checked-in active lookup | Extend existing `companionSceneRegistry.ts` to return a normalized active descriptor; route production companion and S05 lookups through it | Reuses current evidence, manifest, types, allowlist, and failure model; deterministic, reviewable, reversible; no service/schema/dependency | Historical `s02SelectableCharacters` name remains awkward; focused rewiring must preserve review behavior | Small, one coherent PR | Revert registry/consumer commit or prior allowlist; deployment can also switch visual gates off | **Recommended** |
| 3. Broader declarative registry architecture | New schema for surfaces, capabilities, states, fallbacks, promotion records, generator, and migration of scene/legacy/S05 policy | One expressive data model and future automation potential | Duplicates current scene/policy contracts, invites generic-engine scope, creates more status semantics and a larger activation blast radius | High | Complex schema/data/code rollback | Not justified by current SK7 requirements |

## K. First implementation slice

This is a proposal for the next task, not an implementation performed here.

### Characterization/test-first guard

Before the production refactor, add a focused characterization that freezes:

- the 11 current active species each resolve to their exact existing lite
  `assetId` and digest;
- a candidate-only species/optimized variant is absent from production
  resolution even though candidate metadata exists;
- review can still select current standard/lite entries explicitly;
- S05 remains fixed bear-lite and S02/S10 preserve saved-species behavior;
- reduced-motion and failure request counts do not change.

### Exact files likely changed

Test/characterization first:

- `web/e2e/scene-policy.spec.ts`
- `web/e2e/companion-runtime.spec.ts`
- `web/e2e/companion-production.spec.ts` only for the existing production request
  identity regression if the unit-style checks are insufficient

Production refactor:

- `web/src/ui/companionSceneRegistry.ts` — expose the complete verified active
  descriptor and retain all current scene-manifest/generated-manifest cross-checks;
- `web/src/components/CompanionRuntimeBoundary.tsx` — resolve production through
  the active lookup before lazy import, while review keeps explicit available
  inventory lookup;
- `web/src/components/CompanionReviewRenderer.tsx` — receive a resolved descriptor
  instead of deciding asset identity itself;
- `web/src/components/scene/SavedSceneRenderer.tsx` — obtain fixed bear-lite from
  the active lookup while preserving its current byte/hash cache and behavior.

`web/src/ui/sceneRecipes.ts` already consumes `getActiveSceneCharacter`; change it
only if the descriptor type can be reused without expanding the diff.

### Files explicitly untouched

- `web/asset-candidates/companion-candidates.v1.json`
- `docs/evidence/companion-r2-v1.json`
- `web/src/ui/companionAssets.generated.ts`
- `web/src/ui/scene-manifest.v2.json`
- `web/src/ui/sceneManifest.generated.ts`
- `docs/scene-asset-manifest-v2.schema.json`
- all GLB/WebP/PNG/Blender/archive files
- Factory and preview tooling
- CI workflows and deployment manifests/settings
- API, DB, auth, Model V2, Journey behavior, and animation-controller ownership

### Expected commit sequence

1. `test(web): characterize active companion asset resolution`
2. `refactor(web): route production companion assets through active registry`

Use `scripts/git/codex-commit` for Codex-authored commits. Keep the slice in one
short protected-boundary branch/PR; do not split it by screen.

### Verification for that slice

- candidate inventory verifier and tests;
- companion and scene manifest verification;
- TypeScript/Vite build;
- focused companion production, scene policy, saved-scene, and S10 production
  checks selected by the repository's browser-suite router;
- required final `lint` and `test` CI.

No broad browser matrix or new physical-device run is required if the descriptor
refactor leaves renderer/media/motion behavior and exact asset bytes unchanged.

### Definition of Done

- every production companion GLB identity is resolved through one checked-in,
  verified active lookup;
- review-only available descriptors remain usable only in review paths;
- candidate inventory cannot affect active resolution;
- current URLs, bytes, hashes, clips, request counts, lazy boundaries, fallback,
  reduced motion, and screen ownership are unchanged;
- no asset, manifest, Factory archive, CI, deployment, API, DB, auth, Model V2,
  or Journey semantic change is included;
- the PR is reviewable and rollback is a source revert; no auto-merge for this
  protected-boundary change.

## Recommended minimum architecture

Reuse the current immutable delivery evidence, generated companion descriptors,
scene allowlist, and `companionSceneRegistry.ts`. Treat the generated manifest as
the eligible/available inventory and the checked-in allowlist/verified registry
as production activation authority. Pass a resolved descriptor to renderers;
keep screen, clip, framing, ownership, and fallback policy in their current
modules. Deployment remains a separate operator decision.

## Recommended exact first implementation slice

Add characterization for the current 11 active lite identities, extend
`companionSceneRegistry.ts` with one complete active-descriptor resolver, and
route `CompanionRuntimeBoundary`/`CompanionReviewRenderer` plus
`SavedSceneRenderer` through it without changing any identity or behavior.
Leave the already-registry-driven S02/S10 recipe path intact unless a type-only
reuse is trivial.

## Things explicitly NOT to build

- no database-backed or remote asset registry;
- no runtime asset-control API or admin UI;
- no Factory-to-production auto-promotion;
- no new worker, server, queue, Redis, LLM, OCR, or deployment topology;
- no generic scene engine, renderer unification, event bus, or new state framework;
- no AnimationController extraction or renderer rewrite;
- no per-request SHA-256 verification across all renderers;
- no broad Factory schema rewrite or candidate-history exposure to the browser;
- no deletion/overwrite of prior immutable assets;
- no species × browser × viewport mega-matrix.

## Abort conditions

Abort the first slice before production writes if any preflight shows that:

- active membership cannot be proven from current checked-in manifest/evidence;
- the resolver would need to accept candidate inventory, archive paths, Factory
  status, or remote mutable configuration;
- a currently selected asset ID/digest/variant would change unintentionally;
- the change requires scene-manifest/schema regeneration or asset publication;
- S05 confirmed-save semantics, S02/S10 single-owner behavior, reduced motion,
  fallback, lazy loading, or request counts would change;
- health/model/challenge/record facts would enter asset selection;
- the work expands into renderer unification, animation-controller redesign, a
  new service/dependency, or deployment;
- required focused tests reveal behavior not captured by this design.

## External evidence required

No external Factory archive or original ZIP is required to accept this
architecture or implement the no-behavior first seam. Current active identities,
candidate isolation, delivery evidence, selection, and fallback are all provable
from the repository.

For a later promotion of a specific Factory candidate, request only the selected
candidate evidence needed at that gate:

- the exact selected GLB(s) and their Factory/asset manifest or a bounded archive
  path that proves bytes, SHA-256, clips, variant and source revision;
- immutable publication/object-key and public delivery evidence for the exact
  promoted digest;
- any still-required physical-device/release evidence for that binary and
  surface.

The full original ZIP is unnecessary unless the selected artifact cannot be
reproduced or verified from the bounded manifest and files. These inputs affect
eligibility and release qualification, not the architecture of the active lookup.

## Open questions

1. Should a future active allowlist remain one shared 11-species lite set for
   S01/S02/S10, or should a proven product need introduce surface-specific
   membership? Current evidence supports the shared set plus fixed S05 bear.
2. Should promotion require all seven clips forever, or only the clips/capabilities
   used by an activated surface? Keep the current seven-clip contract until a real
   candidate demonstrates a need to narrow it.
3. Who records the explicit human activation approval for the next candidate
   promotion Issue/PR, separate from art acceptance and delivery evidence?
4. Are physical iPhone/iPad checks still required for the next World v2 promotion,
   or will the release owner narrow them under the current conditional scene gates?
5. Should the historical `s02SelectableCharacters` field be renamed in a later
   manifest migration? It should not be renamed in the first seam.

## Codex가 발견한 추가 개선 가능성

- `verify-production-web-env.mjs` validates required public API/Supabase variables
  but does not currently reject a mistyped/missing expected UI/scene/companion
  production tuple. Runtime parsing fails closed, which is safe, but a later
  deployment guard could detect unintended visual deactivation before publish.
- The specialized companion-assets workflow path list does not include every
  candidate-intake/registry file that the browser-suite router knows about.
  Review path routing before the first activation PR so active-registry changes
  cannot miss the intended focused gate.
- Several historical documents describe older closed production scene behavior,
  older manifest counts, or an older renderer reserve. Current source and
  deployment SSOT correctly take precedence, but a separate docs-only cleanup
  would reduce review ambiguity.
- The scene manifest's `status: review` and production-selectable source behavior
  are easy to misread. Documenting `status` as qualification-only beside the
  manifest schema would help, without turning it into an activation field.
