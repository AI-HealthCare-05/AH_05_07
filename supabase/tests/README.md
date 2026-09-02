# Database ownership tests

The pgTAP files in this directory use only fixed synthetic user IDs and synthetic values. They run inside transactions and roll back their fixtures.

## Local database

Start the local Supabase stack, then run the ownership suite:

```bash
npx supabase start
npx supabase test db --local supabase/tests/observation_ownership_rls_test.sql
```

## Linked project evidence

Run this only against the intended non-production project, or during a scheduled production verification window. Confirm the repository migration history is current before executing it.

```bash
npx supabase link --project-ref <project-ref>
npx supabase migration list
npx supabase test db --linked supabase/tests/observation_ownership_rls_test.sql
```

Record the command, commit, timestamp, project environment, and pass/fail result in the associated Issue or pull request. Do not attach tokens, real email addresses, or health values.

The test proves database ownership boundaries for the data used by the API export. It does not replace an authenticated browser/API smoke test.
