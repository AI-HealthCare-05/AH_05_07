# ADR-0001: modular monolith before queue workers

## Status

Accepted.

## Decision

Use a layered FastAPI service with a versioned CPU model artifact. Keep training outside the request path. Add a durable asynchronous job path only when a benchmark demonstrates that a batch task breaches the request contract.

## Consequences

- Inference remains reproducible and measurable.
- The queue boundary is explicit rather than implied.
- A future job system persists request state and result in PostgreSQL and documents retry and idempotency behavior.
