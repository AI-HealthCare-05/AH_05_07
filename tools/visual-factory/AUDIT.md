# Visual Factory v0.3 audit — 2026-09-25 KST

Scope: canonical AH_05_07 source inspection, chat-distributed prototypes, isolated
candidate intake implementation, user-Mac verification and private R2 backup verification.
Not a production activation.

## Observed source and access

- Audit began against connector-observed main `3f41e10b654b6f78c7bbc48c9ef3cb02305e38d8`.
- Before implementation, the user Mac fetched `origin/main` at
  `8112b9d27baa85156b57a6d22f26afd824512026`. Before publication, `origin/main`
  advanced to `746939b3a19e730294e9e60eaaea05d58db82653`; the task worktree was fast-forwarded
  to that commit after confirming the intervening Rapier-only change did not alter the visual authorities.
- Open PRs at initial audit: none. Implementation is tracked by Issue #741.
- `web/scripts/visual` is absent from current main; v0.1/v0.2 remain local prototypes.
- Read AGENTS.md, docs/project-handoff.md, docs/README.md,
  docs/visual-production-contract.md, docs/visual-asset-runtime.md,
  ops/sk7-asset-gateway/README.md, pyproject.toml, .github/workflows/checks.yml,
  scripts/git/autopilot_guard.py.
- The chat GitHub connector initially returned `403 Resource not accessible by integration`
  for create_issue/create_branch. Implementation therefore used the user's authenticated local
  Git worktree without bypassing repository policy.
- No Cloudflare R2 plugin was available, but the user's Mac has authenticated Wrangler.
  Live read-only checks confirmed `sk7-design-corpus-private` has r2.dev disabled and zero custom domains.

## Prototype findings

| Finding | v0.3 disposition |
|---|---|
| Hardcoded `approved` candidate state | Always needs-review / runtimeApproved=false. |
| MIME inferred from filename; alpha claimed by `--transparent` | PNG bytes/CRC/scanlines/alpha inspected; WebP limits explicit. |
| Local version counters may reuse keys | UUID workspace/batch and full SHA-256 paths. |
| Wrangler object operations omit explicit `--remote` | Both PUT and GET include --remote. |
| Mutable index uploaded incrementally; local rollback misrepresents remote state | Images verified first, immutable batch index last; pending retained on failure. |
| HEAD/HTTP status treated as content proof | Full remote size/SHA readback. |
| Draft prefix in public bucket assumed private | Public bucket rejected; only confirmed private archive target allowed. |
| Proposed imagegen/v1 versus product visual/v2 confusion | Neither is used for unapproved public delivery; private candidate archive is distinct. |
| Repeated prerequisites/config/npm failures | Standalone initializer and foreground launchers; no web/package.json edits. |

`visual/v2` remains a planned, reviewed product delivery contract. This package
neither publishes there nor replaces existing v1 keys. The current gateway's
`sk7` mount exposes `sk7-assets-prod`, so a draft folder there is not access control.
`sk7-design-corpus-private` is excluded in the inspected gateway source, but this
is not an account-wide live proof. The operator must attest to other Worker routes;
the tool separately checks r2.dev and custom domains before a pending upload batch.

## Implemented safeguards

Standard-library Python, archive outside Git, deliberate dedicated inbox only,
no browser-cookie access or broad Downloads scraping, stable-file check, size and
pixel bounds, symlink/path checks, local lock, source preservation, metadata-clean
separate PNG derivative, local gallery/index, explicit remote enable/confirmation,
hard target/key allowlists, bounded foreground watch, immutable index-last protocol,
readback hashes, preserved pending plans, no deletes or runtime activation.

Original metadata/provenance is retained in the original object. It is not discarded
from the only source. No generation-model version, seed, official character approval,
rights clearance or medical meaning is fabricated from the filename/image.

## Executed verification

Initial package verification ran in Linux/Python 3.13.5; the same core suite was then
run on the user's Mac from a fresh worktree based on current `origin/main`.

- Core offline and fault-injected transport tests: **57/57 PASS** on the Mac.
- Earlier package/installer verification: **9/9 PASS** for installer preflight/application tests.
- Mac CLI `init`, `check`, `scan`, `ingest`, `configure-r2`, `doctor-r2`, and `sync` exercised.
- Live R2 privacy preflight: r2.dev disabled; custom domains zero.
- Deterministic 2×2 RGBA smoke PNG: stable-file guard first rejected the just-written file,
  then accepted it after settling; actual transparent pixels were detected from decoded scanlines.
- Live authenticated private R2 PUT/GET readback: **PASS**. Original/derivative bytes were
  read back and SHA-256 verified before the immutable batch index was uploaded and verified.
- Immediate second `sync`: `status=up-to-date`, `r2Writes=0`; one receipt remained.
- Repository Ruff check: **PASS**; Ruff format check: **261 files already formatted**.
- Targeted Visual Factory pytest: **57 passed**.
- Full local Python/MySQL payload with an isolated MySQL 8.0 container on port 3307:
  **1310 passed, 12 skipped, 0 failures**, with three existing deprecation warnings.
  The first full run against the user's unrelated localhost:3306 MySQL had 57 fixture errors
  from root authentication; the isolated CI-equivalent database removed all 57 errors.
- Coverage report after the full run: **89% total**; `tests/test_visual_factory.py` 99%,
  media probe 73%, R2 transport 82%, Visual Factory CLI 70%.
- The temporary MySQL container was removed automatically after the run.
- Autopilot guard: `protected`, with no denied paths; protection is caused by the new test path.
- Current mounted conversation PNG originals from the earlier package audit: **47/47** inspected;
  **19** had nonopaque pixels and **28** were fully opaque. That evidence remains package-time scope.

**Not yet executed:** GitHub-hosted CI and branch push/PR checks. These must not be
reported as PASS until run.

No product runtime, public `visual/v1`, planned product `visual/v2`, `companion/v1`,
DNS, CORS, bucket-publicity setting, or application catalog was changed. The only cloud
write was the synthetic smoke candidate under the private Visual Factory namespace.

## Limits

- PNG: bounded 8-bit non-interlaced static PNG validation, not every PNG profile.
- WebP: container/frame header validation, not full codec decoding; actual alpha unknown.
- No animation ingestion, resizing, WebP conversion, public promotion, shared mutable
  latest index, account-wide Worker exposure audit or cross-device catalog merge.
- Single local writer plus UUID/digest makes this client's retry idempotent, not
  server-enforced write-once storage against other credential holders.
- A failed remote verification keeps the batch pending; remote partial writes are
  not deleted and no remote rollback is claimed.

## Primary sources

- https://github.com/AI-HealthCare-05/AH_05_07/tree/3f41e10b654b6f78c7bbc48c9ef3cb02305e38d8
- https://developers.cloudflare.com/workers/wrangler/commands/r2/
- https://developers.cloudflare.com/r2/buckets/public-buckets/
- https://developers.cloudflare.com/r2/api/s3/api/
- https://help.openai.com/en/articles/11084440-images-in-chatgpt
- cloudflare/workers-sdk public-dev-url.ts blob `3dc883caaa9ea3f9c2309e61c11830f4c84273b9`
  and domain.ts blob `3697b042244991528ab98befe970c7d805f92f75` for fail-closed CLI parsing.

These are audit-time evidence references, not instructions to reuse the old main
for the next task. Always reread current main and the relevant authority.
