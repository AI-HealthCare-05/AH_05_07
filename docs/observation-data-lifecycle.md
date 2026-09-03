# Observation data lifecycle

## Decisions

- Identity: `auth.users.id` is the only application-side record owner identifier.
- Retention: observations and challenge events expire after 30 days; the scheduled purge removes expired rows daily.
- Deletion: users delete an owned observation or challenge event by record ID; deleting an Auth user cascades to owned rows.
- Export: users export their own 1–30 day observation window as JSON through `GET /api/v1/observations/export`; the current web action requests the recent seven-day window.
- Access: RLS limits reads, writes, and deletes to `auth.uid() = user_id`; no administrative read path exists.

## Non-negotiable boundaries

- Do not store free-text health history, diagnosis, medication, treatment, original document, or contact details with these records.
- Do not use records for model retraining or feature inputs without a separate reviewed decision.
