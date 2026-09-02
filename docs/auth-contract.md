# Authentication contract

Observation ownership uses Supabase Auth email Magic Links. The observation database stores only `auth.users.id` as `user_id`; it does not duplicate the email address.

## Flow

1. The client requests a Magic Link with an approved `emailRedirectTo` URL.
2. Supabase Auth establishes the session after the one-time link is opened.
3. The client sends the session JWT to protected observation endpoints.
4. Row-level security permits access only where `user_id = auth.uid()`.

## Configuration gate

- Configure the production Site URL and explicit additional redirect URLs before enabling email login.
- Use a publishable client key only; never expose a service-role key.
- Do not decide access from editable user metadata.
- User deletion must revoke sessions and remove owned observation and challenge records.
