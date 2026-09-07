# Model V2 G7-A — KNHANES 2023 External Compatibility Result

Status: **APPROVE_KNHANES_2023_FOR_G7**

## Scope

- metadata-only schema screen after pre-performance contract revision
- participant rows read: **False**
- target prevalence accessed: **False**
- model fitting/prediction/performance: **False**
- KNHANES 2024 final internal test accessed: **False**

## Source

- filename: `hn23_all.sas7bdat`
- SHA-256: `62b3a67bd1a86fb459c78b404735a182ec0fe03cd4d35f7420d665b5b1e2741c`
- columns: **647**

## Sleep measurement shift discovered before external evaluation

KNHANES 2023 and 2024 measure the sleep-duration construct using different
source instruments.

- 2023 weekday sleep source: `BP16_1`
- 2023 weekend sleep source: `BP16_2`
- external weekday harmonization: `BP16_1 * 60`
- external weekend harmonization: `BP16_2 * 60`
- 88/99 are treated as missing
- measurement shift versus 2024: **True**
- mapping selected from performance: **False**

Therefore G7 is interpreted as a temporal Korean transportability
evaluation with a predeclared sleep-measurement shift, not an exact
same-instrument temporal replication.

## Revised schema compatibility

- missing revised required columns: **0**
- all revised required columns present: **True**

Expected absent 2024-only sleep clock fields:

- `BP16_11`
- `BP16_12`
- `BP16_13`
- `BP16_14`
- `BP16_21`
- `BP16_22`
- `BP16_23`
- `BP16_24`

## Decision

**APPROVE_KNHANES_2023_FOR_G7**

Approval means compatibility for the explicitly defined G7
transportability evaluation. It is not external performance evidence.
The KNHANES 2024 final internal test remains locked.
