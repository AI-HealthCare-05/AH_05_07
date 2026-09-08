# Observation data lifecycle

## Decisions

- Identity: `auth.users.id` is the only application-side record owner identifier.
- Retention: all four product-record tables become inaccessible through RLS at their server-enforced 30-day `expires_at`; scheduled purge jobs remove expired rows daily as physical cleanup.
- Deletion: users delete an owned, unexpired blood-pressure observation or current challenge check-in by record ID after confirmation; expired rows cannot be read, changed, deleted, or exported before physical cleanup. The self-service `DELETE /api/v1/account` route hard-deletes only the validated Supabase session user through the server-only Auth Admin path; deleting that Auth user cascades to owned rows.
- Export: users export their own 1–30 day observation window as JSON through `GET /api/v1/observations/export`; the current web action requests the recent seven-day window.
- Access: RLS limits reads, writes, and deletes to `(select auth.uid()) = user_id and expires_at > now()`; no administrative read path exists. Database triggers assign the 30-day deadline on insert and reject later expiry extension.

## Unresolved Auth boundary

- The 30-day retention contract applies only to observation/challenge product-record tables.
- Auth user and email lifecycle is separate from product-record retention.
- The web UI provides a two-step self-service Auth account-deletion control; the downloaded JSON export remains outside server deletion.
- A downloaded JSON export is a local file outside server retention; the user is responsible for storing or deleting it safely.
- Production use still requires the separately approved `SUPABASE_SECRET_KEY` binding and API/web deployment gates.

## Non-negotiable boundaries

- Do not store free-text health history, diagnosis, medication, treatment, original document, or contact details with these records.
- Do not use records for model retraining or feature inputs without a separate reviewed decision.
