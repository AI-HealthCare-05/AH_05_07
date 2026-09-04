# API specification template

Use this template before proposing a product-facing API change. The generated
OpenAPI document remains the executable source of truth; this template records
the reviewable product contract and must not introduce a route that OpenAPI does
not contain.

## Change header

| Field | Record |
|---|---|
| Issue / decision | `<issue-or-decision-link>` |
| Owner | `<role-or-team>` |
| Date and source baseline | `<YYYY-MM-DD and main SHA>` |
| Product status | `<web connected / API only / planned / scaffold>` |
| OpenAPI reference | `<path, operationId, or explicit no-route-change>` |

## Endpoint contract

| Field | Record |
|---|---|
| Method and path | `<METHOD /api/...>` |
| Authentication | `<none / Supabase JWT / other reviewed mechanism>` |
| Caller-supplied identifiers | `<accepted fields, or none>` |
| Success | `<status and minimal response contract>` |
| Validation failure | `<status, stable code, generic message>` |
| Authorization or missing record | `<status and non-disclosing behavior>` |
| Conflict or lifecycle failure | `<status and recovery behavior>` |
| Product status | `<web connected / API only / planned / scaffold>` |

## Boundary checklist

- **Authentication:** `<how the caller is authenticated; do not put a
  service-role key in a browser or client artifact>`.
- **Ownership:** `<how the API resolves ownership; do not accept a client
  user_id as authority>`.
- **Input/output minimization:** `<allowed structured fields and fields that
  must not be returned or logged>`.
- **Error privacy:** `<generic error behavior that does not disclose another
  user's row, request body, token, credential, or health value>`.
- **Observability:** `<safe health/metric/log statement; no raw personal or
  health data>`.
- **Safety wording:** `<confirm no diagnosis, treatment, prevention, or causal
  improvement claim>`.

## OpenAPI and implementation synchronization

- [ ] The path and operation are present in generated `/api/openapi.json`, or
  this change intentionally creates no route.
- [ ] Request/response models, status codes, and error codes match OpenAPI.
- [ ] Authentication, RLS/ownership, and lifecycle constraints have tests or a
  clearly marked pending evidence item.
- [ ] Browser behavior names only confirmed persistence as saved.
- [ ] The existing [`api-contract.md`](api-contract.md) is updated only after
  the executable contract is merged.
