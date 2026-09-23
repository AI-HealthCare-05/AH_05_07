# Model V2 Product Contract

## Current authority

This document owns current S11 visibility and product semantics. Requirements,
architecture/scene guidance and AGENTS reference this decision rather than
maintaining independent preview windows. [Issue #396](https://github.com/AI-HealthCare-05/AH_05_07/issues/396)
records the human authorization; the 2026-09-19 instruction makes the already
approved output visible by default. Source capability and deployed runtime are
separate; follow [Deployment SSOT](deployment-ssot.md) for release verification.

## Current S11 research/development preview

- Window: **2026-09-17 through 2026-10-17 KST**, inclusive. Numeric output ends
  at **2026-10-18 00:00:00 KST** unless explicitly extended by a human decision.
- Audience: signed-in S11 users and, during the same window only, isolated
  Guest S11 (`?guest=1`) with transient browser-memory input. This Guest
  expansion is temporary and bounded by the same preview dates.
- After successful browser-local frozen computation, show the continuous output
  immediately under **`연구 모델 분석 결과`**, labelled
  **`연구/개발 미리보기 · 내부 연속 출력`**. The primary result is default-visible,
  a plain decimal displayed with `toFixed(3)`. Rounding is display-only and never
  feeds inference or establishes a threshold.
- It is not a probability, percentage, percentile, diagnosis, normal/abnormal
  result, low/medium/high band, severity, future incidence, or treatment/prevention
  effect. No traffic-light, gauge, color or position may imply such a classification.
- This temporary visibility does not authorize permanent numeric semantics, a
  G10 threshold decision, recalibration, retraining, or a production deployment.
- Guest (`?guest=1`) S11 participates only through the same temporary window and
  receives no authentication, API, database, or persistence privileges. Guest model
  input and result remain browser-memory-only; verified public model asset GET is
  still allowed. After the window, Guest local flow may complete with the existing
  non-numeric outcome and the existing numeric-hiding policy applies.

Result order: visible output, what it is/is not, local privacy cue, existing
“오늘의 시작점” activity/sleep/lifestyle summary, existing state-aware next action,
then optional technical/11-feature disclosures. Semantic limitations and the
privacy cue remain visible beside the number. BP/challenge facts may choose the
next screen but never enter inference or interpret its output.

## Product semantics and applicability

- Product wording: **`입력 기반 위험군 선별 신호`**.
- Schema: `model-v2-r1-schema-v1`. [Architecture invariants](architecture/ARCHITECTURE_INVARIANTS.md)
  own the frozen model identity and exact 11-feature order/semantics. Preserve the
  artifact, fitted preprocessing and target-leakage prohibition; do not substitute
  or reorder inputs or infer them from BP/challenge/prior-result/other-account data.
- The [versioned adapter](../web/src/lib/model-v2/adapter.ts) derives the frozen
  features from complete, transient 19-field product input. Reject under-19 use;
  unknown age cannot establish eligibility. Age 80+ requires a caution without a
  new upper cutoff.
- Missing keys, unanswered or invalid answers must not be silently imputed or
  converted to null. Preserve explicit structural skips. Only an approved,
  versioned adapter may map explicit unknown/refused answers to supported nulls;
  frozen imputation capability does not authorize incomplete product input.
- Preserve the frozen sleep derivation: browser bedtime `00:xx` normalizes to
  `24:xx`; wake `00:xx` remains unchanged. Self-reported inputs do not establish
  equivalence to survey measurement. Research-cohort selection does not authorize
  collecting identifiers or additional medical history.
- The target is cross-sectional, not future incidence. The output is not a
  diagnosis, treatment/prevention effect or causal-improvement claim.
- Model output, measured BP and challenge participation remain separate facts.
  Model input is optional for recording, challenge, history and export, which
  retain their existing authentication, ownership and retention rules.
- The [synthetic-demo scope](../README.md#안전-및-제품-계약) and
  [AGENTS privacy boundaries](../AGENTS.md) remain binding; this preview does not
  authorize real-user health-data expansion, secondary training, profile
  enrichment or advertising use.

## Browser inference/privacy boundary

[ADR-0008](adr/0008-s11-verifiable-local-inference.md) records the accepted public
model-disclosure tradeoff. Build-pinned SHA-256 verification precedes artifact
parsing/use. Browser owners can reconstruct internal continuous outputs from
disclosed fitted parameters; that fact grants no additional display semantics.

Analysis input/output remains **browser memory only**: no feature-bearing
inference POST, server fallback, DB or Web Storage persistence, S10/history/PDF
result, URL/query payload, telemetry, analytics or logging (including errors,
traces and debugging). No BP/challenge/prior-result/other-account feature joins.
Existing Auth session storage and BP/challenge retention grant no model storage
permission. Guest S11 adds no Supabase auth bootstrap, fake session, `/api/v1/**`
access, backend refresh/retry, account mutation, or model input/result persistence.

Verified public model asset GET is allowed. The visible cue
“이 브라우저에서 계산됨 · 분석 입력·결과 서버 전송 없음 · 저장 안 함”
refers to analysis input/result, not all application network activity. Technical
disclosure explains asset downloads; do not claim absolute confidentiality.

## API boundary

The authenticated `/api/v1/model-v2/product-score` projection remains exactly:

- `schema_version`
- `product_wording`

Browser-local numeric output is not an API response. Preserve the
[API contract](api-contract.md)'s authentication, strict validation, no-store,
safe errors and independent legacy-route boundary. The separate semantic route's
applicability must not be inferred from S11; [architecture invariants](architecture/ARCHITECTURE_INVARIANTS.md)
own that distinction.

## Failure and expiry

Fail closed without a provisional number or server fallback. Outside the preview
window, discard numeric output and show non-numeric completion with the existing
lifestyle summary/actions. Enforce expiry on an open result, page resume and
pending completion. Leaving, reload, sign-out and account switch must not restore
any prior transient draft/result. Preserve request/session generation guards,
pending locks and explicit-only retries.

## Change control

A future preview extension requires an explicit human decision and coordinated
changes to this contract, [modelV2VisibilityPolicy](../web/src/ui/modelV2VisibilityPolicy.ts)
and focused tests. Threshold, model, preprocessing, feature, retraining or
recalibration changes require a separate protected decision.

## Historical evidence

The complete retained T1 planning record moved to the
[historical research snapshot](research/model-v2-t1-product-planning-20260908.md);
its old readiness/blocker labels do not define current behavior.
