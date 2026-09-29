> **DESIGN PROPOSAL — NOT IMPLEMENTATION AUTHORITY**

Status: **design proposal only** for GitHub Issue #899. This document is an implementation-independent product-design asset. It does not authorize production behavior, product implementation beyond this docs-only task, deployment, provider changes, protected data/model changes, new persistence, new dependencies, or a later Experience Slice.

Repository baseline investigated for this draft:

- canonical repository: `AI-HealthCare-05/AH_05_07`
- live `main`: `6d3207d673b8001d8809628c0830d5a2f5affe39`
- Issue #899: open at the time of investigation
- Issue #396: open and remains the current Model V2 research-preview authorization
- current date for this draft: 2026-09-30 KST

Any future implementation must begin from then-current `origin/main`, open a new bounded GitHub Issue, and revalidate this proposal against current source, tests, contracts, runtime behavior and any current release authority.

If this proposal conflicts with current `AGENTS.md`, the current GitHub Issue/PR, [`PROGRAM.md`](../transcend/PROGRAM.md), the [Living City architecture contract](../architecture/SK7_LIVING_CITY_3D_FIRST_PRODUCT_CONTRACT.md), Model V2 contracts, privacy/data-lifecycle authorities, or another current protected contract, **the current authority wins**.

This document is not a project-management ledger, implementation roadmap registry, current-state registry, or handoff/checkpoint file. GitHub Issue/PR/Git remain live work authority.


# 07. AI Analysis Trust & Explanation Grammar

## 1. Status, baseline, and authority boundary

This proposal designs trust around the currently frozen Model V2 and any later separately approved analytical surface.

At the 2026-09-30 KST baseline, the current #396 preview window is active: **2026-09-17 through 2026-10-17 KST inclusive**, with numeric visibility ending at **2026-10-18 00:00:00 KST** unless a new human decision explicitly changes it.

This document does not extend that window and does not change the model, inputs, preprocessing, artifact, threshold policy, API projection or persistence.

## 2. Current-repository reality and evidence

### 2.1 Frozen analytical identity

Current product semantics are owned by [`model-v2-product-contract.md`](../model-v2-product-contract.md).

Current frozen schema: `model-v2-r1-schema-v1`.

The research freeze fixes exactly 11 model features derived from the complete transient product input. BP values, challenge results, prior model output and identifiers are excluded from the predictor contract.

### 2.2 Browser-local execution is a real product boundary

S11 verifies the pinned public model artifact before use and performs the protected computation browser-locally. The analysis input and result remain in browser memory only.

The current contract forbids:

- feature-bearing inference POST;
- server fallback;
- DB persistence;
- Web Storage persistence;
- URL/query payloads;
- telemetry/analytics/logging of input/result;
- S10/history/PDF persistence.

A public model asset GET is still network activity. Therefore “calculated in this browser” must not be rewritten as “nothing was downloaded” or “fully offline.”

### 2.3 Current numeric preview has intentionally narrow semantics

During the active #396 window, the continuous output is shown as a plain decimal using display-only rounding to three decimals.

It is explicitly **not**:

- probability;
- percentage;
- percentile;
- diagnosis;
- normal/abnormal classification;
- low/medium/high band;
- severity;
- future incidence;
- treatment/prevention effect.

No gauge, traffic light, color band or position may imply one of those meanings.

### 2.4 Input-derived facts are not model explanations

S11 also presents the user's entered activity, sleep and lifestyle facts as `오늘의 시작점`.

Those summaries come from the entered facts. They are not feature attribution and do not explain why the model produced a particular number.

### 2.5 Continuation is based on app state, not the model result

The current next action uses current product-state facts such as whether a current BP exists. The model output does not choose the next screen.

### 2.6 Expiry is executable presentation policy

[`modelV2VisibilityPolicy.ts`](../../web/src/ui/modelV2VisibilityPolicy.ts) enforces the date window. Outside it, numeric output is discarded from presentation. Open result/resume/pending completion must also respect expiry.

## 3. User promise / North Star

> “I can see what I entered, where the analysis ran, which model identity was used, what the current output is allowed to mean, and what it is not allowed to mean.”

Trust comes from provenance and bounded claims, not from making the number look authoritative.

## 4. Problem statement

Analytical interfaces often create false confidence through:

- a single large number with no provenance;
- colored bands that imply thresholds;
- “AI analyzed your health” wording;
- unexplained latency;
- model output blended with input summaries;
- permanent-looking results that are actually transient;
- technical disclosures that overwhelm the primary limitation.

SK7 needs a compact trust grammar that is clear to ordinary users while still inspectable by technical reviewers.

## 5. Principles

### 5.1 Meaning before decoration

Never decorate the number into a classification the contract does not authorize.

### 5.2 Provenance is layered

Expose technical identity progressively:

```text
what you entered
→ where calculation ran
→ current result meaning
→ model/artifact identity
→ optional technical details
```

### 5.3 Local computation is not a safety claim

Say what actually happens: browser-local analysis, verified public asset download, no analysis-input/result server transmission or storage.

### 5.4 Speed is operational, not semantic

Do not imply a fast result is more certain or higher quality.

### 5.5 Input summary ≠ explanation

Do not present user-entered lifestyle facts as “the AI says these caused your result.”

### 5.6 Expired preview disappears cleanly

After the authorized window, the product should still complete the input flow and show the existing non-numeric outcome/next actions without a stale number.

## 6. Protected boundaries

- Frozen 11-feature order and semantics.
- Frozen artifact and preprocessing.
- Target leakage prohibition.
- Cross-sectional target only.
- No threshold/band/probability.
- No persistence/logging/telemetry.
- No BP/challenge/prior result joins.
- No Model V2 output in world growth, companion mood, records or PDF.
- No hidden server fallback.
- No preview extension by design prose.

## 7. Ownership / architecture seams

| Concern | Owner |
| --- | --- |
| Feature semantics / artifact identity | frozen Model V2 contracts |
| Product input validation | current S11 input flow / adapter |
| Artifact verification | current browser inference path |
| Numeric visibility window | product contract + visibility policy + #396 |
| Result formatting | presentation layer only |
| Lifestyle summary | entered input facts, not model interpretation |
| Next action | current app state |
| API projection | separate authenticated two-field API contract |
| World/companion | no analytical input authority |

### 7.1 Provenance chain should be inspectable without becoming the hero

The trust hierarchy can be thought of as a five-link chain:

```text
product input
→ versioned adapter
→ frozen feature vector
→ verified frozen artifact
→ presentation policy
```

The user does not need all five links expanded at once. But an implementation should be able to point to the exact owner for each link.

Do not create a sixth “interpretation service” that silently translates the continuous output into a new category.

### 7.2 Execution provenance versus result semantics

Two independent questions must remain separate:

1. **Can we prove which artifact computed this value?**
2. **What is the product allowed to say this value means?**

A strong SHA/provenance answer to the first does not expand the second.

### 7.3 Applicability caution is not thresholding

Age or input applicability messages can explain contract limits. They must not be converted into a hidden confidence score or into a lower/upper “validity band” around the output unless separately researched and authorized.

## 8. Trust-state grammar

### 8.1 Pre-computation

Show:

- analysis purpose;
- required input completeness;
- browser-local/privacy cue;
- optional technical detail behind disclosure.

Do not show a placeholder score.

### 8.2 Validating

Explain that the input is being checked. Invalid/missing data returns to correction, not imputation by UI.

### 8.3 Loading/verifying artifact

A concise state may say the analysis component is being prepared. Optional disclosure can name artifact verification.

Do not fabricate a percentage unless actual measurable progress exists.

### 8.4 Computing

Keep the form/input ownership clear and prevent duplicate submissions according to current guards.

### 8.5 Preview result — only inside current authorization

Primary order:

1. `연구 모델 분석 결과`;
2. `연구/개발 미리보기 · 내부 연속 출력`;
3. plain decimal;
4. concise “what this is / is not”;
5. local computation/privacy cue;
6. `오늘의 시작점` input summary;
7. next action;
8. optional technical disclosure.

### 8.6 Non-numeric completion

Outside the preview window:

- no numeric output;
- no hidden “last number”;
- input summary and continuation can remain where current contract permits;
- explain completion without pretending a score exists.

### 8.7 Failure

Fail closed. No provisional number, no fallback estimate, no server score.

### 8.8 Input-review grammar

Before computation, a compact review may group the 19 product inputs into user-understandable categories such as:

- 기본 정보;
- 신체 정보;
- 흡연·음주;
- 걷기·근력 활동;
- 수면.

This is only an input review. Do not surface the 11 frozen model feature names as if they were clinical factors unless the product copy deliberately explains the adapter mapping.

Unknown/refused/structural skip should remain distinguishable where the current adapter supports them.

### 8.9 Technical disclosure levels

A future UI may use three disclosure levels:

**Level 0 — always visible**
- research-preview label;
- what the number is not;
- local computation/storage cue.

**Level 1 — user-requested**
- input categories used;
- frozen model/schema version;
- current preview expiry date.

**Level 2 — technical**
- artifact digest;
- adapter/schema identifiers;
- public asset verification details.

This hierarchy is design guidance, not a requirement to expose every internal identifier in production.

## 9. Desktop, mobile, adaptive behavior

Desktop may place a compact provenance panel beside/below the result.

Mobile should not stack four warning cards before the result. Use progressive disclosure:

```text
result
one-line limitation
one-line local privacy cue
[what this means]
[technical details]
```

At 320 or enlarged text, the decimal must not force horizontal scroll or become visually similar to a diagnosis banner.

## 10. Accessibility and non-primary-input equivalents

- Result label is announced with the value, not value alone.
- “Not a probability/diagnosis” remains text, not tooltip-only.
- Disclosure controls are keyboard reachable.
- Technical hashes/IDs can wrap or be copied without breaking reading order.
- Color is never used to imply high/low.
- Loading and failure states use bounded status announcements.
- Focus moves to the result/failure summary after explicit analysis completion only when that behavior remains coherent with current S11 flow.
- Reduced motion does not change analytical meaning.

## 11. Loading, failure, recovery

- Missing/invalid input: correction, no model run.
- Artifact unavailable or verification failure: fail closed.
- WebCrypto/arithmetic failure: fail closed.
- Hidden/route change/sign-out/account switch: discard transient result.
- Explicit user retry may start a fresh attempt where current code permits.
- Preview window expiry during an open page removes numeric presentation.
- Preview expiry while a computation is pending is re-evaluated at completion.
- No cached result restoration after reload.

### 11.1 Slow execution and progress language

Do not invent percent progress for:

- asset download;
- SHA verification;
- artifact parsing;
- inference.

If exact measurable progress is unavailable, use a bounded stage label such as “분석 준비 중” or “계산 중” and preserve an explicit cancel/leave path where current flow permits.

### 11.2 Result lifetime

The result has no durable ownership. Leaving/reload/sign-out/account switch ends the current result. Therefore phrases such as “saved analysis,” “your previous score,” or “history” are invalid in the current contract.

### 11.3 Retry semantics

A retry is a fresh transient analysis attempt from currently valid input under the current model/presentation policy. It is not recovery of a previous result.

## 12. Conflicts and anti-patterns

| Anti-pattern | Problem |
| --- | --- |
| Gauge / red-yellow-green | invents threshold |
| “82% risk” | converts continuous output to probability |
| “Your sleep raised the score” | false feature attribution |
| World darkens with result | analytical output enters world semantics |
| Result stored in S10 | violates transience |
| “Fully private/offline” | public artifact download still occurs |
| Technical hash as hero | overwhelms user meaning |
| Hide limitations behind deep disclosure | primary trust information disappears |
| Keep last number after Oct 17 | violates #396 expiry |

## 13. Explicit non-goals

No threshold selection, probability calibration, percentile, comparator ranking, diagnosis, treatment guidance, model explanation algorithm, SHAP, retraining, recalibration, new input, new artifact, persistence, telemetry, server inference fallback, PDF/history result, or #396 extension.

### 13.1 Wording substitutions

Prefer:

- `연구 모델 분석 결과`
- `내부 연속 출력`
- `이 숫자는 확률이나 진단이 아닙니다`
- `이 브라우저에서 계산됨`
- `저장 안 함`

Avoid:

- `위험도`
- `위험 확률`
- `정상 범위`
- `AI 진단`
- `건강 점수`
- `당신은 상위/하위 ...%`
- `개선됨`

## 14. Candidate future implementation slices

### 07-A — Result trust hierarchy polish
Improve result/limitation/privacy ordering without changing semantics.

### 07-B — Input provenance review before run
Compact review of entered values/categories and structural skips before explicit computation.

### 07-C — Model identity disclosure
Optional technical panel naming schema/artifact digest/version and local execution facts.

### 07-D — Post-preview-window handoff
Design and verify the non-numeric completion state at/after 2026-10-18 KST without any window extension.

### 07-E — Failure/retry clarity
Unify artifact verification, unavailable execution and explicit retry wording.

### 07-F — Future comparator/reference decision
Decision-first only. Any population reference, percentile or comparator requires separate research/product authority; this proposal does not authorize it.

## 15. Dependencies and prerequisites

- Proposal 05 owns sensory feedback only.
- Proposal 06 must keep Model V2 out of record history/report.
- Proposal 08 owns transient/browser/account vocabulary.
- Proposal 09 owns failure/retry grammar.
- Proposal 10 owns evidence proportionality.
- Current #396 and product contract win over this proposal.

## 16. Acceptance / evidence ideas

- Test 2026-10-17 23:59:59 KST vs 2026-10-18 00:00:00 KST presentation boundary.
- Complete analysis, background page, cross expiry, resume: no stale number.
- Artifact verification failure shows no provisional value.
- Network inspection confirms no feature-bearing inference POST.
- Storage inspection confirms no Model V2 input/result persistence.
- Copy review rejects probability/band/diagnosis wording.
- Visual review confirms no color/position implies high/low.
- Screen-reader path announces label + decimal + limitation coherently.
- Direct Guest S11 follows same temporary visibility window without Auth/API privileges.

### 16.1 Adversarial trust review

Use synthetic cases where:

- the decimal is near 0, near 1, negative if mathematically possible, or otherwise visually “extreme” within the actual output domain;
- the same output appears for very different input summaries;
- computation finishes exactly at the preview expiry boundary;
- artifact load fails after input completion;
- the user leaves and re-enters.

The interface must not accidentally create a “high score” reading from numeric magnitude, position, color, or celebratory motion.

### 16.2 Network/storage evidence

A future implementation that changes S11 trust presentation should record evidence matching the claim:

- request inspection for feature-bearing POST absence;
- Web Storage inspection for input/result absence;
- route/history inspection for URL payload absence;
- sanitized logs only when a change touches logging behavior.

Do not collect real user values merely to prove privacy.

## 17. Risks / unresolved questions

- How much artifact identity should ordinary users see by default?
- Can a compact privacy cue avoid overclaiming confidentiality while remaining understandable?
- Does showing three decimals invite false precision even with explicit limitations? The current contract authorizes it for the preview; permanent semantics remain unresolved.
- What should replace the visual emphasis of the number after expiry so the flow does not feel broken?
- If future research authorizes a comparator, can it be presented without becoming an implicit diagnosis?
- How should speed/load explanations distinguish first artifact load from computation time without creating performance promises?

### 17.1 Cross-document ownership note

Proposal 07 owns analytical trust/meaning only. It does not create a record lane (06), a storage scope (08), a recovery engine (09), sensory interpretation (05) or world input (04). The shared term `transient analysis` means browser-memory input/result under the current Model V2 contract, not browser-local persistence.

## 18. Live revalidation checklist before any implementation Issue

1. Resolve current `origin/main` and current date/time in KST.
2. Re-read #396 and `model-v2-product-contract.md`.
3. Confirm preview window has not been extended/replaced.
4. Re-read current visibility policy and S11 source.
5. Verify current artifact/schema/digest and 11-feature contract.
6. Verify browser-local computation path and network/storage boundaries.
7. Verify API projection remains separate.
8. Enumerate all proposed visible meanings; reject any threshold/probability/band implication.
9. Verify input-derived summary is not model explanation.
10. Verify result never enters S10/report/PDF/world/companion.
11. Exercise expiry on open result, resume and pending completion.
12. Exercise invalid input, artifact unavailable, explicit retry and route exit.
13. Check 320/390/desktop, enlarged text, keyboard, screen reader semantics, forced colors and reduced motion as relevant.
14. Stop and open protected decision work if model, feature, artifact, threshold, persistence or #396 authority would change.
