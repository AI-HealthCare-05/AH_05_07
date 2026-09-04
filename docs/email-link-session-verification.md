# Sanitized email-link and new-tab verification

## Purpose and scope

This is the reproducible operator checklist for the remaining manual portion of
AC-01: a synthetic account completes email-link sign-in, reloads the public
web app, and opens the normal public site in a second tab before the session
expires. It verifies browser session continuity only. It neither authorizes a
production record write nor replaces the automated signed-in browser coverage.

The checklist is intentionally manual. Do not automate inbox access, capture a
magic-link URL, or export a browser session in order to create evidence.

## Preconditions

- Use one approved **synthetic test account** only. Do not record its address,
  name, identifier, or any account-management screen.
- Use the normal public web origin in a browser profile that the operator can
  discard after the check. Do not use developer tools, browser storage views,
  network inspectors, or copied links as evidence.
- Start from the signed-out page. Do not create, edit, delete, export, or
  inspect product records during this check.
- Prepare one issue or pull-request comment using the minimal evidence template
  below. Notion receives the same sanitized result only after the repository
  evidence is merged.

## Operator checklist

1. On the public signed-out page, request the email-link sign-in for the
   synthetic test account. Do not copy, forward, save, screenshot, or paste
   the received email or link.
2. Open the received link once in the same browser profile. Confirm that the
   public app reaches its signed-in page. Record only pass or fail; do not
   retain the displayed account, records, health values, page URL, or browser
   data.
3. Reload that signed-in page. Confirm that the signed-in page remains
   available and that no login recovery prompt is shown. Record the result.
4. Open the normal public web origin in a **new tab in the same browser
   profile**. Do not open or duplicate the email link. Confirm that this tab
   also reaches the signed-in page. Record the result.
5. Close the tabs and sign out through the product control if available. Do
   not retain browser storage, headers, console output, or screenshots.

## Expired or invalid-session recovery

Do not alter a JWT, browser storage, link, or request to force this state. If
an expired or invalid session occurs naturally during the checklist, protected
content must clear and the recovery wording must be:

> 로그인 시간이 만료되었습니다. 이메일 링크로 다시 로그인해 주세요.

Record `observed` only when that state occurred naturally; otherwise record
`not run`. A failed sign-in, an expired email link, or wording different from
the text above is a stop condition, not a reason to retry with a retained link.

## Stop conditions

Stop immediately and mark the affected step `fail` or `not run` when any of
the following happens:

- The email link is unavailable, expired, opens an unexpected origin, or is
  requested more than once because of uncertainty.
- The signed-in page does not load after the link, reload, or new-tab step.
- Any account detail, magic-link URL, JWT, browser storage, request header,
  raw log, health value, or product record would need to be captured to
  diagnose the result.
- The operator would need to create, change, delete, export, or inspect a
  product record to continue.

Open a separate bounded Issue for diagnosis after recording the sanitized
failure class. Do not attach the sensitive material that prompted the stop.

## Retained evidence

Keep only this template in the related Issue, pull request, handoff, and
Notion mirror after merge:

| Field | Allowed value |
| --- | --- |
| Date | Calendar date only |
| Environment class | `public web`, browser family, and `synthetic account` |
| Email-link sign-in | `pass`, `fail`, or `not run` |
| Reloaded session | `pass`, `fail`, or `not run` |
| Same-browser new-tab session | `pass`, `fail`, or `not run` |
| Expired/invalid-session recovery | `observed`, `not run`, or `fail` |
| Sanitized result | A short outcome without any identifier or product value |

Never retain an email address, magic-link URL, JWT, browser storage, request
header, raw log, screenshot, account identifier, health value, or product
record. A completed checklist is evidence for AC-01 only when the related
Issue or pull request contains this minimal result and the repository and
Notion mirrors agree.

## Recorded outcome

Issue #182 records this approved synthetic-account checklist outcome. It is a
sanitized operator result, not a retained browser capture.

| Field | Result |
| --- | --- |
| Date | 2026-09-04 |
| Environment class | Chrome; approved synthetic-account checklist |
| Email-link sign-in | `pass` |
| Reloaded session | `pass` |
| Same-browser new-tab session | `pass` |
| Expired/invalid-session recovery | `not run` |
| Sanitized result | No additional result |

The invalid-session state was not forced. This outcome closes the remaining
manual email-link, reload, and same-browser new-tab portion of AC-01 without
claiming that natural session expiry was observed.
