# Model V2 T9 — Privacy/Data-Use Readiness Contract Result

Status: **PRIVACY_READINESS_BLOCKED / REAL-USER COLLECTION UNAUTHORIZED / PRODUCTION DISABLED**

Starting main: `55024a0b7296b2f4e090d1c3bb65a5299801c859`

Issue: `#324`

Contract version: `model-v2-privacy-readiness-v1`

T9 is an internal privacy/data-use engineering readiness gate. It does not
assert legal compliance and does not replace a formal privacy or legal review.

## Readiness dimensions

T9 defines eight privacy/data-use readiness dimensions:

1. `purpose_limitation_approved`
2. `data_minimization_approved`
3. `transient_processing_approved`
4. `logging_monitoring_approved`
5. `analytics_boundary_approved`
6. `data_separation_approved`
7. `user_notice_collection_approved`
8. `retention_deletion_approved`

Each dimension accepts only:

- `PASS`
- `BLOCKED`
- `NOT_REVIEWED`

Final privacy readiness is `PASS` only when all eight dimensions are `PASS`.
Any `BLOCKED` or `NOT_REVIEWED` dimension produces `BLOCKED`. Missing, extra,
or unknown fields are rejected.

## Current T9 snapshot

- purpose limitation: `PASS`
- data minimization: `PASS`
- transient processing: `PASS`
- logging/monitoring boundary: `PASS`
- analytics boundary: `PASS`
- data separation: `PASS`
- user notice / collection authorization: `BLOCKED`
- retention/deletion boundary: `PASS`

Final privacy readiness: **`BLOCKED`**

The engineering privacy boundaries are defined, but real-user Model V2
collection remains unauthorized because approved user-facing notice and
collection authorization do not yet exist.

## Purpose limitation

Model V2 inputs may be used only to prepare the explicitly requested:

`입력 기반 위험군 선별 신호`

T9 does not authorize:

- unrelated secondary use
- training or retraining use without separate review
- advertising or marketing use
- profile enrichment
- inference from BP, challenge, or prior results to fill Model V2 inputs

## Data minimization

Only fields required by the approved product-input adapter may be requested.

T9 does not authorize collecting:

- research-only participant identifiers
- source-survey metadata merely because KNHANES used it
- pregnancy history as a Model V2 product input
- survey weights
- PSU/strata
- other research cohort fields
- speculative future-feature fields

## Transient processing and persistence

Current Model V2 draft and result remain transient.

T9 does not authorize:

- localStorage/sessionStorage persistence
- a Model V2 database table
- result history
- replay archives
- raw Model V2 request-body retention

Any future persistence requires a separately reviewed contract and explicit
approval.

## Logging and monitoring

Application logs must exclude:

- raw Model V2 feature values
- raw numeric Model V2 scores
- score-derived qualitative classes
- raw Model V2 inputs echoed through stack traces or error messages

Monitoring may use coarse operational metadata only when that metadata cannot
reconstruct Model V2 health/lifestyle inputs or scores.

## Analytics

T9 does not authorize analytics containing:

- raw Model V2 inputs
- numeric scores
- hidden score-derived qualitative classes
- cross-session Model V2 user profiles

Any future Model V2 usage-count event requires a separately approved event
schema with no feature/result payload.

## Data separation

Model V2 input/result remains separate from:

- blood-pressure observations
- challenge selection/check-ins
- prior model outputs
- other users

There is no authorized automatic join, silent feature completion, or combined
health profile.

## User notice / collection authorization

Before real-user collection, an approved user-facing notice must state:

- what categories of inputs are requested
- why the inputs are requested
- that the output is an `입력 기반 위험군 선별 신호`
- that the output is not diagnosis, treatment, or prevention
- whether input values and results are stored or not stored

Exact notice text is not approved by T9. Real-user collection therefore remains
blocked.

## Retention and deletion

The current approved boundary is no persistence of Model V2 input/result.
Therefore T9 does not create a retention period.

If persistence is later proposed, retention period, deletion behavior, access
control, export, and user deletion handling require separate review.

## T7 and T8 interaction

T9 does not rewrite earlier readiness constants.

At T9 completion:

- T7 `privacy_readiness` remains `NOT_REVIEWED`
- T7 activation decision remains `NO_GO`
- T8 product readiness remains `BLOCKED`
- production scoring remains disabled
- real-user Model V2 collection remains unauthorized

## Unchanged boundaries

- production scoring enabled: **False**
- real-user Model V2 collection authorized: **False**
- deployment performed: **False**
- runtime environment modified: **False**
- Model V2 persistence added: **False**
- raw feature logging added: **False**
- raw score logging added: **False**
- Model V2 analytics payload added: **False**
- BP/challenge/model join added: **False**
- numeric score exposure added: **False**
- API semantics changed: **False**
- UI production wiring changed: **False**
- DB/schema/migration changed: **False**
- frozen artifact/model/schema/preprocessing changed: **False**
- T7 current activation state changed: **False**
- T8 current product readiness changed: **False**

T9 completion is not privacy/legal approval, product release, real-user
collection authorization, or production activation.
