# SK7 Asset Gateway

Public contract: `GET|HEAD https://assets.hyeol.app/v1/<mount>/<key>`

Current mounts:

- `sk7` → `sk7-assets-prod`
- `shared` → `gom-public-assets`
- `models` → `edu-webllm-models`

The two Gomdory buckets above were selected after a read-only Cloudflare audit
confirmed that both already have active public custom domains. The gateway adds
a stable `assets.hyeol.app` namespace without removing or replacing the existing
`assets.gomdory.com` and `models.gomdory.com` domains.

Explicitly excluded from whole-bucket mounts: `gom`, `gom-edu-projects`,
`gom-edu-projects-preview`, `sk7-design-corpus-private`, and
`sk7-showcase-source`. Those remain unmounted unless a later review identifies a
specific safe prefix.
