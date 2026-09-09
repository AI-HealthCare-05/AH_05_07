# Scene manifest verification and runtime recipes

Issue #390 / draft PR #391. Scope: S02 review only. Production remains disabled.

`web/src/ui/scene-manifest.v2.json` is the authored manifest; `sceneManifest.generated.ts` is a verified generated runtime input. `npm run prebuild` refuses a stale generated file. After an intentional manifest edit, run `node web/scripts/verify-scene-manifest.mjs --write`, review the diff, and run `npm --prefix web run test:scene-manifest`.

The verifier uses only Node built-ins and supports the exact JSON Schema keywords present in `docs/scene-asset-manifest-v2.schema.json`. Unsupported keywords fail closed, including unused schema branches. It is a scoped build verifier, not a general-purpose JSON Schema implementation. The actual manifest was also validated independently with Python jsonschema Draft 2020-12 in a temporary uv environment; project dependencies remain unchanged.

## Registered review assets

- Bear lite: exact identity, URL, bytes, owner and use-scope reference from existing companion R2 evidence; clips and unknown root-motion status match GLB forensics.
- S02 neutral poster: existing CANVA-CHAR-001 / scene.S02.homeBase. Public bytes were read and hashed; identity and existing use-scope reference are in `docs/evidence/scene-poster-source.json`. This is a temporary neutral fallback, not a finished weekday environment poster.
- Procedural landmarks: `environment.ts` is registered by local module path, SHA-256 and bytes. It has no fake R2 URL or remote delivery claim. This code-authored asset can only be review status.

The schema distinguishes remote delivery from source-module geometry with exactly one source required. Recipe status and camera/anchor fields are explicit. All seven S02 weekday recipes and a single static fallback are required. S10 and S05 are rejected by this version of the runtime verifier until separately implemented and accepted.

## Enforced invariants

- Unique IDs; known asset references; eligible asset status; immutable source/provenance identity; exact approved companion clips; no unregistered decoder or extension.
- Exactly one character and one environment per realtime recipe, and a lower-tier static poster fallback for the same screen. Missing fallbacks, cycles and duplicate weekday selections fail.
- Neutral static motion only; no S05 save event or domain-derived input is accepted.
- Orthographic realtime cameras and poster fallback composition; positive camera spans, nondegenerate camera targets, ordered subject bounds inside stage height.
- Unmeasured means null measurements, never zero. Approval requires measured entries; the procedural environment cannot become approved through a status edit.
- Reachable fallback resources are included in a conservative planning budget. Raw registered bytes plus a 250,000-byte renderer/loader reserve total 789,698 bytes for each realtime recipe. The planning gate is 900,000 bytes; neither number proves measured performance.

Runtime selection consumes the verified asset URL, fallback URL, responsive stage height, camera and world anchors. Missing/unregistered screen/landmark selection returns no plan. The default/off/production gate remains closed. The existing S05 runtime remains independent.

## Evidence and delivery constraints

Local tests: 34 manifest tests, eight Chromium review tests and five scene policy/default-off tests pass. Ruff check and format now pass repository-wide after restructuring and formatting the imported GLB scripts; the forensics output is unchanged.

`docs/evidence/scene-review-network.json` records four viewports, projected character bounds and Playwright response-size observations. The selected scene resources total approximately 699 KB in a fresh browser context. Protocol attribution limitations, semantic-shell exclusions and real-device gaps are explicit in the evidence. CI runs the manifest tests and the dedicated S02 browser suite.

Owner-provided infrastructure conditions: R2 has 8 GB available for assets and free egress. The per-activation budget manages client latency and memory; it does not ration total R2 storage or estimate egress charges. Additional image work may use the connected Canva MCP, followed by R2 registration with provenance, immutable identity and responsive delivery checks.

Shared Seoul date rollover with draft/request safeguards is implemented; see [date rollover verification](scene-date-rollover.md). Outstanding: final clay environment and matching responsive posters/layers; final-art all-weekday visual QA; S10; S05 migration parity; real-device performance and controlled rollout. No production acceptance or activation is claimed.

## Cross-platform CI follow-up

The previous character-preview isolation check matched the lazy `GLTFLoader-*.js` filename recorded by Vite in its preload map. The check now parses JavaScript using the already-installed Rollup parser and follows static imports/re-exports. Lazy filename literals are excluded from implementation-marker scanning; direct, transitive and inline Three code still fails. Five graph-boundary tests cover those cases, cycles and path escape. No test gate is removed.

Windows checkout converted the procedural source to CRLF and correctly failed the source hash check. `.gitattributes` now pins the source module, authored manifest and generated runtime manifest to LF on every platform. The hash check remains byte-exact.

Local full character-preview synthetic smoke passed: 14 clip/variant checks and 21 checks, with finalized recording. Latest CI results are tracked on PR #391; no production rollout occurs in this PR.

## Weekday visual follow-up

All seven S02 weekday recipes were rendered at 320px using a fixed synthetic date and synthetic API responses. The initial shade-tree canopy clipped at the top; its two mobile camera spans were expanded from 2.85 to 3.5. The other six mobile scene crops showed their main subjects inside the stage. The browser suite now captures all seven weekday stages for continued visual review. Screenshots are retained in `docs/evidence/scene-weekdays/`. The corrected shade-tree canopy is fully visible. These procedural geometries remain review candidates, not final clay assets.
