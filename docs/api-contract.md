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

## Structured feedback surface

Issue #548 defines the first FR-06 slice. It is separate review data, not an observation, challenge fact, Model V2 result, or online-training label.

| Method | Path | Auth | Success | Product status |
|---|---|---|---:|---|
| POST | `/api/v1/feedback` | Supabase JWT | `201` | Source-connected to S10; production use requires the matching migration/API/web release |

The request is exactly:

```json
{
  "surface": "seven_day_recap",
  "response": "clear"
}
```

`response` is limited to `clear`, `unclear`, or `hard_to_understand`; extra fields and free text are rejected. The caller never supplies `user_id`, `submitted_on`, `created_at`, or `expires_at`. The API derives ownership from the authenticated session and PostgreSQL supplies the Korea submission date and 30-day lifecycle fields.

The success receipt is exactly:

```json
{
  "status": "saved",
  "submitted_on": "2026-09-16"
}
```

The database permits at most one row per user, surface, and Korea submission date. A same-day duplicate returns `409 feedback_already_submitted` without creating another row. Storage failure returns `503 feedback_storage_not_ready`; the browser does not present network/timeout/unknown persistence as saved. The table stores no BP value or aggregate, challenge state, record identifier, email/contact field, free-text history, or Model V2 input/output.

## Model V2 surface

| Method | Path | Auth | Success | Current behavior |
|---|---|---|---:|---|
| POST | `/api/v1/model-v2/product-score` | Supabase JWT | `200` | Authenticated server contract; response is exactly the two fields below. Normal signed-in S11 computes browser-locally and does not send a feature-bearing inference POST. |
| POST | `/api/v1/model-v2/score` | Supabase JWT | `200` | Authenticated semantic route present in generated OpenAPI; uses the same two-field response projection. |
| POST | `/api/v1/risk-signal` | Not product-connected | `503` | Legacy scaffold; not the current Model V2 product surface. |

```json
{
  "schema_version": "model-v2-r1-schema-v1",
  "product_wording": "입력 기반 위험군 선별 신호"
}
```

Model V2 adapter/semantic validation failures return `422 model_v2_input_invalid`.
Malformed JSON or a non-object request body uses the application's normalized
`422 validation_error` response. Neither echoes raw input. When Model V2 is
disabled, unavailable, or its artifact boundary cannot be used, it returns
`503 model_not_ready` without numeric output.

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

Application errors have a stable `detail.code`. `detail.message` is optional;
missing and invalid session responses currently contain only the code. Clients
must not require a message or echo raw provider errors. For example:

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
| Request body, field, path, or query parsing/validation failure | `422` | Stable `validation_error` code and generic message; no submitted input values are returned. |
| Parsed observation dates are reversed or span more than seven days | `422` | `observation_window_invalid`; the inclusive range permits one to seven dates. |
| Parsed export dates are reversed or span more than thirty days | `422` | `observation_export_window_invalid`; the inclusive range permits one to thirty dates. |
| Missing Supabase session | `401` | `supabase_session_required`; the web clears the local session and asks the user to sign in again. |
| Supabase positively rejects the presented session (the current user-verification endpoint returns provider `401` or `403`) | `401` | `supabase_session_invalid`; the web clears the local session and asks the user to sign in again. |
| Supabase Auth cannot reliably determine session validity | `503` | `auth_unavailable` with a generic message; no upstream body, token, header, URL, key, or exception detail is returned. Timeout, transport failure, `429`, `5xx`, other unclassified responses, and malformed successful responses use this contract. |
| Missing or cross-user record | `404` | Do not disclose whether another user's row exists. |
| Duplicate date and period | `409` | Stable `observation_conflict` code; no row is changed. |
| Active challenge disappears during selection update or closure of an ended challenge | `409` | Existing `active_challenge_required`; stop the selection attempt without inserting a replacement or automatically retrying. Re-read state before another explicit choice. |
| Same-day S10 feedback duplicate | `409` | Stable `feedback_already_submitted`; no second feedback row is created. |
| Model artifact not ready | `503` | No provisional signal. |
| Storage dependency unavailable | `503` | The web states that persistence was not confirmed, offers a fresh read, and never claims the write succeeded. |
| Feedback storage unavailable | `503` | Stable `feedback_storage_not_ready`; S10 keeps the feedback write unconfirmed and never claims it was saved. |
| Browser request exceeds 8 seconds | Browser-normalized error | One 8-second total deadline covers the full response lifecycle, including response headers and JSON/blob body consumption. Timeout is normalized to status `0`, code `request_timeout`, and message `요청 응답 시간을 초과했습니다.` The web keeps the active draft or confirmation where applicable, may offer a fresh read, and never automatically retries uncertain persistence or claims it succeeded. |
| Unexpected failure | `500` | No secret, token, request body, or health value in the response. |

### Initial browser observation-window recovery

On session entry, only the initial `GET /api/v1/observations/window` before any
window data has loaded may automatically retry a fetch network rejection (browser status `0`,
code `network_error`), `request_timeout`, or HTTP `502`/`503`/`504` once. Fetch
rejection is classified separately from JSON/body decoding failures. This shares
one retry allowance with the existing stale-token `401` retry when a newer token
exists for the same session generation: at most two GET attempts total.

One top-level observation-window load owns one 8-second logical full-response
budget. The first attempt and its one eligible retry share that deadline, and
each fetch receives only the remaining time. A retry does not begin when the
first attempt has consumed the budget. A later manual recovery, explicit
refresh, or different window load starts a new logical budget without gaining
new automatic-retry eligibility.

On the server, `GET /api/v1/observations/window` uses one 7-second logical read
budget shared by Auth verification and the concurrent Data API fan-out. No
individual upstream hop receives more than 5 seconds. Auth rejection remains
distinct from Auth unavailability, and Data deadline expiry retains the
`observation_storage_not_ready` contract.

Session generation and window request invalidation must pass before retrying or
committing either attempt, and the retry uses the latest session token. A second
failure reaches the existing S13 recovery UI (or existing session-expiry
handling for a current invalid session). Ordinary `4xx`, other HTTP errors and
malformed successful responses receive no transient retry. A timeout preserves
an already received HTTP status as `responseStatus` so a stalled error body
cannot make an ordinary HTTP failure retryable. Mutations, account deletion,
export and Model V2 retain their existing timeout and single-attempt behavior.
Source/test coverage does not establish the production failure class.

## Contract regression coverage

[Product API contract tests](../tests/api/test_product_api_contract.py) check the
18 documented product operations, declared methods/statuses, UUID path and date
query parameters, typed input fields, Model V2's two-field response, and feedback
receipt. Runtime cases separately check missing-session rejection, provider
rejection versus unavailability, normalized invalid-UUID errors, date-window
bounds, legacy model unavailability, and the emitted check-in upsert request.
These are not the total set of inherited application routes.

OpenAPI does not express every behavior above: observation success objects and
Model V2 request objects remain generic in the generated schema. The store and
frozen input validators are still needed to interpret their fields and behavior.
A schema assertion or mocked upsert response does not prove live database RLS,
uniqueness, or deployed-runtime behavior. Do not add response filtering merely
to make those generic schemas look more complete.

[Selection race tests](../tests/api/test_active_challenge_selection_race.py)
exercise both disappearing-row branches through the actual router and store with
a synthetic provider. They preserve storage-error classification and the
no-automatic-write-retry boundary.

## Documentation endpoints

| Path | Purpose |
|---|---|
| `/api/openapi.json` | Executable API source of truth |
| `/api/docs` | Swagger UI |
| `/api/redoc` | ReDoc |
