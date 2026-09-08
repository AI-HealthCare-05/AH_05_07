# Technical depth plan

Bounded roadmap. `CODE-PATH` means source inspection identifies the boundary; it does not confirm a defect. `INCONCLUSIVE` means evidence is insufficient.

| Item | Status | Motivation / component boundary | Dependencies | Verification gate | Production change | Owner | Estimate | Evidence |
|---|---|---|---|---|---|---|---|---|
| R1 — Auth dependency failure semantics | ACCEPT / priority | Separate invalid session from Auth outage at API/client contract. | Current 401 semantics freeze | Contract and failure tests | Yes | W | M | CODE-PATH |
| R2 — account-deletion session race | ACCEPT / priority | Prevent old deletion completion from clearing a newer same-user session. | Generation/token comparison semantics | Deterministic race test | Yes | M | M | CODE-PATH |
| R3 — required CI contract coverage | ACCEPT / priority | Enforce selected invariants in CI. | R1/R2 contract decisions | Required contract suite | No, unless a defect is fixed | W | M | CODE-PATH |
| R4 — DTO/error/deadline/cache contracts | MODIFY | Split bounded API DTO/error, client deadline, and cache changes. | Frozen full-response timeout and unknown-write semantics | Per-split contract tests | Conditional | shared | M | CODE-PATH |
| R5 — DB concurrency/direct-access semantics | MODIFY | Reproduce and test before calling any hypothesized race a defect. | Synthetic direct-access fixture | Reproduction, RLS, and concurrency evidence | Conditional | W | M | INCONCLUSIVE |
| R6 — Model V2 runtime lifecycle | ACCEPT | Runtime/execution lifecycle only; frozen model is unchanged. | MODEL-01 through MODEL-06 | Artifact/lifecycle contract tests | Conditional | W | M | CODE-PATH |
| R7 — legacy/build/CSP | MODIFY | Split legacy surface, build-context boundary, and browser trust controls; do not remove routes without consumer inventory. | Consumer inventory | Per-boundary build/browser gate | Conditional | shared | M | CODE-PATH |
| R8 — privacy-preserving structured telemetry | ACCEPT | Add only minimized structured observability. | Forbidden-field contract | Telemetry schema and redaction gate | Conditional | W | M | INCONCLUSIVE |
| R9 — immutable release manifest | ACCEPT | Bind source, build, runtime, model, verification, rollback evidence. | Release tuple ownership | Manifest validation | No until used for release | W | M | CODE-PATH |
| R10 — full-stack/restore/rollback drills | MODIFY | Define recovery objectives and isolated procedure first. | R9 identity tuple | Isolated drill with recovery evidence | Conditional | W | M | INCONCLUSIVE |
| R11 — repository shared memory/contracts | ACCEPT | Issue #363 / Checkpoint 0. | None | Docs review and links | No | shared | S | CONFIRMED |
| R12 — scale/topology changes | DEFER | Existing topology is intentionally managed. | Measured evidence and ADR | Measured trigger review | No | shared | L | INCONCLUSIVE |

Refused without a measured trigger and ADR: custom auth; Kubernetes/service mesh; arbitrary microservices; Redis, queue, or worker; a separate inference service without an SLO trigger; Model V2 persistence; Model V2 retraining or recalibration; and BP/challenge/prior-result joins.
