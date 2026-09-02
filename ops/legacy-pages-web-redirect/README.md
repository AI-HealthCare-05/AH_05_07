# Legacy Worker redirect

This Worker retires the legacy `ah-05-07-pages-web` endpoint by redirecting every request to the production Worker while preserving the path and query string.

Deploy it explicitly; it is not part of the frontend build:

```bash
npx wrangler deploy --config ops/legacy-pages-web-redirect/wrangler.jsonc
```

Expected result:

```text
https://ah-05-07-pages-web.ahnsangkyoon.workers.dev/*
  -> https://ah-05-07-pages.ahnsangkyoon.workers.dev/*
```

Use the `308` response only after the production endpoint is the intended canonical URL. Rollback is performed by redeploying the legacy static Worker, not by changing `web/wrangler.jsonc`.
