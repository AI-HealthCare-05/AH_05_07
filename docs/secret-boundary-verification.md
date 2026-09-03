# Secret-boundary verification

## Purpose

`scripts/ci/verify_secret_boundary.py` provides a dependency-free guard against accidental exposure of server-only credentials and user-record data in application source or built browser assets.

It scans `app`, `web/src`, `ops`, and GitHub workflow files, plus the built `web/dist` directory. A violation reports only its path and rule name; it never echoes the matching content.

## Prohibited markers

- Supabase secret keys and service-role markers;
- JWT-like literals;
- private-key blocks;
- Python logging statements that contain `request.body`, `request.json`, `systolic`, or `diastolic`.

The scanner deliberately allows the browser's Supabase publishable-key configuration and API base URL. It does not inspect `.env` files, test fixtures, Git history, deployed configuration, or external logs.

## Run locally

```bash
python3 scripts/ci/verify_secret_boundary.py --self-test

cd web
npm ci
npm run build
cd ..

python3 scripts/ci/verify_secret_boundary.py --web-dist web/dist
```

The self-test creates temporary synthetic files to prove that each prohibited marker fails and that a publishable-key marker passes. It adds no fixture or secret to the repository.

## Operations boundary

This static check is evidence, not a production-log guarantee. After a synthetic production request, review representative Cloud Run logs manually without copying user identity, JWTs, request bodies, or health values into Issues, pull requests, or screenshots.

The boundary follows Supabase guidance: publishable keys are appropriate for browser clients, while `service_role` and secret keys must not be exposed publicly. See [Secure configuration of Supabase products](https://supabase.com/docs/guides/security/product-security).
