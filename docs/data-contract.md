# Data contract

> **Version scope.** The NHANES/BP-threshold sections below describe the earlier
> research contract and must not be read as the current frozen Model V2 source or
> target. Current Model V2 is the separately frozen **KNHANES 2024** path in
> `docs/research/model-v2-g3-freeze-contract.md`; its executable preparation uses
> `HE_HP == 4` as the positive cross-sectional state target and preserves the
> frozen 11-feature contract. Product behavior follows
> `docs/model-v2-product-contract.md`.

## Source

Primary candidate: **NHANES 2017–March 2020 Pre-pandemic**. The combined release is nationally representative and documents demographic, examination, questionnaire, dietary, and laboratory modules. [CDC data overview](https://wwwn.cdc.gov/nchs/nhanes/continuousnhanes/default.aspx?Cycle=2017-2020) · [questionnaire index](https://wwwn.cdc.gov/nchs/nhanes/continuousnhanes/questionnaires.aspx?Cycle=2017-2020)

KNHANES remains a Korean-source alternative, subject to its raw-data application and usage guidance. [KDCA portal](https://knhanes.kdca.go.kr/knhanes/main.do)

## Label

`hypertension_risk_group` is the current cross-sectional BP-threshold research label: mean available positive finite oscillometric systolic readings >=130 OR diastolic readings >=80. At least one valid reading in each component is required; all other rows are excluded. Recorded treatment status is not used by this version. The product must not call this a future-incidence prediction. User-facing wording is `입력 기반 위험군 선별 신호`.

## Feature allowlist

- age band, sex, BMI/anthropometrics
- smoking, alcohol, physical activity, sleep, diet-behavior items
- selected non-identifying socioeconomic fields only when documented and available at inference

## Feature denylist

- every BP reading or BP-derived aggregate used to construct the label
- diagnosis, medication, or treatment fields that define or trivially reveal the label
- identifiers, dates, free text, original documents, and unavailable-at-inference fields

## Split and evaluation

- Freeze a row-level train/validation/test split before model selection; preserve a split digest.
- Compare logistic regression against histogram gradient boosting.
- Publish AUROC, PR-AUC, Brier score, calibration, and subgroup results.
- Repeated normalized input with the same model artifact must produce the same output.

## Gate

Implementation begins only after the exact release files, variable names, derivation code, missing-value policy, and license/usage record are committed under `data/manifest/`. A failed feature-availability or leakage audit blocks training.

Run `uv run --group ai python scripts/data/audit_schema.py /local/path/to/raw` after downloading the listed files outside the repository. The audit checks the join key and the minimum variables needed for the label and first predictor set; it does not copy source data into Git.

Follow `docs/model-gate-1b-runbook.md` for the canonical manifest audit,
seven-module schema audit, derived-table, frozen-split, and sanitized-evidence
sequence. Merging that contract does not mark Gate 1B complete; an operator must
run it against the manually obtained public release and review the allowlisted
evidence first.

## Version 2 preparation semantics

The versioned source-to-input mapping and deliberate scope choices are in
[data-feature-semantics.md](data-feature-semantics.md) and ADR-0003. The manifest
owns explicit feature types, valid/missing codes, population bounds, and split
ratios. The analyzed cohort is adults with recorded age 18..80 (80 is the
source's top code), available BP in both components, and BMI 10..80. The BMI
bound is the existing SK7 input scope, not a CDC exclusion rule. Questionnaire
absence is retained as missing; it does not imply a negative answer.

Categorical missing values use an explicit -1 level. Continuous missing values
use only the training median; an entirely missing continuous training column
blocks preparation. The model scripts share one encoder based on manifest types
and the frozen fill values; numeric storage dtype never decides category meaning.

No survey weighting or complex-sample variance estimation is implemented.
The resulting unweighted cohort and metrics cannot claim US population
representativeness, Korean-user validity, or future incidence prediction.
Existing raw-array artifacts must not be reused with version 2 preprocessing.
The API stays explicitly unavailable until a reviewed input adapter and complete
model evaluation/promotion evidence exist.

## My Space cosmetic snapshot (E4)

Source contract for [#816](https://github.com/AI-HealthCare-05/AH_05_07/issues/816),
reviewed from `3ff16e1ccdde480a7cc62c80ca5167beb6ab2678`. This is migration
code, not evidence of production activation.

E4 evolves `placeable_snapshots` and its existing read/save RPCs. A separate
keepsake table/controller was rejected: these are two slots in the same small
layout with the same owner, lifetime and atomic save/recovery boundary. Splitting
would add cross-snapshot partial saves and duplicate account fencing without an
independent lifecycle requirement. No generic inventory or scene graph is added.

- v1 (`placeable.v1` / `e1-plaza.v1`) retains its exact pinwheel-or-null shape.
  Reads and ordinary pinwheel edits do not migrate it.
- Explicit keepsake confirmation writes v2 (`placeable.v2` / `e1-plaza.v2`), with
  exactly `selection: { pinwheel: <v1 selection or null>, keepsake: <asset id or null> }`.
  Both keys are required. The existing pinwheel survives conversion. Revision
  increases by one in the same row; migration performs no backfill or defaults write.
- The three keepsake IDs are `plaza-ribbon-v1`, `quiet-moon-v1`, `garden-leaf-v1`.
  The transient source choice is not stored. Check-ins, completion/skips, streaks,
  adherence, BP, Model V2/risk and outcomes have no place in this schema.
- v2 never downgrades to v1, including after both slots become null. Older clients
  preserve unsupported reads; the server additionally rejects old writes over v2.
  Unknown schema/layout/asset data is readable unchanged and cannot be overwritten.
- Browser storage retains the existing `sk7:placeable:v1` key and Web Lock name
  so old/new tabs share the same compare/write boundary. Account mode never reads,
  copies or falls back to this browser snapshot.
- Operation UUID, expected revision and full-layout fingerprint are atomic. v1
  fingerprint bytes are unchanged; v2 appends `|<keepsake id or ->` to the v1
  pinwheel fields. Lost-response UNKNOWN retains the immutable operation until
  the matching receipt, a newer conflict or session loss resolves it. An old
  reread cannot prove a pending write failed.
- Conflict review retains only the user's edited slot intents; confirmation
  rebases those onto the latest snapshot, preserving concurrently edited other
  slots. Delayed responses remain fenced by controller epoch and account generation.
- Account lifetime, owner-only RLS, restricted direct writes and auth-owner lock
  remain unchanged. Deletion cascades both slots. Saves serialized after deletion
  fail without recreating the owner.

Media contract v0 is the small code manifest
[`keepsakeMedia.ts`](../web/src/placeable/keepsakeMedia.ts): immutable identity,
role, shared palette/accent, authored provenance, rights state and 3D/Classic
representations. These are original repository-authored procedural/SVG variants;
no external media license or generated image is introduced. Keep the family still,
small and subordinate to Today Gate and the existing pinwheel.
