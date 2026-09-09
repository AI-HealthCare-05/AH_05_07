# S10 calendar diorama — review implementation

Issue #390 · draft PR #391 · `codex/living-journey-hybrid`. S02 and S10 are enabled only by `VITE_SK7_SCENE_MODE=review`. This checkpoint includes asset upload, not application deployment, merge or production activation.

## Composition and data boundary

S10's existing period navigation, separate blood-pressure/check-in/legacy facts, challenge card and record lists stay in semantic HTML. A decorative VisualStage uses the same current Seoul date snapshot as S02. Neither values/counts nor the selected prior record window can choose its landmark, pose or weather. The seven calendar landmarks are neutral scenery, with no completion or reset reward.

`diorama.ts` composes existing clay landmark modules around one large bear and today's focal landmark. Desktop instantiates all seven landmarks with neutral paths; widths up to 580px instantiate only the focal landmark and one neighboring fragment. Every profile has its own registered camera; mobile posters are independent renders. Resizing rebuilds surroundings while retaining the same character and WebGL renderer. The existing prior-window loading placeholder can remount the scene; its calendar date remains the current date.

| Profile | Viewport | CSS stage | WebP pixels | Projected bear height |
| --- | --- | --- | --- | --- |
| mobile320 | 320 × 844 | 256 × 240 | 514 × 482 | 143.62 CSS px |
| mobile390 | 390 × 844 | 326 × 280 | 654 × 562 | 167.56 CSS px |
| desktop | 1366 × 900 | 1069 × 420 | 2140 × 842 | 209.34 CSS px |

Projected face/ears/body remain inside the stage at master and intermediate breakpoint widths. Secondary surroundings can crop. Desktop character placement was corrected after a 581px test exposed left clipping. The final camera and all affected pixels were recaptured. DPR remains capped at 1.25; capture device scale is 2, with fractional screenshot edges rounded outward. No perpetual frame loop, animation mixer or dynamic shadow pass is added.

## Shared design fixes

- Realtime recipes now explicitly select their root environment instead of relying on the first environment asset. S10 registers both the shared landmark module and its diorama module. Fallbacks must match screen, weekday and profile.
- The recipe boundary owns a failure latch; changing the reduced-motion tier resets canvas readiness without retrying failed 3D. A chunk error reports to the one outer fallback owner, preventing duplicate poster elements.
- Route/recipe exit disposes geometry, materials and renderer and explicitly loses the old WebGL context. Repeated S02/S10 navigation retains one live scene context; leaving both retains none.
- Capture hashes now cover VisualStage, recipe selection, scene policy and stylesheet in addition to renderer, geometry and capture script. Shared-source edits require both screens to be recaptured. All 21 recaptured S02 binaries exactly match their existing R2 identities.

## Registered assets and public delivery

The full review manifest has **45 assets / 28 recipes**: one unchanged bear-lite, two environment modules, 42 posters, 14 realtime recipes and 14 fallbacks. S10's 21 WebPs total **634,098 bytes**, individually **11,378–64,300 bytes**. One viewport poster is selected per activation. S10's conservative character/modules/renderer-reserve/largest-poster budget is **841,029–844,147 bytes**, under the 900,000-byte planning gate. This is a planning sum, not a measured performance pass.

S10 posters were uploaded through the authenticated Cloudflare dashboard to the previously empty `sk7-assets-prod/scene-review/s10/v1/` prefix on 2026-09-10 KST. Folder creation also created a zero-byte prefix marker. No prior asset was overwritten. Public URLs at `https://sk7-companion.gkrry.com` returned exact SHA-256 and byte lengths, `image/webp`, permitted-origin CORS for `http://127.0.0.1:4173`, and the existing `max-age=14400` four-hour cache policy. Bucket settings and OAuth permissions were unchanged.

- `docs/evidence/scene-diorama-posters.json`: local binary identity, camera/source hashes, projected bounds, draw calls and triangle observations.
- `docs/evidence/scene-diorama-r2.json`: independent public GET/hash/MIME/CORS/cache proof for all 21 files.
- `docs/evidence/scene-diorama-r2-network.json`: selected scene requests in local Chromium using public R2 assets; excludes the semantic shell and unrelated media. The four viewport observations span 699,980–752,515 encoded response bytes.

Mobile capture observations are 29–31 draw calls / 23,006–31,862 triangles; desktop is 75 draw calls / 89,654 triangles. These are renderer counters, not GPU timings. Peak memory, decode/shader timing, FPS, warm-browser cache behavior and physical Safari/Android acceptance remain unmeasured. The existing large lazy Three chunk warning remains visible.

These pixels are repository-authored Three captures using the registered bear rights reference. Earlier Canva contracts remain visual references; this increment contains no new Canva-generated/exported image and no clinical or personal data.

## Reproduce an intentional change

With port 4173 free, run from the repository root:

```sh
node web/scripts/capture-scene-posters.mjs --screen=S10
node web/scripts/register-scene-posters.mjs
npm --prefix web run test:scene-manifest
npm --prefix web run build
```

Omit `--screen` to recapture both S02 and S10 after a shared render-source edit. Inspect pixels and manifest differences before removing superseded local exports. Keep published hash-addressed objects until a separate retention decision. Never edit the generated TypeScript or replace source hashes without recapturing.

After an authorized upload, verify and register exact public delivery:

```sh
node web/scripts/verify-scene-poster-delivery.mjs --screen=S10 --write
node web/scripts/register-scene-posters.mjs
```

The delivery verifier is read-only against R2. New identities remain local until public evidence matches; identical S02 delivery stays registered. Registration validates the complete result before writing manifests.

## Validation and release boundary

The manifest suite has 71 checks and the schema/manifest pass independent Draft 2020-12 validation. S10 browser coverage adds four viewport/network cases, all seven weekdays in realtime and poster form at three widths, intermediate widths, record/calendar independence, Seoul midnight, media/chunk failure, tier changes and route context disposal. A real browser CORS fetch checks the registered S10 bytes from a page that has not already loaded that URL as a no-CORS image; this avoids testing an unrelated image-memory-cache entry.

The existing S02/date suite, default-off/policy and production S05 regression run alongside this increment. Current completed counts and CI status are maintained in [implementation status](scene-implementation-status.md) and PR #391. Existing S05 regression success does not establish S05 migration parity.

Remaining: final visual acceptance, S05 confirmed-persistence/exactly-once migration parity, physical-device performance/accessibility, and controlled rollout with rollback. API/DB/auth/Model V2 and the existing production S05 implementation remain unchanged.
