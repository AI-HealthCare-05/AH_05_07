# API contract

All endpoints are under `/v1`; implementation OpenAPI becomes the executable source.

| Method | Path | Auth | Success |
|---|---|---|---|
| POST | `/assessments` | JWT | `201` |
| GET | `/assessments/latest` | JWT | `200` |
| POST | `/measurements` | JWT | `201` |
| GET | `/dashboard` | JWT | `200` |
| POST | `/challenges` | JWT | `201` |
| POST | `/challenges/{id}/checkins` | JWT | `201` |
| POST | `/feedback` | JWT | `202` |
| GET | `/model-card` | JWT | `200` |
| GET | `/health/live` | none | `200` |
| GET | `/health/ready` | none | `200` |

Errors use `{ "code": "...", "message": "...", "field_errors": [] }`. Validation is `422`; unauthenticated is `401`; cross-user access is `404`; rate-limited is `429`; unexpected failure is `500` without request-body echoing.
