# ADR — Shared R2 Asset Gateway and SK7 Guide v1

- **Status:** Proposed
- **Scope:** standalone infrastructure only; no existing product activation

## Context

SK7 now has a stable public Showcase and growing R2-hosted visual, Companion,
and media assets. The same Cloudflare account also contains Gomdory/GKRRy R2
resources that may be useful to SK7, but exposing entire buckets or coupling
the browser to their current custom domains would turn storage topology into a
product contract.

A previous Gomdory AI/chat effort produced a measured production failure:
direct OpenAI calls from Cloudflare were rejected by the upstream provider with
`unsupported_country_region_territory` (HTTP 403). A separate browser WebLLM
effort documented additional instability from WebGPU support, large first-load
downloads, CORS/CORP/Range headers, wasm/model path mismatch, cache state, and
device memory.

## Measured trigger / evidence

- historical Gomdory troubleshooting records direct Cloudflare → OpenAI as not
  production viable after an upstream unsupported-region 403.
- historical WebLLM audit records device, network, R2 header/path, cache, and
  memory failure modes.
- SK7 already uses R2 successfully for public Showcase and Companion assets.
- the owner explicitly approved active cross-use of suitable Gomdory R2 assets
  for `hyeol.app`.

## Decision

### Shared asset gateway

Create a separate Worker `sk7-asset-gateway`, intended for
`assets.hyeol.app`.

The Worker receives explicit R2 bindings and exposes only configured
mount/prefix pairs at `/v1/<mount>/<object-key>`. Public requests support GET,
HEAD, and CORS preflight. Public LIST, PUT, and DELETE are not implemented.

Adding a Gomdory bucket requires a read-only inventory and an explicit safe
prefix. Existing bucket custom domains remain valid; this is additive.

### SK7 Guide v1

Create a separate Worker `sk7-guide`, intended for `guide.hyeol.app`.

The guide uses a Cloudflare AI Search instance backed by dedicated private R2
bucket `sk7-guide-knowledge`. Generation goes through an AI Search Workers
binding using a Workers-AI-hosted text model. The primary v1 path does not call
OpenAI directly from Cloudflare and does not require WebGPU or a browser model
download.

The Guide is a product/education assistant, not a medical decision system.

It may explain the SK7 recording flow, seven-day journey, the separation of
blood-pressure records and challenge participation, the Model V2 **입력 기반
위험군 선별 신호** and its limits, and product/account/privacy navigation.

It must not provide diagnosis, treatment, prevention, causal-improvement
claims, or individualized interpretation of personal measurements.

The standalone v1 does not read Supabase, Cloud Run product APIs,
authenticated records, or Model V2 runtime output.

### Data minimization

- sanitized Markdown corpus only
- bounded history per request
- no raw chat persistence
- redact obvious email/phone/credential/BP-shaped patterns before generation
- request/character limits and rate limiting
- request IDs without raw prompt logging

## Alternatives

- **Expose all Gomdory buckets:** rejected; could expose unrelated/user content.
- **Use Gomdory domains directly forever:** possible compatibility path, but not
  the stable SK7 namespace.
- **Cloudflare Worker → OpenAI directly:** rejected as primary path due measured
  unsupported-region 403.
- **Browser WebLLM required:** rejected due measured WebGPU/download/CORS/wasm/
  cache/memory instability; may remain future opt-in research only.
- **New Cloud Run LLM proxy immediately:** deferred. Viable later if measured
  quality requires it; AI Search + Workers AI is less operational surface now.

## Security / privacy impact

Positive: no public R2 credentials/listing, no raw health context in guide
knowledge, no chat persistence by default, no provider secret in browser, no
new Auth/RLS/DB access, and explicit cross-origin allowlists.

Residual: generated output can still be wrong; client session ID is abuse-control
hint rather than identity; every shared bucket prefix requires review.

## Failure / rollback

- Asset gateway: remove mount/binding; existing asset domains remain intact.
- Guide: remove custom domain or roll back Worker; keep knowledge bucket private.
- Existing SK7 app remains functional because v1 is standalone.

## Verification

- read-only bucket/domain/CORS/lifecycle inventory
- unit tests for gateway isolation and guide minimization
- AI Search indexing/search smoke
- `/healthz`, streaming smoke, Range/HEAD smoke
- no product UI integration until standalone services are green

## Consequences

Benefits: stable SK7 asset namespace, safer Gomdory reuse, no direct OpenAI
egress dependency, no multi-GB browser model download, independent rollback.

Costs: two small Workers, one private R2 knowledge bucket, one AI Search
instance, and a new surface to observe/rate-limit.
