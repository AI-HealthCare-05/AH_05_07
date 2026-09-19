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
| A | Raw output | `연구/개발 미리보기 · 내부 연속 출력 0.635` |
| B | Named finite-reference percentile | `조사 가중치를 적용한 연구 위치 · 약 82백분위`; the same synthetic score has unweighted finite rank about 77.56 |
| C | Distribution marker without percentile number | Marker for the survey-weighted research-position example; text label, not color-only |
| D | 100-position explanation | Survey-weighted research-position example described as `약 82번째 지점`; no population claim |
| E | No comparison | Raw output origin and limitation only |

Arms B–D use the same **survey-weighted research-position example** for study
consistency. The same synthetic score has an unweighted finite rank of about
77.56. The weighting policy remains unresolved for product use; neither position
is a Korean-population percentile or a disease probability.

## Critical comprehension constructs

Preserve the six B3 misconception constructs. "Unsure / 모르겠다" does **not**
count as correct.

| # | Construct | Correct concept |
| --- | --- | --- |
| 1 | Disease-probability confusion | The displayed model output/reference position is not a disease probability |
| 2 | Peer-match confusion | It is not an age/sex-matched peer comparison |
| 3 | Health-severity confusion | It does not rank overall health or disease severity |
| 4 | Diagnosis confusion | It is not a diagnosis |
| 5 | Causal-improvement confusion | A lower later value/position does not prove lifestyle-caused improvement |
| 6 | Actual comparator | Frozen research-reference records scored by the same frozen model |

The **constructs and scoring key are fixed**, but the surface wording is
arm-specific so participants are never asked about a stimulus they did not see.
Arms A/E refer to the shown internal continuous output; B refers to the shown
weighted percentile example; C refers to the distribution marker; D refers to
the shown 100-position explanation. Primary scoring uses fixed-choice responses,
including item #6, so no free-text health information or subjective rater
adjudication is required.

Question wording must remain neutral. Avoid leading phrases such as "this is just
a position" or "do not worry."

## Study structure

### Eligibility

- Adults aged 19+ who can read Korean.
- General population sample; no hypertension diagnosis or clinical expertise
  required.
- Participants must use a device and browser that can render the research
  prototype (320 px width or larger).

### Consent boundary

- Written informed consent before any study material is shown.
- Consent covers comprehension testing only; no clinical advice, no intervention,
  no follow-up health monitoring.
- Participants may withdraw at any time without penalty.

### Randomization and masking

- Participants are randomized 1:1:1:1:1 to one of the five arms.
- Randomization uses a pre-generated balanced blocked list (block size 10).
- Primary allocation is **not stratified by optional demographic variables**.
  Optional age group, sex, education, or health-literacy items are collected only
  for separately approved exploratory analysis.
- All six primary comprehension items use a frozen fixed-choice scoring key.
  Participants are not shown the other study arms before completing their
  assigned arm.

### One presentation arm per participant

Each participant sees **exactly one** presentation arm unless a documented
methodology reason (e.g., a separate within-subjects pilot explicitly approved by
ethics review) is recorded in advance. The default between-subjects design avoids
carry-over between arms.

### Comprehension questions

- Six critical fixed-choice items implement the six frozen constructs with
  arm-specific neutral wording.
- Item #6 includes `frozen research-reference records scored by the same frozen
  model` as the correct concept and plausible misconception distractors.
- Optional demographic questions (age group, sex, education, self-rated health
  literacy) may be collected for exploratory subgroup analysis only and are not
  required for randomization.

### Neutral wording

- Questions are framed as understanding checks, not as tests of the
  participant's intelligence.
- Avoid: "obviously", "simply", "just a position", "do not confuse".
- Use: "What does this number mean?", "Is the statement true or false?".

### Primary decision rule

For each arm, **every one of the six critical misconception items independently**
must satisfy:

- observed correctness rate >= 90%; and
- one-sided 95% lower confidence bound >= 80%.

The arm must also have mean overall understanding >= 80%. A failed critical item
blocks that arm even when its average score is high.

### Secondary/descriptive endpoints

- Proportion answering all six critical items correctly.
- Per-item correctness rate and confidence bound within each arm.
- Time spent on the presentation screen.
- Self-reported confidence (1–5) for each item.
- Mean overall understanding across the six items.

### Primary analysis population and quality flags

After valid consent and successful exposure to the randomized arm, a participant
remains in the primary analysis even if one or more critical responses are
missing, invalid, or `unsure`; those responses count as incorrect.

Pre-randomization ineligibility, duplicate/fraudulent enrollment, or failure to
receive/render the assigned stimulus may be excluded only under rules frozen
before recruitment. An attention-check failure is a **quality flag**, not an
automatic primary-analysis exclusion; a secondary sensitivity analysis may
report results with flagged records removed.

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

1. **Primary decision**: apply the per-item observed-rate and confidence-bound
   gates independently to all six critical items within each arm.
2. **Overall understanding gate**: each arm must show >= 80% mean overall
   understanding; this never overrides a failed critical item.
3. **Secondary all-correct endpoint**: report the proportion answering all six
   critical items correctly, without using it to rescue a failed item-level gate.
4. **Arm comparison**: descriptive only; no formal hypothesis test for "best
   arm". Multiplicity concerns preclude declaring a winner from multiple items.
5. **Missing data**: missing/invalid/unsure critical responses count as incorrect
   in the primary analysis; complete-case results are sensitivity analysis only.
6. **Quality flags**: report attention-check/technical quality flags separately
   and provide a sensitivity analysis if exclusions are scientifically justified.

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

This table is a **per-critical-item operating characteristic only**. It is not
the probability that an entire arm passes all six items, because responses to
the six items from the same participant are dependent and no independence
assumption is made.

The table shows that even when the true per-item rate is 0.90, the observed-rate
gate remains difficult to pass with high probability. At `n = 300` and a true
per-item rate of 0.95, single-item power is already high; at `n = 100` and a true
rate of 0.90, it is only moderate.

B4 therefore does **not** freeze a final `n` per arm. Before any recruitment, a
separate scientific/statistical review must freeze the final sample size after
considering the six-item joint decision rule, within-participant dependence,
expected attrition/technical non-exposure, and feasibility.

If the required criteria make the study impractical, the recommended action is
to hold the study and revisit either the communication design or the criteria,
not to relax the criteria after seeing data.

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
- Free-text health information; primary item #6 uses fixed-choice responses.

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
evidence from real users.

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
