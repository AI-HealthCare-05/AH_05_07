# SK7 Living Journey Hybrid — scene architecture
Status: implementation authorized by owner on 2026-09-09; production activation requires the evidence gates below. Source baseline: `9361983ea00afa244da560ac62f0d533e9f9e942`. This is not a repeat architecture audit.

## Immutable boundaries
Keep topology, API/DB/auth/deployment semantics, Model V2 frozen contract, Three.js 0.185.1, raw WebGLRenderer and GLTFLoader. No new router, R3F, WebGPU, service, dependency or health inference. Existing S05 CompanionRuntimeBoundary remains its own production path.

## Composition
Semantic HTML owns all tasks, facts, dates, labels, status and controls. VisualStage reserves a responsive decorative surface; it never contains the semantic content in its Suspense/error boundary. Hierarchy: task/content, Moa or primary visual, primary landmark, secondary decoration. One large focal subject, not small scattered objects.

VisualStage -> ScenePolicy + QualityTierResolver + SceneAssetManifest -> SceneRuntimeBoundary -> lazy ThreeSceneRenderer.
StaticSceneFallback is visible before activation and after failure; CSS is the final fallback. Scene failure does not navigate, clear data, retry an API or announce a domain error.

## Ownership
- VisualStage: bounded mobile/desktop layout, one visual owner, no duplicate poster and GLB character.
- ScenePolicy: allowlisted presentation inputs only; no domain imports.
- SceneAssetManifest: exact asset identity, provenance, dependencies, camera recipes and measurements.
- QualityTierResolver: screen ceiling + reduced motion/disable + capability. Viewport chooses composition, not presumed device wealth/power.
- SceneRuntimeBoundary: eligibility before import, visibility, load timeout, stale callback isolation.
- ThreeSceneRenderer: approved geometry, camera, animation and disposal only.
- StaticSceneFallback: decorative responsive media; independent image failure.

## Calendar decision
Monday=Korean garden gate; Tuesday=Herb garden; Wednesday=Shade tree + bench; Thursday=Wooden footbridge; Friday=Reading shelter; Saturday=Traditional Korean pavilion; Sunday=Sunset overlook. Compute from Asia/Seoul date, never from signup, challenge start/check-ins, record window or results. No implicit completion/reset reward on Sunday/Monday.
The current App memoizes today; do not independently advance only the visual date. A shared presentation-date snapshot must preserve in-memory drafts and request-context safeguards. Calendar rollover runtime change is isolated from API behavior.

## Reuse
Preserve Scene/SceneShell semantic structure, journey.ts navigation and copy, r2VisualAssets logical IDs and immutable generated companion manifest. Reuse Moa/bear lite first, idle/rest and S05 celebrate only. Keep all 11 species, 77 unique (species, clip) motions and 22 variants without exposing unneeded species. Canva keyframes are composition/layer/poster sources, never full-screen bitmap UI. MAP-003 was resized from desktop and is not an acceptable new mobile master.

## Modular world
Independent gate, herb garden, tree+bench, footbridge, reading shelter, pavilion, overlook. Shared clay palette, ground/path modules, consistent Y-up/scale/origin, ground and character anchors, projected subject bounds and clipping-safe cameras. Load/display a mobile focal landmark and limited surrounding space. Sunset is fixed art direction, never a health outcome. Initial procedural prototype is not an approved immutable environment asset; asset registration/visual acceptance remains required before production.

## Rollout
Phase 0 contracts; 1 22-GLB forensics + optimization experiments; 2 calendar/transition/2.5D foundation; 3 separate SceneRuntime prototype; 4 S02; 5 S10; 6 S05 parity migration; 7 mobile/browser/performance; 8 controlled rollout; 9 optional interaction/species/R3F/WebGPU.
New scene gate defaults off and does not reinterpret VITE_SK7_COMPANION_MODE. Owner authorization does not convert unmeasured performance into a passing release gate.
