# Local checkpoint resume — 2026-09-09

## Current continuation

Tracking Issue: [#390 — Local checkpoint resume](https://github.com/AI-HealthCare-05/AH_05_07/issues/390), created by the owner. Branch: `codex/living-journey-hybrid`.

The earlier 4175-origin CORS failure below was caused by using the wrong local origin. The existing asset-delivery contract allows `http://127.0.0.1:4173`. No CORS or deployment change is needed.

- Production-build S02 review tests at the allowed origin: 7 PASS, covering four viewports (320x568, 320x844, 390x844, 1366x768), GLB/image failures with navigation, reduced motion with zero renderer/GLB requests, and context-loss fallback.
- Existing production S05 suite: 5 PASS (confirmed-save one-shot/idle, excluded routes, reduced motion, asset failure, responsive slot).
- Selected default-mode regression suite: 49 PASS (scene policy/off, companion policy/off, navigation, Model V2 result/input, session/privacy).
- Four viewport tests each reached ready and requested exactly one GLB; no page exceptions or horizontal document overflow. These are Chromium desktop automation results, not real-device acceptance.
- Character normalization now has a separate transform from the responsive anchor; skinned-mesh skeleton resources are disposed with geometry/materials.
- GLB binary forensics rerun: 22 hashes/sizes PASS, 77 unique species/clip pairs, no binary modifications.
- Draft 2020-12 schema validity, minimal fixture, wrong version and unknown-field rejection PASS using a temporary uv environment. Project dependencies unchanged. Semantic cross-reference/provenance/budget verification remains outstanding.
- Mobile 320 and desktop screenshots visually inspected: subject visible, but procedural environment and composition remain review candidates.

Run `cd web && npm run test:e2e:scene` for the dedicated scene suite. It uses the approved origin and refuses to reuse an unrelated preview server.

## Earlier checkpoint recovery (historical)

- Branch: `codex/living-journey-hybrid`; base/main remains `9361983ea00afa244da560ac62f0d533e9f9e942`.
- Patch SHA-256 and all 22 restored file hashes matched the checkpoint manifest before this local report was added.
- Checkpoint restored as uncommitted work. No Issue, PR, remote push, merge or deployment performed.
- Production build PASS; generated companion manifest 22/22 PASS.
- `npx playwright test e2e/scene-policy.spec.ts e2e/living-scene.spec.ts --workers=1`: 5 PASS (four policy tests and one disabled-scene Chromium test).
- Local port binding required sandbox escalation; browser execution then worked.
- Review-mode Vite development preview, headless Chromium: 320x568, 320x844, 390x844, 1366x768. Scrolled stage into view to activate its visibility gate. All four reached fallback with no page exceptions or horizontal document overflow.
- GLB request failed CORS: `https://sk7-companion.gkrry.com/companion/v1/bear/v007/lite.glb` response lacked Access-Control-Allow-Origin for `http://127.0.0.1:4175`. Do not interpret fallback success as 3D acceptance. No asset server configuration was changed.
- Screenshots saved in `/private/tmp/sk7-checkpoint-review/`; 390x844 screenshot visually inspected. Machine observations: `docs/evidence/scene-local-browser-results.json`.
- Schema validation was NOT rerun: both local Python environments lack jsonschema. Binary GLB hash inventory was NOT rerun; checkpoint evidence remains historical. Generated manifest validation only checks evidence correspondence.
- Production-build shared Three chunk warning remains (629.57 kB raw / 160.15 kB gzip). No first-use production transfer or real-device performance measured.

## GitHub blocker
Connected-app search returned no matching Living Journey issues. Issue creation was rejected by automatic approval review before reaching GitHub because exact external payload/destination authorization was judged missing. Therefore the historical integration 403 has not been retested. CLI read calls also failed network access in the sandbox. Do not infer that repository permissions were restored.

## Reviewable Issue draft
Destination: `AI-HealthCare-05/AH_05_07`

Title: Living Journey Hybrid: resume checkpoint and validate S02 review prototype

Body:

Resume the supplied Living Journey Hybrid checkpoint from baseline 9361983ea00afa244da560ac62f0d533e9f9e942.

Scope: recover the Phase 0 documents and S02 review prototype on an isolated branch; verify patch integrity, build, scene policy, schema, GLB inventory, and browser behavior. Record remaining visual, mobile, performance, S05 parity, and production acceptance gates accurately.

Keep API, DB, auth, deployment semantics, Model V2, and existing S05 contracts unchanged. Use 입력 기반 위험군 선별 신호 wording and synthetic fixtures only. Keep production scene activation gated until acceptance evidence exists.

Checkpoint patch SHA-256: 2cebf65a0c993a5a45c2fbd784ba0600cecbf2f5147a94c35be4aed651be2625.
