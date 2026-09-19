# Increment B4 — Human Comprehension Study Protocol + Synthetic Dry-run

Pre-analysis protocol, 2026-09-19. Canonical baseline:
`b2bd45aa78971e8bb23e13283db0e3a6b8e4cb1f` (merged #628).
This is a protected, research-only continuation of
[Increment B3](model-v2-finite-reference-comprehension-result.md), not a new
roadmap. It does not override B/B2/B3 decisions or the
[product contract](../model-v2-product-contract.md).

## Scope and non-authorization

B3 concluded `PASS_FINITE_REFERENCE_TO_HUMAN_STUDY`. B4 prepares a defensible
human-comprehension study package. B4 does **not** recruit or collect data from
real people.

This document is a **protocol for a future real study**. It is not evidence that
the proposed criteria have been met. It is not authorization to display a
percentile in production.

Current product recommendation remains **C — raw-output explanation only** under
the existing S11 preview contract.

## Study question

Can people correctly understand the difference between:

1. Model raw output
2. Finite-reference position
3. Disease probability / diagnosis / severity / causal improvement

when shown one of the B3 presentation arms?

## Preserved B3 arms

Do not redesign production S11. Research materials only.

| Arm | Label | What is shown |
| --- | --- | --- |
| A | Raw output | `연구/개발 미리보기 · 낮은 연속 출력 0.635` |
| B | Named finite-reference percentile | `연구 참조 데이터에서의 모델 출력 위치 · 82백분위` with explicit `not probability/diagnosis/peer-match` clarification |
| C | Distribution marker without percentile number | Marker on the frozen reference output distribution; text label, not color-only |
| D | 100-position explanation | `참조 데이터의 모델 출력 분포를 100개의 위치로 나누면 약 82번째 지점입니다.` |
| E | No comparison | Raw output origin and limitation only |

## Critical comprehension items

Preserve the six B3 questions. "Unsure / 모르겠다" does **not** count as correct.

| # | Question | Correct answer |
| --- | --- | --- |
| 1 | Does `82백분위` mean an 82% chance of disease? | No |
| 2 | Is this an age/sex-matched peer comparison? | No |
| 3 | Does it mean "among people in poor health, top 18%"? | No |
| 4 | Is this number a diagnosis? | No |
| 5 | If the number goes down after a lifestyle change, does that prove health improvement caused by the change? | No |
| 6 | What is actually being compared? | Frozen reference records scored by the same frozen model |

Question wording must remain neutral. Avoid leading phrases such as "this is just
a position" or "do not worry." The answer key is fixed before recruitment.

## Study structure

### Eligibility

- Adults aged 19–70 who can read Korean.
- General population sample; no hypertension diagnosis or clinical expertise
  required.
- Participants must use a device and browser that can render the research
  prototype (320 px width or larger).

### Consent boundary

- Written informed consent before any study material is shown.
- Consent covers comprehension testing only; no clinical advice, no intervention,
  no follow-up health monitoring.
- Participants may withdraw at any time without penalty.

### Randomization and blinding

- Participants are randomized 1:1:1:1:1 to one of the five arms.
- Randomization uses a pre-generated blocked randomization list (block size 10,
  stratified by self-reported age group and sex if collected).
- Investigators who score open-text responses for item #6 are blinded to arm
  assignment. Automated scoring of fixed-format items is not blinded by
  necessity, but the scoring key is fixed before data collection.

### One presentation arm per participant

Each participant sees **exactly one** presentation arm unless a documented
methodology reason (e.g., a separate within-subjects pilot explicitly approved by
ethics review) is recorded in advance. The default between-subjects design avoids
carry-over between arms.

### Comprehension questions

- Six critical items: five true/false and one free-text/selected open response
  for item #6.
- Item #6 is scored against the exact concept: *frozen research-reference records
  scored by the same frozen model*. Synonyms that capture the same concept are
  acceptable if two independent raters agree; the pre-specified coding rubric is
  the authority.
- Optional demographic questions (age group, sex, education, self-rated health
  literacy) may be collected for exploratory subgroup analysis only.

### Neutral wording

- Questions are framed as understanding checks, not as tests of the
  participant's intelligence.
- Avoid: "obviously", "simply", "just a position", "do not confuse".
- Use: "What does this number mean?", "Is the statement true or false?".

### Primary endpoint

For each arm, the proportion of participants who answer **all six critical items
correctly**.

### Secondary endpoints

- Per-item correctness rate within each arm.
- Time spent on the presentation screen.
- Self-reported confidence (1–5) for each item.
- Overall understanding, defined as the proportion of the six items answered
correctly.

### Exclusions

- Participants who do not complete all six critical items.
- Participants who admit to having seen the study materials before the session.
- Participants who fail an attention-check item embedded in the questionnaire.
- Responses collected outside the approved field period or from unapproved
  recruitment channels.

### Missing-response handling

- Missing answers to any critical item are treated as incorrect, not excluded.
- "Unsure / 모르겠다" is a valid response category but does **not** count as
  correct.
- If a participant skips an item and later returns to answer it, the final
  answer is used.

### Stopping and quality rules

- Data quality checks are performed after every 20 completes per arm.
- Stop rules (pause recruitment, do not publish interim as final):
  - Any arm shows >20% critical misconception on item #1 (probability confusion)
    in the first 20 completes.
  - Any arm shows >20% critical misconception on item #4 (diagnosis confusion)
    in the first 20 completes.
  - Technical failure rate >10% on the presentation prototype.
- A pause triggers protocol review; it does not by itself reject the arm.

### Analysis plan

1. **Primary analysis**: per-arm proportion of participants with all six critical
   items correct.
2. **Critical-item gating**: each arm must independently satisfy, for every
   critical item:
   - Observed correctness rate >= 90%.
   - One-sided 95% lower confidence bound >= 80%.
3. **Overall understanding**: each arm must show >= 80% mean overall
   understanding.
4. **Arm comparison**: descriptive only; no formal hypothesis test for "best
   arm". Multiplicity concerns preclude declaring a winner from multiple items.
5. **Missing data**: single-value imputation = incorrect for primary analysis;
   sensitivity analysis excludes missing responses.

### Subgroup analysis

Subgroup analysis is **exploratory only**. No primary decision is conditioned on
a subgroup result. Pre-specified subgroups: age group, sex, self-rated health
literacy. No p-values are reported for subgroup differences; only descriptive
proportions and confidence intervals.

## Success criteria

B3 proposed these criteria; B4 treats them as **proposed study criteria**, not
achieved evidence:

- >= 90% correct per critical item in every arm.
- >= 80% overall understanding in every arm.
- One-sided 95% lower confidence bound >= 80% for critical-item correctness in
  every arm.

All three must hold for an arm to pass the comprehension gate. Failure on any
single critical item blocks that arm independently.

## Confidence-bound method

B4 chooses the **exact Clopper-Pearson one-sided lower 95% confidence bound** for
a binomial proportion before any real recruitment.

For `k` successes out of `n` independent trials, the one-sided lower bound `L`
satisfies:

```text
P(X >= k | p = L) = 0.05
```

Equivalently, `L` is the 5th percentile of the Beta(k, n - k + 1) distribution.
This interval guarantees at least 95% coverage for any `n` and `k`.

Special cases:

- If `k = 0`, `L = 0`.
- If `k = n`, `L = 0.05^(1/n)`.
- Missing or invalid responses are counted as incorrect (`k` does not increase).

The method is implemented in the dry-run script without adding new dependencies.

## Sample-size planning

A casual sample size is not invented. The table below shows the exact probability
of passing the dual criterion (observed correctness >= 90% **and** one-sided 95%
lower Clopper-Pearson bound >= 80%) under several true correctness rates and
sample sizes.

The columns are:

- `n`: planned completes per arm.
- `true_rate`: assumed true correctness rate for a critical item.
- `p_obs_ge_90`: probability observed proportion >= 0.90.
- `p_lb_ge_80`: probability one-sided 95% lower bound >= 0.80.
- `p_pass`: probability both hold.

Because every critical item in every arm must pass independently, the study is
stringent. The table shows that even when the true rate is 0.90, modest samples
have limited power to demonstrate the bound. At `n = 300` and true rate 0.95,
power is already high; at `n = 100` and true rate 0.90`, power is only moderate.

If the required criteria make the study impractical, the recommended action is to
hold the study and revisit either the communication design or the criteria, not
to relax the criteria after seeing data.

## Arm comparison

B4 does not declare a winner from synthetic data. Future arm comparison will:

- Report per-arm, per-item descriptive proportions and confidence intervals.
- Treat absence of statistical significance as **not** proof of equal
  comprehension.
- Use a gate structure where any critical-item misconception rate above the
  threshold blocks that arm.
- Avoid averaging high-risk misconception items with easy understanding items.

Formal between-arm tests, if ever used, would require a pre-specified
multiplicity adjustment and would remain secondary to the gating results.

## Privacy and data minimization

Collect only study-response data needed to evaluate comprehension.

**Do not collect:**

- Names, contacts, or government identifiers.
- Clinical records, medical histories, or BP measurements.
- Model V2 inputs or raw model outputs from production accounts.
- Production account identifiers, JWTs, or session tokens.
- Free-text health information beyond the item #6 response.

**Allowed with consent:**

- Comprehension responses.
- Response times and navigation order within the study screen.
- Optional age group, sex, education, and self-rated health literacy for
  exploratory subgroup analysis.

If a future real study needs data storage, a separate approval/design step is
required rather than implementing storage now.

## Synthetic dry-run

B4 creates only synthetic response data. The dry-run tests:

- randomization/schema,
- scoring,
- missing/invalid answers,
- critical-item gating,
- confidence-bound calculation,
- arm-level summary,
- deterministic report generation.

Synthetic results are prominently labeled synthetic and are never presented as
.evidence from real users.

## Decision options

At the end of B4, choose exactly one:

- `PASS_COMPREHENSION_PROTOCOL_READY_FOR_HUMAN_REVIEW`: the protocol is
  sufficiently defined to be submitted for ethics and scientific review before
  recruiting a single real participant. This is not production approval.
- `HOLD_COMPREHENSION_PROTOCOL`: the design, criteria, or feasibility require
  more work before review.
- `REJECT_CURRENT_STUDY_DESIGN`: the proposed design cannot be defended.

## Product boundary

Do not change S11 runtime, percentile display in production, Model V2 artifact,
API, DB, auth, analytics, telemetry, persistence, deployment, or
`.github/workflows/**`. Do not access G8.

## Tests and publication

Commit contract, protocol, runner, and tests before reporting any dry-run result.
Run targeted tests, lint/static checks, leakage audit, and autopilot guard. One
research PR, no auto-merge.

(End of file - total 244 lines)
