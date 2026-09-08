# Technical depth plan

Bounded roadmap. `CODE-PATH` means source inspection identifies the boundary; it does not confirm a defect. `INCONCLUSIVE` means evidence is insufficient.

| Item | Status | Motivation / component boundary | Dependencies | Verification gate | Production change | Owner | Estimate | Evidence |
|---|---|---|---|---|---|---|---|---|
| R1 — Auth dependency failure semantics | ACCEPT / priority | Separate invalid session from Auth outage at API/client contract. | Current 401 semantics freeze | Contract and failure tests | Yes | W | M | CONFIRMED — current source normalizes all Auth non-200 responses to invalid-session `401`; outage distinction remains follow-up work. |
| R2 — account-deletion session race | ACCEPT / priority | Prevent old deletion completion from clearing a newer same-user session. | Generation/token comparison semantics | Deterministic race test | Yes | M | M | CODE-PATH — no race reproduction yet. |
| R3 — required CI contract coverage | ACCEPT / priority | Enforce already-existing core invariants in CI first; add R1/R2-specific coverage when those contracts merge. | Existing core tests; R1/R2 contract decisions for their follow-up tests | Required core contract suite, then R1/R2 suites | No, unless a defect is fixed | W | M | CONFIRMED — current CI coverage gap. |
| R4 — DTO/error/deadline/cache contracts | MODIFY | Split bounded API DTO/error, client deadline, and cache changes. | Frozen full-response timeout and unknown-write semantics | Per-split contract tests | Conditional | shared | M | CODE-PATH |
| R5 — DB concurrency/direct-access semantics | MODIFY | Reproduce and test before calling any hypothesized race a defect. | Synthetic direct-access fixture | Reproduction, RLS, and concurrency evidence | Conditional | W | M | INCONCLUSIVE |
| R6 — Model V2 runtime lifecycle | ACCEPT | Runtime/execution lifecycle only; frozen model is unchanged. | MODEL-01 through MODEL-05 and MODEL-06A / MODEL-06B / MODEL-06C | Artifact/lifecycle contract tests | Conditional | W | M | CODE-PATH |
| R7 — legacy/build/CSP | MODIFY | Split legacy surface, build-context boundary, and browser trust controls; do not remove routes without consumer inventory. | Consumer inventory | Per-boundary build/browser gate | Conditional | shared | M | CODE-PATH |
| R8 — privacy-preserving structured telemetry | ACCEPT | Add only minimized structured observability. | Forbidden-field contract | Telemetry schema and redaction gate | Conditional | W | M | INCONCLUSIVE |
| R9 — immutable release manifest | ACCEPT | Bind source, build, runtime, model, verification, rollback evidence. | Release tuple ownership | Manifest validation | No until used for release | W | M | CODE-PATH |
| R10 — full-stack/restore/rollback drills | MODIFY | Define recovery objectives and isolated procedure first. | R9 identity tuple | Isolated drill with recovery evidence | Conditional | W | M | INCONCLUSIVE |
| R11 — repository shared memory/contracts | ACCEPT | Issue #363 / Checkpoint 0. | None | Docs review and links | No | shared | S | CONFIRMED |
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
