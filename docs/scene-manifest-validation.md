# Scene manifest verification and runtime recipes

Issue #390 / draft PR #391. Scope: S02 and S10 review only. Production remains disabled.

`web/src/ui/scene-manifest.v2.json` is the authored manifest; `sceneManifest.generated.ts` is a verified generated runtime input. `npm run prebuild` refuses a stale generated file. After an intentional manifest edit, run `node web/scripts/verify-scene-manifest.mjs --write`, review the diff, and run `npm --prefix web run test:scene-manifest`.

The verifier uses only Node built-ins and supports the exact JSON Schema keywords present in `docs/scene-asset-manifest-v2.schema.json`. Unsupported keywords fail closed, including unused schema branches. It is a scoped build verifier, not a general-purpose JSON Schema implementation. The actual manifest was also validated independently with Python jsonschema Draft 2020-12 in a temporary uv environment; project dependencies remain unchanged.

## Registered review assets

- Bear lite: exact identity, URL, bytes, owner and use-scope reference from existing companion R2 evidence; clips and unknown root-motion status match GLB forensics.
- S02 weekday posters: 21 WebP files (seven landmarks × three independently rendered viewport profiles), captured from the registered scene and bear. Local review paths, binary hashes, dimensions, camera/source hashes and character rights reference are in `docs/evidence/scene-clay-posters.json`. Canva contracts inform visual direction; these are repository scene renders, not new Canva exports. Public delivery at the registered `sk7-companion.gkrry.com` origin is verified separately by `docs/evidence/scene-clay-r2.json`. The previous generic neutral poster evidence remains historical.
- S10 diorama posters: 21 additional WebP files use independent mobile320/mobile390/desktop captures, recorded in `docs/evidence/scene-diorama-posters.json` and publicly verified in `docs/evidence/scene-diorama-r2.json`. `diorama.ts` composes the registered landmark module and is pinned separately by source hash and size. Both environment modules count toward S10 budgets.
- Clay landmarks: `environment.ts` is registered by local module path, SHA-256 and bytes. Rounded wood, rolled roof tiles, clustered plants and a shared ground/path use existing Three addons and merged palette geometry. This code-authored asset remains review status.

The schema distinguishes delivery from source-module geometry with exactly one source required. There are 45 assets and 28 recipes: seven realtime recipes and seven matching static fallbacks for each of S02 and S10. Each fallback maps mobile320/mobile390/desktop to one exact poster. S05 and every other screen remain rejected by this runtime verifier.

## Enforced invariants

- Unique IDs; known asset references; eligible asset status; immutable source/provenance identity; exact approved companion clips; no unregistered decoder or extension.
- Exactly one character and an explicit root environment per realtime recipe, with the exact geometry dependencies for its screen (S02: landmark module; S10: landmark and diorama modules), and a lower-tier static poster fallback for the same screen and weekday. Missing fallbacks, cycles, duplicate weekday selections and wrong poster profiles fail.
- Poster authoring paths are restricted to content-hashed files under `/scene-review/s02/v1/` or `/scene-review/s10/v1/`, with strict screen-specific IDs and paths. Remote URLs additionally require exact public GET evidence for the same identity at `https://sk7-companion.gkrry.com`, including HTTP 200, WebP MIME, allowed-origin CORS and the observed 4-hour cache policy. Actual WebP bytes, dimensions, source hashes, character rights and captured composition are verified. Matching metadata alone cannot authorize another URL or path.
- Neutral static motion only; no S05 save event or domain-derived input is accepted.
- Orthographic realtime cameras and poster fallback composition; positive camera spans, nondegenerate camera targets, ordered subject bounds inside stage height.
- Unmeasured means null measurements, never zero. Approval requires measured entries; the procedural environment cannot become approved through a status edit.
- Reachable fallback resources are included in a conservative planning budget. Character/environment bytes plus a 250,000-byte renderer/loader reserve and the largest mutually exclusive poster variant total 800,175–805,187 bytes per S02 realtime recipe and 841,029–844,147 bytes per S10 realtime recipe. The planning gate is 900,000 bytes; neither number proves measured performance.

Runtime selection consumes the verified asset URLs, responsive stage height, camera and world anchors. One poster is requested for the current viewport profile. Its fixed vertical scale matches the orthographic camera; changing width crops horizontal margins. Image failure is isolated and resets for a new asset/profile or weekday. Missing/unregistered screen/landmark selection returns no plan. The default/off/production gate remains closed. The existing S05 runtime remains independent.

## Evidence and delivery constraints

The manifest suite contains 71 checks, including binary tampering, incorrect dimensions/profile/weekday, render-source drift and largest-variant budget accounting. Current browser results and authoring instructions are recorded in [S10 diorama](scene-s10-diorama.md), with historical S02 details in [S02 clay posters](scene-clay-posters.md). Shared capture provenance now includes the stylesheet, VisualStage, recipe selection and policy as well as renderer, environment and capture script. A shared-source edit requires both screens to be recaptured; an S10-only geometry/camera edit requires S10 recapture. Earlier Ruff/forensics results are unchanged by this visual increment.

`docs/evidence/scene-review-network.json` is the earlier primitive-scene observation (approximately 699 KB), not a measurement of the clay increment. New browser attachments include poster requests and scene response sizes. Protocol attribution limitations, semantic-shell exclusions and real-device gaps still apply. CI runs the manifest tests and the dedicated S02/S10/date browser suite.

Owner-provided infrastructure conditions: R2 has 8 GB available for assets and free egress. The per-activation budget manages client latency and memory; it does not ration total R2 storage or estimate egress charges. Additional image work may use the connected Canva MCP, followed by R2 registration with provenance, immutable identity and responsive delivery checks.

Shared Seoul date rollover with draft/request safeguards is implemented; see [date rollover verification](scene-date-rollover.md). Clay composition and responsive posters are implemented as review candidates. R2 upload and all 42 public poster deliveries are verified; application deployment remains separate. Outstanding: final art acceptance, S05 migration parity, real-device performance and controlled rollout. No production acceptance or activation is claimed.

## Cross-platform CI follow-up

The previous character-preview isolation check matched the lazy `GLTFLoader-*.js` filename recorded by Vite in its preload map. The check now parses JavaScript using the already-installed Rollup parser and follows static imports/re-exports. Lazy filename literals are excluded from implementation-marker scanning; direct, transitive and inline Three code still fails. Five graph-boundary tests cover those cases, cycles and path escape. No test gate is removed.

Windows checkout converted the procedural source to CRLF and correctly failed the source hash check. `.gitattributes` now pins the source module, authored manifest and generated runtime manifest to LF on every platform. The hash check remains byte-exact.

Local full character-preview synthetic smoke passed: 14 clip/variant checks and 21 checks, with finalized recording. Latest CI results are tracked on PR #391; no production rollout occurs in this PR.

## Weekday visual follow-up

The initial primitive scene and corrected shade-tree captures remain in `docs/evidence/scene-weekdays/` as historical evidence. The clay increment uses new mobile and desktop cameras, with 21 matching poster exports under `web/public/scene-review/s02/v1/`. The browser suite captures both realtime and poster versions at all three master widths, and checks subject size at intermediate breakpoint widths. Final visual acceptance remains open.
