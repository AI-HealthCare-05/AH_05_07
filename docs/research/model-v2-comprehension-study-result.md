# Increment B4 — Human Comprehension Study Protocol + Synthetic Dry-run result

Decision: **PASS_COMPREHENSION_PROTOCOL_READY_FOR_HUMAN_REVIEW**.

B4 prepared a defensible human-comprehension study protocol and ran a fully
synthetic dry-run. No real participants were recruited. This is **not**
production approval to display a percentile. B/B2's `HOLD_REFERENCE_RESEARCH` and
`HOLD_SURVEY_UNCERTAINTY`, and B3's `PASS_FINITE_REFERENCE_TO_HUMAN_STUDY`,
remain in force. The current product recommendation stays **C — raw-output
explanation only** under the existing S11 preview contract.

[Protocol contract](model-v2-comprehension-study-protocol.md) ·
[Runner](../../scripts/model/analyze_model_v2_comprehension_study.py) ·
[Tests](../../tests/model/test_model_v2_comprehension_study.py).

## What B4 did and did not do

Done:

- Preserved the five B3 presentation arms (A–E) and the six critical comprehension
  questions.
- Defined a future real-study protocol: eligibility, consent, randomization,
  blinding, one-arm-per-participant design, neutral wording, primary/secondary
  endpoints, exclusions, missing-response handling, stopping rules, analysis plan,
  and exploratory-only subgroup analysis.
- Chose the exact Clopper-Pearson one-sided 95% lower confidence bound for
  binomial proportions before any recruitment.
- Documented a reproducible sample-size / operating-characteristic table.
- Designed an arm-comparison plan that uses critical-item gating and explicitly
  rejects "absence of significance = equal comprehension".
- Generated synthetic response data, ran scoring, gating, and report generation.
- Added targeted synthetic tests; no G8 access; no production change.

Not done:

- No real participant recruitment.
- No production S11/API/DB/runtime/artifact/analytics/telemetry/deployment
  change.
- No participant-level real-data storage implemented.

## Decision

`PASS_COMPREHENSION_PROTOCOL_READY_FOR_HUMAN_REVIEW`.

The protocol is sufficiently defined to be submitted for ethics and scientific
review before recruiting a single real participant. It is still not production
approval.

## Product recommendation

**C — raw-output explanation only.**

Arms B–D remain research candidates. No percentile or position display should
advance to production until a real comprehension study demonstrates that users
correctly answer the six critical questions.

## Synthetic dry-run

**This section is synthetic. It must never be presented as evidence from real
users.**

The dry-run used seed `20260919`, 60 synthetic participants per arm, 3% missing
responses, and 2% invalid responses. Missing and invalid answers were scored as
incorrect.

### Arm-level summary

| Arm | n | All-correct rate | Overall understanding | Passes gating |
| --- | --- | --- | --- | --- |
| A | 60 | 56.67% | 89.17% | FAIL |
| B | 60 | 36.67% | 83.33% | FAIL |
| C | 60 | 43.33% | 85.56% | FAIL |
| D | 60 | 38.33% | 84.44% | FAIL |
| E | 60 | 50.00% | 88.89% | FAIL |

### Per-item results (synthetic)

#### Arm A — Current-style raw output

| Item | Correct | Rate | 95% LB | Obs >=90% | LB >=80% |
| --- | --- | --- | --- | --- | --- |
| q1 | 52 | 86.67% | 77.23% | N | N |
| q2 | 54 | 90.00% | 81.21% | Y | Y |
| q3 | 54 | 90.00% | 81.21% | Y | Y |
| q4 | 53 | 88.33% | 79.20% | N | N |
| q5 | 56 | 93.33% | 85.39% | Y | Y |
| q6 | 52 | 86.67% | 77.23% | N | N |

#### Arm B — Named finite-reference percentile

| Item | Correct | Rate | 95% LB | Obs >=90% | LB >=80% |
| --- | --- | --- | --- | --- | --- |
| q1 | 48 | 80.00% | 69.62% | N | N |
| q2 | 50 | 83.33% | 73.37% | N | N |
| q3 | 51 | 85.00% | 75.28% | N | N |
| q4 | 53 | 88.33% | 79.20% | N | N |
| q5 | 53 | 88.33% | 79.20% | N | N |
| q6 | 45 | 75.00% | 64.15% | N | N |

#### Arm C — Distribution marker without percentile number

| Item | Correct | Rate | 95% LB | Obs >=90% | LB >=80% |
| --- | --- | --- | --- | --- | --- |
| q1 | 54 | 90.00% | 81.21% | Y | Y |
| q2 | 54 | 90.00% | 81.21% | Y | Y |
| q3 | 48 | 80.00% | 69.62% | N | N |
| q4 | 51 | 85.00% | 75.28% | N | N |
| q5 | 52 | 86.67% | 77.23% | N | N |
| q6 | 49 | 81.67% | 71.48% | N | N |

#### Arm D — 100-position explanation

| Item | Correct | Rate | 95% LB | Obs >=90% | LB >=80% |
| --- | --- | --- | --- | --- | --- |
| q1 | 49 | 81.67% | 71.48% | N | N |
| q2 | 49 | 81.67% | 71.48% | N | N |
| q3 | 50 | 83.33% | 73.37% | N | N |
| q4 | 56 | 93.33% | 85.39% | Y | Y |
| q5 | 47 | 78.33% | 67.78% | N | N |
| q6 | 53 | 88.33% | 79.20% | N | N |

#### Arm E — No comparison

| Item | Correct | Rate | 95% LB | Obs >=90% | LB >=80% |
| --- | --- | --- | --- | --- | --- |
| q1 | 57 | 95.00% | 87.58% | Y | Y |
| q2 | 54 | 90.00% | 81.21% | Y | Y |
| q3 | 58 | 96.67% | 89.88% | Y | Y |
| q4 | 52 | 86.67% | 77.23% | N | N |
| q5 | 55 | 91.67% | 83.27% | Y | Y |
| q6 | 44 | 73.33% | 62.36% | N | N |

The synthetic results show the gating behavior: some items pass the observed-rate
threshold, some pass the confidence-bound threshold, and no arm passes every
critical-item gate. Because the data are synthetic, no arm is declared fit or
unfit for production.

## Confidence-bound method

B4 chose the **exact Clopper-Pearson one-sided 95% lower confidence bound** for a
binomial proportion. For `k` successes out of `n` independent trials, the lower
bound `L` satisfies `P(X >= k | p = L) = 0.05`. Missing, invalid, and "unsure"
responses are counted as incorrect.

## Sample-size / operating-characteristic table

The table shows the probability that a single critical item passes **both** the
observed-rate gate (>=90% correct) and the confidence-bound gate (one-sided 95%
lower bound >=80%), under several assumed true correctness rates and per-arm
sample sizes.

| n | true_rate | P(obs>=90%) | P(LB>=80%) | P(pass both) |
| --- | --- | --- | --- | --- |
| 50 | 0.80 | 0.0480 | 0.0480 | 0.0480 |
| 50 | 0.85 | 0.2194 | 0.2194 | 0.2194 |
| 50 | 0.90 | 0.6161 | 0.6161 | 0.6161 |
| 50 | 0.95 | 0.9622 | 0.9622 | 0.9622 |
| 100 | 0.80 | 0.0057 | 0.0469 | 0.0057 |
| 100 | 0.85 | 0.0994 | 0.3474 | 0.0994 |
| 100 | 0.90 | 0.5832 | 0.8761 | 0.5832 |
| 100 | 0.95 | 0.9885 | 0.9995 | 0.9885 |
| 200 | 0.80 | 0.0001 | 0.0430 | 0.0001 |
| 200 | 0.85 | 0.0255 | 0.5485 | 0.0255 |
| 200 | 0.90 | 0.5592 | 0.9905 | 0.5592 |
| 200 | 0.95 | 0.9988 | 1.0000 | 0.9988 |
| 300 | 0.80 | 0.0000 | 0.0457 | 0.0000 |
| 300 | 0.85 | 0.0072 | 0.7186 | 0.0072 |
| 300 | 0.90 | 0.5484 | 0.9996 | 0.5484 |
| 300 | 0.95 | 0.9999 | 1.0000 | 0.9999 |
| 500 | 0.80 | 0.0000 | 0.0394 | 0.0000 |
| 500 | 0.85 | 0.0007 | 0.8819 | 0.0007 |
| 500 | 0.90 | 0.5376 | 1.0000 | 0.5376 |
| 500 | 0.95 | 1.0000 | 1.0000 | 1.0000 |
| 1000 | 0.80 | 0.0000 | 0.0431 | 0.0000 |
| 1000 | 0.85 | 0.0000 | 0.9933 | 0.0000 |
| 1000 | 0.90 | 0.5266 | 1.0000 | 0.5266 |
| 1000 | 0.95 | 1.0000 | 1.0000 | 1.0000 |

Interpretation:

- At a true correctness rate of 0.90, the observed-rate gate is the binding
  constraint. Even with `n = 1000`, power to pass both gates is only about 53%.
- At a true correctness rate of 0.95, `n = 200` per arm gives >99% power.
- The criteria are therefore stringent. A real study would need either a large
  per-arm sample or a true correctness rate well above 90% to have high power.
  If the true rate is near 90%, the required sample size is large enough that
  the study should be considered carefully for feasibility before recruitment.

## Privacy and data minimization

Only study-response data are collected for comprehension evaluation. Do not
collect names, clinical records, Model V2 inputs, BP records, medical histories,
or production account identifiers. Optional demographic variables for subgroup
analysis are collected only with consent and used only for exploratory analysis.
No participant-level data storage is implemented in this increment.

## Verification and scope audit

Synthetic tests: **18 passed**.

Local execution used Python 3.13.14.

- Baseline: `b2bd45aa78971e8bb23e13283db0e3a6b8e4cb1f` (#628).
- Branch: `research/model-v2-comprehension-study-protocol`.

Only the protocol, result, runner, tests, and Local Verification Router mapping
are added or updated. No S11 runtime, production display, Model V2 artifact, API,
DB, auth, analytics, telemetry, persistence, deployment, or G8 access.

## Explicit statements

- **No human study occurred in B4.**
- **Synthetic results are not evidence from users.**
- **Production recommendation remains C — raw-output explanation only.**

(End of file - total 244 lines)
