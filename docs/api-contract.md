# API contract

The executable contract is the generated OpenAPI document at `/api/openapi.json`. This file explains the current product-facing surface and accepted gaps; it must not invent a route before that route is merged into OpenAPI.

## Authentication boundary

The production web uses Supabase Auth email magic links directly. It sends the Supabase access token as `Authorization: Bearer <token>` to protected product APIs. The browser uses only the public Supabase URL and publishable key; it never receives a service-role key.

The inherited `/api/v1/auth/*` and `/api/v1/users/*` routers are not used by the current SK7 web flow. They remain outside the product contract until a separate removal or migration decision is recorded.

## Implemented observation surface

| Method | Path | Auth | Success | Product status |
|---|---|---|---|---|
| POST | `/api/v1/observations/blood-pressure` | Supabase JWT | `201` | Web connected |
| PUT | `/api/v1/observations/blood-pressure/{record_id}` | Supabase JWT | `200` | Web connected; replaces one owned record after full input validation |
| GET | `/api/v1/observations/window?start_on=&end_on=` | Supabase JWT | `200` | Web connected; one to seven days |
| DELETE | `/api/v1/observations/blood-pressure/{record_id}` | Supabase JWT | `204` | Web connected; requires an explicit browser confirmation |
| POST | `/api/v1/observations/challenges/active` | Supabase JWT | `200` | Web connected; selects one active seven-day challenge, or changes it before the first check-in |
| POST | `/api/v1/observations/challenges/active/checkins` | Supabase JWT | `201` | Web connected; upserts an in-window `completed` or `skipped` check-in for the active challenge |
| POST | `/api/v1/observations/challenges` | Supabase JWT | `201` | Legacy API only; retained until 30-day event records expire |
| DELETE | `/api/v1/observations/challenges/{record_id}` | Supabase JWT | `204` | API only |
| GET | `/api/v1/observations/export?start_on=&end_on=` | Supabase JWT | `200` | API only; one to thirty days, JSON attachment |

Every storage operation uses the caller's JWT and an RLS-protected Supabase request. A client-supplied `user_id` is not accepted.

The active-challenge migration keeps legacy `challenge_events` separate from the new `active_challenges` and `challenge_checkins` records. Database constraints, RLS, and triggers enforce one active row per user, a seven-day window, a same-user check-in, and an immutable action after the first check-in. The API, not the browser, sets the Korea-date challenge start.

## Risk-signal scaffold

| Method | Path | Auth | Current behavior | Release gate |
|---|---|---|---|---|
| POST | `/api/v1/risk-signal` | Not yet product-connected | `503 model_not_ready` without a verified artifact | Artifact, metadata, split digest, repeatability test, model version, and disclaimer must all pass. |

No fallback rule, random score, or provisional probability may be returned. Authentication and final success status must be reviewed when the product flow is connected.

## Accepted P0 additions

These capabilities are accepted, but their final paths become contractual only when present in generated OpenAPI.

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

Request validation errors use a normalized response that never returns the submitted body, field values, or internal validation details:

```json
{
  "detail": {
    "code": "validation_error",
    "message": "Input values are invalid."
  }
}
```

| Condition | Status | Contract |
|---|---:|---|
| Invalid body or date window | `422` | Stable `validation_error` code and generic message; no submitted input values are returned. |
| Missing or invalid Supabase session | `401` | Stable machine-readable code; the web clears the local session and asks the user to sign in again. |
| Missing or cross-user record | `404` | Do not disclose whether another user's row exists. |
| Duplicate date and period | `409` | Stable `observation_conflict` code; no row is changed. |
| Model artifact not ready | `503` | No provisional signal. |
| Storage dependency unavailable | `503` | The web states that persistence was not confirmed, offers a fresh read, and never claims the write succeeded. |
| Unexpected failure | `500` | No secret, token, request body, or health value in the response. |

## Documentation endpoints

| Path | Purpose |
|---|---|
| `/api/openapi.json` | Executable API source of truth |
| `/api/docs` | Swagger UI |
| `/api/redoc` | ReDoc |
