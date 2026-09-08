# ADR policy

Create an ADR before introducing or materially changing a queue, worker, Redis, microservice split, separate inference service, authentication provider/architecture, persistence of sensitive or model-derived data, major infrastructure component, material cross-boundary data flow, or recovery strategy with new data-copy semantics.

An ADR is not needed for a straightforward bug fix inside an accepted contract, tests enforcing an existing invariant, docs reconciliation, or a small refactor without architectural behavior change. Do not create speculative ADRs.

## Future ADR template

- **Status**
- **Context**
- **Measured trigger/evidence**
- **Decision**
- **Alternatives**
- **Security/privacy impact**
- **Failure/rollback**
- **Verification**
- **Consequences**
