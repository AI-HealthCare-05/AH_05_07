# API contract

The executable contract is the generated OpenAPI document at `/api/openapi.json`. This file explains the current product-facing surface and accepted gaps; it must not invent a route before that route is merged into OpenAPI.

For a new or changed endpoint, use the
[API specification template](api-specification-template.md) before updating
this current-state document. The template cannot make a planned path
contractual; generated OpenAPI remains the executable authority.

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
| PUT | `/api/v1/observations/challenges/checkins/{record_id}` | Supabase JWT | `200` | Web connected; changes only the owned status of a current active-challenge check-in |
| DELETE | `/api/v1/observations/challenges/checkins/{record_id}` | Supabase JWT | `204` | Web connected; current active-challenge check-in only, with explicit browser confirmation |
| POST | `/api/v1/observations/challenges` | Supabase JWT | `201` | Legacy API only; retained until 30-day event records expire |
| DELETE | `/api/v1/observations/challenges/{record_id}` | Supabase JWT | `204` | API only |
| GET | `/api/v1/observations/export?start_on=&end_on=` | Supabase JWT | `200` | Web connected for the recent seven days; API supports one to thirty days as a JSON attachment |

Every storage operation uses the caller's JWT and an RLS-protected Supabase request. A client-supplied `user_id` is not accepted.

The active-challenge migration keeps legacy `challenge_events` separate from the new `active_challenges` and `challenge_checkins` records. Database constraints, RLS, and triggers enforce one active row per user, a seven-day window, a same-user check-in, and an immutable action after the first check-in. The API, not the browser, sets the Korea-date challenge start. A check-in update accepts only `status`; its date, action, challenge link, and owner remain immutable. The API permits check-in change or delete only while that check-in belongs to the current active, unexpired seven-day challenge.

## Model V2 surface

| Method | Path | Auth | Success | Current behavior |
|---|---|---|---:|---|
| POST | `/api/v1/model-v2/product-score` | Supabase JWT | `200` | S11 product path; response is exactly the two fields below. |
| POST | `/api/v1/model-v2/score` | Supabase JWT | `200` | Authenticated semantic route present in generated OpenAPI; uses the same two-field response projection. |
| POST | `/api/v1/risk-signal` | Not product-connected | `503` | Legacy scaffold; not the current Model V2 product surface. |

```json
{
  "schema_version": "model-v2-r1-schema-v1",
  "product_wording": "입력 기반 위험군 선별 신호"
}
```

Model V2 `422` is a generic `model_v2_input_invalid` response and does not echo raw input. When Model V2 is disabled, unavailable, or its artifact boundary cannot be used, it returns `503 model_not_ready` without numeric output.

## Accepted P0 additions

These capabilities are accepted, but their final paths become contractual only when present in generated OpenAPI.

- Select exactly one active seven-day challenge.
- Read the active challenge and create its daily check-in.
- Prevent challenge replacement after the first check-in.
- Preserve the authenticated Model V2 two-field product projection.

## Service health

Health endpoints are unauthenticated, public operational checks. They never query, return, or log a product record, JWT, key, or configuration value.

| Method | Path | Status | Contract |
|---|---|---:|---|
| GET | `/live` | `200` | Process liveness only: `{ "status": "ok" }`. It does not assess configuration or storage availability. |
| GET | `/ready` | `200` | Required runtime configuration is present: `{ "status": "ready" }`. It does not query Supabase. |
| GET | `/ready` | `503` | `{ "detail": { "code": "service_not_ready", "message": "Required runtime configuration is unavailable." } }`; no missing field or value is disclosed. |

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
| Missing Supabase session | `401` | `supabase_session_required`; the web clears the local session and asks the user to sign in again. |
| Supabase positively rejects the presented session | `401` | `supabase_session_invalid`; the web clears the local session and asks the user to sign in again. |
| Supabase Auth cannot reliably determine session validity | `503` | `auth_unavailable` with a generic message; no upstream body, token, header, URL, key, or exception detail is returned. Timeout, transport failure, `429`, `5xx`, other non-`401` responses, and malformed successful responses use this contract. |
| Missing or cross-user record | `404` | Do not disclose whether another user's row exists. |
| Duplicate date and period | `409` | Stable `observation_conflict` code; no row is changed. |
| Model artifact not ready | `503` | No provisional signal. |
| Storage dependency unavailable | `503` | The web states that persistence was not confirmed, offers a fresh read, and never claims the write succeeded. |
| Browser request exceeds 8 seconds | Browser-normalized error | R4 known gap: the current `AbortController` covers `fetch` until a `Response` is returned, but the timer is cleared before response JSON/blob body consumption completes; a full-response/body deadline is not guaranteed. The web keeps the active draft or confirmation, offers a fresh read, and never automatically retries or claims uncertain persistence succeeded. Target full-response deadline semantics belong to R4 and are not implemented here. |
| Unexpected failure | `500` | No secret, token, request body, or health value in the response. |

## Documentation endpoints

| Path | Purpose |
|---|---|
| `/api/openapi.json` | Executable API source of truth |
| `/api/docs` | Swagger UI |
| `/api/redoc` | ReDoc |
