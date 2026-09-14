# Authentication contract

Observation ownership uses Supabase Auth email Magic Links. The observation database stores only `auth.users.id` as `user_id`; it does not duplicate the email address.

## Flow

1. The client requests a Magic Link with an approved `emailRedirectTo` URL.
2. The hosted Supabase **Confirm signup** and **Magic Link** templates point to
   `{{ .SiteURL }}/auth/confirm#token_hash={{ .TokenHash }}&type=email` instead
   of exposing the project `*.supabase.co/auth/v1/verify` URL.
3. The token hash is carried in the URL fragment so it is not part of the HTTP
   request target sent to Cloudflare. The web client accepts only the
   `/auth/confirm` + `type=email` flow, removes the token-bearing fragment from
   browser history, and exchanges the token hash with `supabase.auth.verifyOtp`.
4. Supabase Auth establishes the session after that one-time exchange.
5. The client sends the session JWT to protected observation endpoints.
6. Row-level security permits access only where `user_id = auth.uid()`.

## Configuration gate

- Set the hosted Supabase production Site URL to `https://hyeol.app` and keep
  explicit additional redirect URLs limited to approved application origins.
- Keep both production email templates below on the same first-party
  confirmation endpoint; do not use `{{ .ConfirmationURL }}` for these two
  production Auth messages:

  ```html
  <!-- Confirm signup -->
  <a href="{{ .SiteURL }}/auth/confirm#token_hash={{ .TokenHash }}&type=email">이메일 주소 확인하기</a>

  <!-- Magic Link -->
  <a href="{{ .SiteURL }}/auth/confirm#token_hash={{ .TokenHash }}&type=email">로그인 계속하기</a>
  ```

- Cloudflare's web asset configuration must continue to use SPA fallback so a
  direct request to `/auth/confirm` serves the application shell.
- Do not log, persist, screenshot, or retain token hashes, Magic Link URLs,
  request headers, or browser storage as evidence.
- Use a publishable client key only; never expose a service-role key.
- Do not decide access from editable user metadata.
- User deletion must revoke sessions and remove owned observation and challenge records.

## Manual session evidence

The remaining manual AC-01 sign-in, reload, and same-browser new-tab evidence
uses the [sanitized email-link and new-tab verification checklist](email-link-session-verification.md).
It records only minimal synthetic-account pass/fail outcomes and never retains
email addresses, magic-link URLs, JWTs, browser storage, request headers, raw
logs, screenshots, or product values.
