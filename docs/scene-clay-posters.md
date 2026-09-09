# S02 clay scene and responsive posters

Issue #390 · draft PR #391 · `codex/living-journey-hybrid`. This increment remains review-only. Production scene activation, merge and application deployment are not included.

## Implementation

Seven weekday landmarks now share rounded clay geometry, a connected ground/path, wood/stone/sage/lavender colors and a neutral bear pose. Roof tiles, garden plants, bridge rails, shelter and pavilion are authored with existing Three.js 0.185.1 geometries. Geometry is merged by palette. ACES tone mapping and a small static alpha contact shadow provide consistent lighting without dynamic shadow passes, animation mixers or a frame loop. DPR remains capped at 1.25.

Each weekday has a static fallback containing that same bear and landmark. Three distinct scene renders use the registered mobile320, mobile390 and desktop cameras; mobile masters are not scaled desktop exports. The runtime selects one poster for the viewport profile and preserves vertical scale at intermediate widths. Ready WebGL removes the poster; failed imagery leaves the decorative CSS surface and semantic HTML controls. Changing profile or Seoul weekday resets image failure for the new asset.

There are 23 registered assets and 14 recipes. All 21 WebP files together occupy **341,504 bytes**; each is **9,964–27,328 bytes**. A single activation includes only its current profile. The conservative renderer/character/environment/largest-poster plan is **800,175–805,187 bytes**, below the 900,000-byte planning gate.

| Profile | Viewport | CSS stage | Export pixels | Projected bear height |
| --- | --- | --- | --- | --- |
| mobile320 | 320 × 844 | 256 × 200 | 514 × 402 | 133.87 CSS px |
| mobile390 | 390 × 844 | 326 × 240 | 654 × 482 | 160.64 CSS px |
| desktop | 1366 × 900 | 1069 × 360 | 2140 × 722 | 213.69 CSS px |

Chromium screenshots use a 2× device scale; the renderer retains its 1.25 DPR cap. The screenshot boundary rounds fractional CSS origins outward by one CSS pixel, recorded in the exact binary dimensions. These exports are not high-resolution offline renders. The source capture observed 27–28 draw calls and 22,238–26,654 triangles for the complete visible scene. Those observations do not constitute GPU, memory or real-device acceptance.

## Provenance and delivery

`docs/evidence/scene-clay-posters.json` records every binary hash, byte count, dimensions, viewport, camera composition hash, renderer/environment/capture-script hashes and existing bear rights reference. The verifier reads actual WebP bytes and frame dimensions; source drift, incorrect weekday/profile selection, unauthorized paths and fallback mismatch fail the normal build.

Canva designs `DAHUPjn8shI` and `DAHUPjDn-Rw` were read as visual direction and register references. These pixels are repository-authored scene captures, **not new Canva generation or exports**. The existing bear-lite binary and its registered use-scope remain unchanged. No semantic text or user records are embedded in images.

All 21 exact WebP files were uploaded through the authenticated Cloudflare dashboard to `sk7-assets-prod/scene-review/s02/v1/` on 2026-09-10 KST. The destination prefix was empty before upload. The registered runtime URLs now use `https://sk7-companion.gkrry.com`; local originals remain under `web/public/scene-review/s02/v1/` for byte verification and reproducible authoring.

`docs/evidence/scene-clay-r2.json` records public GET status, SHA-256, bytes, MIME, CORS, ETag and cache headers for every object. All 21 returned the exact captured bytes with `image/webp` and the existing permitted origin `http://127.0.0.1:4173`. The observed CDN policy is **`cache-control: max-age=14400` (4 hours)**. No `immutable` response directive is claimed or newly configured; hash-addressed keys must not be overwritten. Dashboard login was sufficient for upload; no Wrangler credentials or wider OAuth scopes were created.

Remote registration requires matching capture identity and delivery evidence at the exact registered origin/key. A missing proof, duplicate identity, hash/size mismatch, wrong MIME/CORS/cache observation or modified URL fails validation. Re-registration preserves verified delivery for identical art; newly captured bytes remain local until independently uploaded and verified.

R2 capacity/egress terms are separate from client transfer and memory budgets. No worker, service, package dependency or bucket configuration was added.

## Reproduce intentional art changes

From the repository root, with port 4173 free and Playwright Chromium installed:

```sh
node web/scripts/capture-scene-posters.mjs
node web/scripts/register-scene-posters.mjs
npm --prefix web run test:scene-manifest
npm --prefix web run build
```

The authoring command builds an isolated temporary review preview from the authored manifest, with synthetic dates and API fixtures. This permits a deliberate source/camera edit to be recaptured before verification. It never replaces the generated runtime module or deploys that temporary build. Registration verifies the complete replacement before writing authored/generated manifests; normal prebuild still refuses stale data. Inspect the new WebP files and remove superseded local exports after reviewing the manifest diff. Keep existing hash-addressed R2 objects until an explicit retention decision.

After an authorized upload of new files, verify public delivery and register it with:

```sh
node web/scripts/verify-scene-poster-delivery.mjs --write
node web/scripts/register-scene-posters.mjs
```

Without `--write`, the delivery verifier checks public GET responses without changing evidence. It never uploads, changes bucket settings or runs during ordinary builds. A failed verification leaves the previous evidence untouched.

Changes to delivery or other metadata that do not change rendered pixels can use `node web/scripts/verify-scene-manifest.mjs --write` after their evidence is verified. Generated TypeScript is never hand-edited.

## Validation and remaining work

The manifest suite has 61 passing checks. The review browser suite covers 17 visual/delivery cases (including all seven landmarks in realtime and static form at three master widths), plus the existing 15 Seoul-date/draft/request-race cases. Intermediate widths 350, 351, 580, 581 and 768 check focal size and cropping. Failure, profile change and date recovery preserve navigation; reduced motion requests one poster and no renderer/GLB.

The previous `scene-review-network.json` describes the primitive prototype. `scene-clay-network.json` records the clay scene with local poster delivery: **697,511–710,929 encoded response bytes** across four viewports with ANGLE SwiftShader enabled. They exclude the semantic shell and are cold local Chromium observations, not full-page or real-device budgets. The earlier local-delivery increment passed 85 checks, including the existing production S05 regression. The R2 increment passes 61 manifest, 32 review/date and five default-off/policy checks (98 distinct cases across the initial run and targeted rerun), including a real browser CORS fetch with SHA-256 comparison. The default-off test also rejects new poster requests. Public R2 scene observations are recorded separately in `scene-clay-r2-network.json`: **697,989–711,433 bytes** across the same four viewports. These are Playwright protocol estimates; HTTP/2/3 can leave headers unattributed in body estimates. Exact poster body sizes come from the independent public hash check.

The first R2 browser run passed 30/31 cases; the 320px Sunday poster had not decoded within the old five-second image assertion. The assertion now allows up to 15 seconds for public delivery, with a 90-second ceiling for each seven-weekday test. Exact URL, decoded dimensions, focal bounds and one-request assertions remain in place. All seven affected poster/failure/delivery cases passed on the targeted rerun; the 320px Sunday capture was visually inspected. This timing allowance is not a load-time acceptance result.

Remaining: owner review of final art, physical Safari/Android performance and accessibility, S10 expansion, S05 migration parity, controlled rollout. Existing production S05 is a separate path; passing its regression tests does not complete migration. API, DB, auth and Model V2 contracts remain unchanged.

## CI follow-up

The first Linux synthetic-viewer run on `2ed6671` failed its existing ground geometry allocation assertion after a fixed 80ms sleep. Three records GPU geometry memory on the first rendered frame; the software renderer can reach that frame later. The verifier now waits up to five seconds for visible ground with geometry count greater than the unchanged baseline.

The Windows run advanced animation time but observed equal bone poses at two samples 550ms apart. A looping symmetric fixture can revisit the same pose at different times. Playback verification now observes a time change and a bone change within five seconds instead of depending on two wall-clock endpoints. All 14 full-loop checks, exact scrub poses, pause/stop checks, allocation/fixed-height/release assertions and recording finalization remain intact. Product renderer behavior is unchanged by these test synchronization fixes.

The R2 CI run on `5f517d3` passed 20 jobs and failed one S02 network assertion: the 320×568 canvas was ready before the independent poster response finished, so an immediate completed-request snapshot omitted that in-flight transfer. Network evidence collection now waits for the poster `requestfinished` event before reading sizes. A controlled pending-response test holds the poster until WebGL is ready, then releases it and checks the complete one-poster/one-GLB observation. No renderer timing, URL, byte-size or request-count requirement was relaxed.
