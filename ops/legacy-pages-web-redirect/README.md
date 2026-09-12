# Legacy Worker redirect

This Worker is the retained legacy compatibility redirect
`ah-05-07-pages-web`. It redirects every request to the primary
`https://hyeol.app` destination while preserving the path and query string. The
`ah-05-07-pages.ahnsangkyoon.workers.dev` Worker remains the fallback app.

The retained legacy Worker must remain disconnected from Git-based application
builds. Do not connect it to `emotigom/ah-05-07-pages` or any other app
repository, and do not attach the production custom domain to it. The only
mirror-connected application Worker is `ah-05-07-pages`; this legacy name is a
redirect-only compatibility endpoint.

Deploy the redirect source to the retained legacy Worker; this deployment is not
part of the frontend build:

```bash
npx wrangler deploy --config ops/legacy-pages-web-redirect/wrangler.jsonc
```

Expected result:

```text
https://ah-05-07-pages-web.ahnsangkyoon.workers.dev/*
  -> https://hyeol.app/*
```

Use the `308` response only while `https://hyeol.app` is the intended canonical URL. Rollback is performed by redeploying the legacy static Worker, not by changing `web/wrangler.jsonc`.
