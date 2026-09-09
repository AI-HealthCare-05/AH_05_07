# Technical depth plan

Bounded roadmap. `CODE-PATH` means source inspection identifies the boundary; it does not confirm a defect. `INCONCLUSIVE` means evidence is insufficient.

Current audit closure: **R1–R11 COMPLETE; R12 DEFER** as of 2026-09-09. Historical Issue/PR/release evidence remains historical and is not promoted to current runtime state by this summary.

| Item | Status | Motivation / component boundary | Dependencies | Verification gate | Production change | Owner | Estimate | Evidence |
|---|---|---|---|---|---|---|---|---|
| R1 — Auth dependency failure semantics | COMPLETE | Separate invalid session from Auth outage at API/client contract. | Current 401 semantics freeze | Contract and failure tests | Yes | W | M | COMPLETE — missing credentials and invalid sessions remain `401`; Auth timeout/transport/429/5xx/unclassified or malformed-success failure normalizes to `503 auth_unavailable`; contract and regression coverage merged. |
| R2 — account-deletion session race | COMPLETE | Prevent old deletion completion from clearing a newer same-user session. | Generation/token comparison semantics | Deterministic race test | Yes | M | M | COMPLETE — stale account-deletion completion is prevented from clearing a newer same-user session; deterministic regression coverage merged. |
| R3 — required CI contract coverage | COMPLETE | Enforce already-existing core invariants in CI first; add R1/R2-specific coverage when those contracts merge. | Existing core tests; R1/R2 contract decisions for their follow-up tests | Required core contract suite, then R1/R2 suites | No, unless a defect is fixed | W | M | COMPLETE — canonical core contract suites and the bounded R1/R2 coverage are required in CI. |
| R4 — DTO/error/deadline/cache contracts | COMPLETE | Split bounded API DTO/error, client deadline, and cache changes. | Frozen full-response timeout and unknown-write semantics | Per-split contract tests | Conditional | shared | M | COMPLETE — bounded DTO/error/deadline contracts merged; browser total timeout is bounded through headers/body and uncertain writes are neither automatically retried nor reported as successful. |
| R5 — DB concurrency/direct-access semantics | COMPLETE | Reproduce and test before calling any hypothesized race a defect. | Synthetic direct-access fixture | Reproduction, RLS, and concurrency evidence | Conditional | W | M | COMPLETE — challenge Data API, ownership/RLS, concurrency, and direct-access boundaries were audited with synthetic evidence before changing behavior. |
| R6 — Model V2 runtime lifecycle | COMPLETE | Runtime/execution lifecycle only; frozen model is unchanged. | MODEL-01 through MODEL-05 and MODEL-06A / MODEL-06B / MODEL-06C | Artifact/lifecycle contract tests | Conditional | W | M | COMPLETE — artifact sync/hash/load runtime behavior and operational cost were measured without changing frozen Model V2 semantics or introducing a cache/service split. |
| R7 — legacy/build/CSP | COMPLETE | Split legacy surface, build-context boundary, and browser trust controls; do not remove routes without consumer inventory. | Consumer inventory | Per-boundary build/browser gate | Conditional | shared | M | COMPLETE — bounded Docker root-context, `.dockerignore`, and legacy-route scope audit completed without speculative route removal or architecture expansion. |
| R8 — privacy-preserving structured telemetry | COMPLETE | Add only minimized structured observability. | Forbidden-field contract | Telemetry schema and redaction gate | Conditional | W | M | COMPLETE — observability/SLO and retention-purge health boundaries were verified; both production purge jobs were active, fresh, and recently successful with no production mutation. |
| R9 — immutable release manifest | COMPLETE | Bind source, build, runtime, model, verification, rollback evidence. | Release tuple ownership | Manifest validation | No until used for release | W | M | COMPLETE — immutable API provenance manifest and offline verifier bind repository-controlled source/build evidence to recorded runtime/model/rollback identities without claiming hermetic reproducibility. |
| R10 — full-stack/restore/rollback drills | COMPLETE | Define recovery objectives and isolated procedure first. | R9 identity tuple | Isolated drill with recovery evidence | Conditional | W | M | COMPLETE — isolated synthetic reconstruction PASS at baseline `bd5a80cad4e8428f39b97c2f0c5a4e2dee728182`; current managed DB/Auth restore point not observed; finite managed production-data RPO not established; managed restore RTO not measured; production managed restore drill DEFERRED; owner explicitly accepted the current residual recovery risk on 2026-09-09. This acceptance does not authorize backup/PITR/plan/topology changes. |
| R11 — repository shared memory/contracts | COMPLETE | Issue #363 / Checkpoint 0. | None | Docs review and links | No | shared | S | COMPLETE — Checkpoint 0 contracts remain canonical; post-R10 reconciliation records R1–R11 as complete while preserving R12 as measured-trigger-only DEFER. |
| R12 — scale/topology changes | DEFER | Existing topology is intentionally managed. | Measured evidence and ADR | Measured trigger review | No | shared | L | INCONCLUSIVE |

Class A — requires measured trigger + ADR before consideration:

- custom authentication architecture
- Kubernetes/service mesh
- arbitrary microservice split
- Redis/queue/worker
- separate inference service

Class B — prohibited by the current frozen Model V2 invariants and NOT
authorizable by an ADR alone:

- Model V2 input/result persistence
- retraining
- recalibration
- feature changes
- model-family replacement
- BP/challenge/prior-result/other-account joins

Changing a Class B invariant requires the separate explicit approval process that
owns the frozen invariant.

Initial R3 work can proceed in parallel with R1 and R2 by gating the already-
existing core tests. R1/R2-specific tests become required CI coverage when
those contracts merge; R3 does not need to wait for both streams to complete
before its initial gate is useful.
