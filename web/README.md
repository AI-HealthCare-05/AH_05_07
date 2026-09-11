# 상균7데이즈 (SK7) web

```bash
cp .env.example .env.local
npm install
npm run dev
```

Set `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, and `VITE_API_BASE_URL` before starting. Add the local or deployed web origin to both Supabase Auth redirect URLs and the API `API_CORS_ORIGINS` setting.

## G3 visual evidence fixtures

The signed-in signature page has four deterministic synthetic `VPF-1` fixtures
for capture only. Select one at build time; there is no in-product fixture
switcher. A query parameter is accepted only by the local Playwright build,
which sets `VITE_SK7_E2E_MODE=1`; a normal production build ignores it.

```bash
VITE_SK7_EVIDENCE_FIXTURE=VP-04 npm run build
VITE_SK7_EVIDENCE_FIXTURE=VP-07a npm run build
VITE_SK7_EVIDENCE_FIXTURE=VP-10 npm run build
VITE_SK7_EVIDENCE_FIXTURE=VP-11a npm run build
```

Use only the resulting local evidence build for the matching sanitized capture.
Do not deploy a build that contains `VITE_SK7_EVIDENCE_FIXTURE`. The fixture
uses `ko-KR`, `Asia/Seoul`, synthetic dates, and masked blood-pressure values.

## Browser harness boundary

`npm run test:e2e` starts a dedicated local build with a synthetic session and
an intercepted API origin. It never signs in to Supabase, sends a real JWT, or
reads a production record. The harness covers browser-side validation, a `401`
session-recovery transition, and an initial load failure that must not be
presented as an empty record set. It also proves that a pending save disables a
duplicate submission, an uncertain save is not presented as successful, and a
failed refresh retains the previously loaded records with a stale-data notice.

For local review, these cross-platform commands select a dedicated Vite mode.
Each review screen shows its fixture label; this label is absent from the
normal product.

```bash
npm run dev:evidence:vp-04
npm run dev:evidence:vp-07a
npm run dev:evidence:vp-10
npm run dev:evidence:vp-11a
```

## Journey UI candidate — Issue #406

`VITE_SK7_UI_MODE` is a proposed **build** contract, independently resolved from
`VITE_SK7_SCENE_MODE` and `VITE_SK7_COMPANION_MODE`. No production default or
Cloudflare setting is changed. Only `legacy` and `journey` are explicit UI values.

| UI mode | Scene mode | UI / S02 and S10 scenery |
| --- | --- | --- |
| unset | unset/off/unknown/production | Existing UI and scene gates |
| unset | review | Existing #401/#403 review UI and scene gates |
| journey | unset/off/unknown/production | Approved UI + explicit static poster candidate |
| journey | review | Existing review UI and scene gates |
| legacy or any invalid explicit value (including empty) | any | New UI closed; independent scene/companion gates preserved |

URL, localStorage, synthetic authentication and NODE_ENV never opt in to the UI.
`production` still opens no new realtime scene. Posters reuse the existing
screen / Seoul-today / viewport mapping, even when browsing prior records.
S05 retains the existing production bear-lite/celebrate-then-idle companion
when selected; its wrapper anchors it inside the new completion landscape.
The new SavedScene remains review-only and the reserved 2D S05 asset stays inactive.
Companion off/failure keeps the completion DOM with no substitute character;
reduced motion preserves the existing neutral companion behavior. S05 production
still uses WebGL; only static S02/S10 have no renderer import execution/GLB/canvas/RAF.

Run from `web/` in separate terminals (local output only):

```bash
# Synthetic session + tab-memory API fixture, only synthetic 120 / 80 input:
node scripts/preview-journey-review.mjs --static
# http://127.0.0.1:4181/?e2e=signed-in&screen=S02
# S10 mixed fixture: ?e2e=signed-in&screen=S10&recap_fixture=mixed

# Normal build, login boundary intact, explicit nonfunctional public test config:
node scripts/preview-ui-candidate.mjs
# http://127.0.0.1:4182/ — no real authentication or API integration

npm run test:e2e:ui
```

The normal command explicitly empties E2E/evidence variables even when inherited,
uses a separate ignored output directory, and injects no fixture. Its authenticated
browser test uses mocked browser storage and intercepted API responses only.
The normal URL alone cannot sign in. The default review preview command without
`--static` retains its previous review selection. See [candidate captures](../docs/evidence/sk7-ui-release/README.md).

This candidate is not release approval. Physical-device/network/accessibility
checks for the exact configuration and existing [#390 gates](../docs/scene-release-gates.md)
remain separate. Before any authorized release, record actual serving identities
and public configuration; restore the captured known-good build settings/runtime
for rollback. With this candidate, leaving UI unset preserves existing behavior;
`legacy` explicitly closes new UI without changing the independent scene gates.
