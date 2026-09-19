# Architecture Research Run 01

Baseline for this run: `f979b9b7046f6d7395ae3fa2bc0a1340304a16d5`.

This run follows the architecture audit without treating EDA, FHIR, or a
circuit breaker as mandatory upgrades. Structured-feedback/survey expansion is
explicitly excluded from this run.

## Baseline hardening

Confirmed source defects are separated from research hypotheses:

1. Preserve `challenge_selection_locked` as its own 409 recovery message before
   the generic observation-conflict handler.
2. Enforce `systolic > diastolic` in PostgreSQL so direct authenticated Data API
   writes cannot bypass the FastAPI invariant.
3. Correct documentation drift around browser-local S11 execution, the
   time-boxed numeric research/development preview, and the older NHANES data
   contract versus the current KNHANES 2024 Model V2 generation.

These fixes do not justify an architecture expansion.

## Lane A — lifecycle and concurrency

Questions:
- Can challenge selection race with the first check-in while preserving the
  action-lock invariant?
- What state remains visible if an ended challenge is closed and replacement
  creation fails or its response is lost?
- Can the independent reads assembled by the observation window describe
  incompatible moments?
- What remains visible in a browser after server-side expiry or account deletion?

Hypothesis:
Existing database constraints and browser request/session guards preserve the
declared invariants, while any partial completion can be represented truthfully
without introducing a queue or event log.

Experiment:
Use synthetic users, disposable local Supabase, deterministic interleavings,
and the existing pgTAP/browser fixtures. Reproduce a counterexample before
changing product semantics.

Metrics:
Invariant violations, duplicate active challenges, action/check-in mismatches,
partial-state duration, stale completion acceptance, recovery steps, and any
cross-user disclosure.

Stop condition:
If a concrete invariant violation appears, stop expansion and fix that boundary
first. Do not introduce global transactions, EDA, or distributed locking merely
to continue the research.

## Lane B — deadline composition and resilience

Questions:
- How much of the user-visible deadline is consumed by Auth before Data API work
  begins?
- Does the existing bounded initial-read retry amplify upstream calls enough to
  matter under sustained dependency failure?
- Can a coordinated end-to-end read budget improve completion and recovery
  without changing write semantics?

Experiment arms:
- A — current: existing browser deadline and bounded initial-read retry.
- B — coordinated budget: dependency budgets fit inside one end-to-end read
  budget; at most one eligible read retry uses only remaining time. Writes stay
  single-attempt.
- C — optional breaker: run only if A/B demonstrate sustained dependency failure
  plus enough request volume to justify comparison.

Fault cases should include Auth delay, Data API delay, one slow member of the
window fan-in, stalled response body, response loss after a committed write,
session replacement during retry, and recovery with old requests still in
flight.

Metrics:
P50/P95/P99 with sample sizes, completion rate, failure latency separately from
success latency, upstream calls per logical action, calls during outage,
recovery time, stale completion acceptance, duplicate effects, and uncertain
write reconciliation.

Stop condition:
If coordinated deadlines are sufficient, do not add a circuit breaker. A fast
failure is not a success merely because it lowers latency.

## Lane C — Model V2 input semantic fidelity

The current parity work proves computation consistency, not that humans map
realistic situations into the frozen input semantics correctly.

Use fictional scenarios with known intended interpretations for walking active
days versus duration, `5_plus_days`, alcohol structural branches, midnight
sleep crossings, and irregular schedules. Keep “cannot be represented
faithfully” as a valid result.

Measure semantic answer accuracy, forced-answer frequency, correction rate,
abandonment, and completion time. Do not alter the frozen model, final test,
thresholds, or preprocessing to repair an interface finding.

## Lane D — narrow FHIR interoperability

Only after the baseline/lifecycle work is stable, prototype a synthetic
blood-pressure adapter outside production.

- Preserve one BP pair as components.
- Use the established systolic/diastolic coding and UCUM mmHg representation.
- Preserve day-level precision; do not invent a measurement clock time from
  `created_at`.
- Preserve morning/evening semantics explicitly.
- Use only synthetic patient identity in the experiment.
- Validate and round-trip through an independent disposable receiver.

Do not convert the internal database to FHIR, deploy a FHIR server, export Model
V2 output as a diagnosis/risk band, or turn challenge completion into prescribed
treatment adherence.

## EDA decision gate

No production EDA migration is authorized by this research run.

Reconsider a durable asynchronous boundary only after a concrete independent
consumer or long-running workload is demonstrated and measured. Any later
prototype must account for atomic write/outbox behavior, idempotency, ordering,
replay, DLQ ownership, authorization, retention, deletion, and UI
eventual-consistency states.

If there is no independent consumer, no breached request budget, or no net
benefit after those costs, retain the synchronous architecture.
