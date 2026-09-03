# Deployment smoke verification

## Purpose

`scripts/ci/verify_deployment_smoke.py` verifies the public deployment boundary without authenticating, writing a record, exporting data, or sending a health value.

It checks:

- the deployed web URL returns HTTP 200;
- API `/live` returns exactly `{ "status": "ok" }`;
- API `/ready` returns exactly `{ "status": "ready" }`;
- browser CORS preflight permits the web origin, `GET`, `POST`, `PUT`, and `DELETE`, plus the `Authorization` and `Content-Type` headers needed by the current client.

The command reports only endpoint and contract outcomes. Base URLs containing credentials, query strings, or fragments are rejected before any request is sent.

## Local control test

```bash
python3 scripts/ci/verify_deployment_smoke.py --self-test
```

The self-test starts a temporary local HTTP server and proves both a compliant deployment and failing web, readiness, and CORS cases. GitHub Actions runs this control on every pull request and `main` push.

## Production command

```bash
python3 scripts/ci/verify_deployment_smoke.py \
  --web-base-url "https://ah-05-07-pages.ahnsangkyoon.workers.dev" \
  --api-base-url "https://bp7-api-292436735548.asia-northeast3.run.app"
```

Run it only after both services have reached their expected revisions. A passing result is a public-boundary smoke check; it does not replace a signed-in synthetic-user flow, Supabase migration gate, or rollback rehearsal.
