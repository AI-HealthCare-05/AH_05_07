# G3 implementation evidence

Issue authority: #141 (`feat: implement the approved SK7 seven-day signature experience`).

This record indexes the implementation review. It is not a release approval and
does not authorize deployment.

## Approved visual baseline

On 2026-09-04, the owner reviewed the eight sanitized, local Chromium capture
frames at the required desktop (`1366 × 768`) and mobile (`390 × 844`)
viewports. The capture set used Korean copy, `Asia/Seoul`, the fixed
`2026-09-03` fixture date, and masked blood-pressure values.

| Fixture | Reviewed state |
| --- | --- |
| `VP-04` | Confirmed empty observations, challenge, check-ins, and legacy lane; next actions remain available. |
| `VP-07a` | Locked, unrecorded-today walking challenge from `2026-09-01` through `2026-09-07`; prior participation remains separate from the measurement fact. |
| `VP-10` | Seven-day recap with separate masked measurement, challenge-participation, and legacy-record lanes. |
| `VP-11a` | Initial load failure, distinct from empty data, with one safe retry action. |

The fixture-only `검토 상태 · VP-…` label was visible during review to make the
capture state auditable. It is absent from normal product mode.

## Local verification

The following commands passed against the review candidate:

```bash
cd web
npm run build
npm run build -- --mode evidence-vp-04
npm run build -- --mode evidence-vp-07a
npm run build -- --mode evidence-vp-10
npm run build -- --mode evidence-vp-11a

cd ..
python3 scripts/ci/verify_secret_boundary.py --self-test
python3 scripts/ci/verify_secret_boundary.py --web-dist web/dist
git diff --check
```

The fixture modes are local review tools only and must not be deployed.

## Required before formal commit and pull request

- [x] Review `320 CSS px` reflow: no horizontal page scroll, clipped control, lost action, or reordered fact.
- [x] Review desktop `200%` zoom with no lost content or action.
- [x] Review the complete keyboard path and visible focus treatment, including validation focus movement and error retry.
- [x] Review Korean line wrapping, contrast, and reduced-motion behavior.
- [x] Record browser console and expected network result for fixture modes; production preview has no application or favicon error.
- [x] Preserve the eight sanitized source captures for pull-request attachment using the VPF-1 filename convention.

