# API contract

The executable contract is the generated OpenAPI document at `/api/openapi.json`. This file explains the current product-facing surface and accepted gaps; it must not invent a route before that route is merged into OpenAPI.

## Authentication boundary

The production web uses Supabase Auth email magic links directly. It sends the Supabase access token as `Authorization: Bearer <token>` to protected product APIs. The browser uses only the public Supabase URL and publishable key; it never receives a service-role key.

The inherited `/api/v1/auth/*` and `/api/v1/users/*` routers are not used by the current SK7 web flow. They remain outside the product contract until a separate removal or migration decision is recorded.

## Implemented observation surface

| Method | Path | Auth | Success | Product status |
|---|---|---|---|---|
| POST | `/api/v1/observations/blood-pressure` | Supabase JWT | `201` | Web connected |
| GET | `/api/v1/observations/window?start_on=&end_on=` | Supabase JWT | `200` | Web connected; one to seven days |
| DELETE | `/api/v1/observations/blood-pressure/{record_id}` | Supabase JWT | `204` | API only |
| POST | `/api/v1/observations/challenges` | Supabase JWT | `201` | Web connected to the partial daily-event model |
| DELETE | `/api/v1/observations/challenges/{record_id}` | Supabase JWT | `204` | API only |
| GET | `/api/v1/observations/export?start_on=&end_on=` | Supabase JWT | `200` | API only; one to thirty days, JSON attachment |

Every storage operation uses the caller's JWT and an RLS-protected Supabase request. A client-supplied `user_id` is not accepted.

## Risk-signal scaffold

| Method | Path | Auth | Current behavior | Release gate |
|---|---|---|---|---|
| POST | `/api/v1/risk-signal` | Not yet product-connected | `503 model_not_ready` without a verified artifact | Artifact, metadata, split digest, repeatability test, model version, and disclaimer must all pass. |

No fallback rule, random score, or provisional probability may be returned. Authentication and final success status must be reviewed when the product flow is connected.

## Accepted P0 additions

These capabilities are accepted, but their final paths become contractual only when present in generated OpenAPI.

- Update an owned BP observation.
- Select exactly one active seven-day challenge.
- Read the active challenge and create its daily check-in.
- Prevent challenge replacement after the first check-in.
- Return versioned risk-signal results to an authenticated product user.
- Expose liveness and readiness endpoints.

## Error contract

Current application errors use:

```json
{
  "detail": {
    "code": "observation_not_found",
    "message": "Observation record was not found."
  }
}
```

FastAPI validation errors currently use its standard `detail` array. Before Gate B, the web client and API specification must agree on one normalized representation for validation and application errors.

| Condition | Status | Contract |
|---|---:|---|
| Invalid body or date window | `422` | No request-body echo in operational logs. |
| Missing or invalid Supabase session | `401` | Stable machine-readable code. |
| Missing or cross-user record | `404` | Do not disclose whether another user's row exists. |
| Model artifact not ready | `503` | No provisional signal. |
| Storage dependency unavailable | `503` | Retry-safe message; never claim the write succeeded. |
| Unexpected failure | `500` | No secret, token, request body, or health value in the response. |

## Documentation endpoints

| Path | Purpose |
|---|---|
| `/api/openapi.json` | Executable API source of truth |
| `/api/docs` | Swagger UI |
| `/api/redoc` | ReDoc |
