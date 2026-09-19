# Architecture Research Run 03 — deadline composition / resilience

## Baseline

Start from actual `origin/main` at execution time.

Run 02 is complete:

- A1: confirmed boundary defect, fixed by #626 / #628
- A2: truthful partial state
- A3: confirmed boundary defect, fixed by #630 / #632
- A4: preserved by existing contract

Run 03 studies deadline composition only. It does not authorize production
timeout changes, a circuit breaker, a queue, a worker, Redis, or topology
expansion.

## Current contract to measure

The browser wraps each API attempt in an 8-second full-response deadline.

The observation read may automatically retry once on the initial load for:

- transport/network rejection;
- request timeout;
- HTTP 502 / 503 / 504.

The API currently verifies the Supabase access token through an HTTP client with
a 5-second timeout. Only after Auth succeeds does `/observations/window` start
the Data API reads, whose shared HTTP client also uses a 5-second timeout.

Therefore two individually legal upstream phases can compose to more than the
browser's 8-second attempt deadline.

This is a hypothesis to measure, not yet a defect classification.

## Arm A — current behavior

Use actual FastAPI source unchanged.

Point `SUPABASE_URL` at a local synthetic dependency server that implements only:

- `GET /auth/v1/user`
- `GET /rest/v1/blood_pressure_observations`
- `GET /rest/v1/challenge_events`
- `POST /rest/v1/rpc/get_owned_challenge_window`

The server returns only synthetic empty facts and records aggregate call counts.
It never persists bearer tokens, request bodies, user identifiers, or health
values.

A browser-contract client simulator applies the same 8-second total attempt
deadline and one eligible initial-read retry. It calls the real FastAPI
`GET /api/v1/observations/window` loopback endpoint.

### Exploratory matrix

| Scenario | Auth delay | Data delay | Special |
| --- | ---: | ---: | --- |
| control | 0 s | 0 s | none |
| auth-3s | 3 s | 0 s | none |
| data-3s | 0 s | 3 s | all Data API reads |
| auth3-data3 | 3 s | 3 s | composition below 8 s |
| auth4-data4 | 4 s | 4 s | browser-boundary neighborhood |
| auth4.5-data4.5 | 4.5 s | 4.5 s | each hop < 5 s, composition > 8 s |
| one-fanin-4.5s | 0 s | 0 s | only challenge-window RPC delayed 4.5 s |
| one-fanin-5.2s | 0 s | 0 s | only challenge-window RPC delayed 5.2 s |

Default exploratory sample count is 5 logical initial loads per scenario.
P50/P95/P99 are reported with the sample count; these are exploratory
quantiles, not production SLO estimates.

## Arm A metrics

For every scenario record:

- logical completion status;
- total logical latency;
- per-attempt latency;
- retry count;
- Auth upstream calls;
- Data API upstream calls;
- calls by Data API path;
- peak simultaneous dependency calls;
- transport/time-out count.

No request/response bodies, tokens, email addresses, or synthetic user IDs are
written to evidence.

## Arm A decision gate

`COORDINATED_BUDGET_EXPERIMENT_WARRANTED` if all are true:

1. control succeeds;
2. a composed-delay case with each upstream hop below the existing five-second
   per-hop timeout crosses the browser eight-second attempt boundary or triggers
   retry amplification;
3. the result is repeatable in the local synthetic setup.

Otherwise:

- `CURRENT_BOUNDS_SUFFICIENT` if the tested current contract stays inside the
  browser boundary without meaningful retry amplification;
- `INSUFFICIENT_MEASUREMENT` if the local harness cannot establish either.

This decision authorizes only Arm B research. It does not authorize a product
timeout change.

## Arm B — not implemented yet

Only if Arm A warrants it, compare a coordinated read budget whose dependency
sub-budgets fit inside one end-to-end server read budget.

Constraints:

- write paths remain single-attempt;
- no automatic write retry;
- no change to uncertain-write semantics;
- preserve Auth 401 vs 503 distinction;
- preserve current response shape;
- preserve RLS/JWT ownership;
- no breaker in Arm B.

## Arm C — optional breaker

Do not run by default.

Consider only if A/B demonstrate both:

- sustained dependency failure; and
- enough request volume / retry amplification for breaker state to materially
  reduce upstream calls without harming recovery.

A faster failure is not a success by itself.

## Stop conditions

Stop and open a protected Issue before product work if the research finds a
concrete current invariant violation, stale-session acceptance, duplicate write,
or cross-user disclosure.

Otherwise complete Arm A first and decide whether Arm B is warranted.
