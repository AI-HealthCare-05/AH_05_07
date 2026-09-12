# Legacy Worker redirect

This Worker retires the legacy `ah-05-07-pages-web` and `ah-05-07-web-pages` endpoints by redirecting every request to the primary `https://hyeol.app` destination while preserving the path and query string. The `ah-05-07-pages.ahnsangkyoon.workers.dev` Worker remains the fallback app.

Both legacy Workers must remain disconnected from Git-based application builds.
Do not connect either Worker to `emotigom/ah-05-07-pages` or any other app
repository, and do not attach the production custom domain to them. The only
mirror-connected application Worker is `ah-05-07-pages`; these legacy names are
redirect-only compatibility endpoints.

Deploy the same redirect source explicitly to both legacy Worker names; these deployments are not part of the frontend build:

```bash
npx wrangler deploy --config ops/legacy-pages-web-redirect/wrangler.jsonc

npx wrangler deploy \
  --config ops/legacy-pages-web-redirect/wrangler.jsonc \
  --name ah-05-07-web-pages
```

Expected result:

```text
https://ah-05-07-pages-web.ahnsangkyoon.workers.dev/*
  -> https://hyeol.app/*

https://ah-05-07-web-pages.ahnsangkyoon.workers.dev/*
  -> https://hyeol.app/*
```

Use the `308` response only while `https://hyeol.app` is the intended canonical URL. Rollback is performed by redeploying the legacy static Worker, not by changing `web/wrangler.jsonc`.
