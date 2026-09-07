# S3D companion visual acceptance

## Decision record

- Decision date: 2026-09-07
- Source: [Issue #250](https://github.com/AI-HealthCare-05/AH_05_07/issues/250), [human decision comment](https://github.com/AI-HealthCare-05/AH_05_07/issues/250#issuecomment-5564180084)
- S3D visual acceptance: **APPROVED**
- Production activation in #250: **NO**
- Successor rollout Issue: [#252](https://github.com/AI-HealthCare-05/AH_05_07/issues/252)

The decision was made from the actual S3C review runtime using 11 species,
standard/lite pairs, S02/S03/S05/S10 captures at 1366×900, 390×844, and
320×844, and animation review evidence. Review screenshots, contact sheets,
and clips remain local review artifacts and are not committed to Git.

## Approved production candidate

- Primary species: `bear`
- Candidate variant: `lite`
- Approved screen: `S05` save-success only
- Trigger: explicit `save_success`
- Sequence: `celebrate` exactly once, then `idle` / `rest`
- Companion role: decorative only

`lite` is the production candidate because the reviewed static visual
difference was not material at product size while transfer size and the
representative first-ready measurement were lower. `standard` remains
preserved and no automatic desktop/mobile or network-based variant switching
is approved.

## Species decisions

| Species | Decision |
| --- | --- |
| bear | primary |
| rabbit | secondary |
| cat | secondary |
| dog | secondary |
| red_panda | secondary |
| penguin | secondary |
| fox | secondary |
| squirrel | secondary |
| otter | limited |
| capybara | limited |
| hedgehog | hold |

No selected species is deleted or excluded from the immutable R2 asset set.

## Screen decisions

| Screen | Decision |
| --- | --- |
| S02 | hold |
| S03 | hold |
| S05 | approve |
| S10 | hold |

`S11` remains excluded. The initial production strategy does not assign the
companion to any other screen.

## Animation decisions

| Clip | Decision |
| --- | --- |
| idle | approve |
| rest | approve |
| greet | hold |
| curious | hold |
| celebrate | limited: S05 `save_success` only |
| move | hold |
| special | hold |

`celebrate` refers only to completion of the save UI operation. It must not
communicate 입력 기반 위험군 선별 신호, health improvement, adherence,
diagnosis, treatment, prevention, or a model outcome.

## Semantic and accessibility boundary

Companion behavior must not depend on blood-pressure values, 입력 기반 위험군
선별 신호 values, model predictions/results, challenge adherence/completion,
inferred health improvement, diagnosis, treatment, or prevention. Model output,
measured blood pressure, and challenge adherence remain separate facts.

The companion remains decorative: `aria-hidden`, no keyboard focus,
`pointer-events: none`, and removal or failure must retain the product meaning.
Reduced motion is static/non-looping. At mobile widths the S05 companion slot
must not overlap the CTA or bottom navigation.

## Rollout boundary

This record accepts the S3D visual decision only. It does not turn on
`VITE_SK7_COMPANION_MODE`, alter R2 objects, change CORS, or activate a
production route. The default remains fail-closed/off. Implementation of the
narrowly approved rollout, its independent verification, and rollback evidence
belongs only to successor Issue #252.
