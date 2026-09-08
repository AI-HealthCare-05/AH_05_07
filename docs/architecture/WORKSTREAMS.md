# Parallel workstreams

## Authority

| Stream | Normal ownership | Initial work |
|---|---|---|
| W — Windows / integration authority | `app/**`, `tests/**`, `supabase/**`, `scripts/**`, `infra/**`, Python runtime/dependency/release files, API contract authority, release integration, production coordination | R1, R3, R5, R6, R8, R9, R10 |
| M — macOS / web client authority | `web/src/**`, `web/e2e/**`, Playwright web/browser test configuration | R2, bounded R4 client portions, bounded R7 browser portions |

## Single-editor shared files

| Surface | Editor / review |
|---|---|
| Root/Python lockfiles; Dockerfile; Cloud Build; GitHub workflows | W |
| `web/package-lock.json` and web dependencies | M authors; W reviews release impact |
| `web/wrangler.jsonc` and production web build-variable contract | W |
| API/OpenAPI/error contract | W canonical authority; M consumer |
| `docs/architecture/**` shared contracts | W canonical editor |
| `HANDOFF_M.md` if later created | M |
| `HANDOFF_W.md` if later created | W |

This issue creates no handoff files.

## Freeze before parallel work

- Current 401 meaning; target distinction between invalid session and Auth-provider outage.
- RequestContext user/generation/token comparison semantics.
- Full-response timeout and unknown-write-outcome semantics.
- Model V2 exact two-field output.
- Challenge conflict semantics must not be invented before R5 evidence.
- Telemetry forbidden fields and release-manifest schema ownership.

## Checkpoints

1. **Checkpoint 0:** Issue #363 merged; both machines synchronize to the same merge SHA.
2. **Checkpoint 1:** W merges compatible R1 error contract before M relies on auth-unavailable semantics.
3. **Checkpoint 2:** Only W authors DB migrations. M waits only for a needed UI DB/API contract.
4. **Checkpoint 3:** W names an integration main SHA; M validates browser suite at that SHA.
5. **Checkpoint 4:** W controls release manifest, candidate verification, activation, and rollback.

Use no two long-lived integration branches. Each substantive change is one Issue, one short `codex/...` branch, one PR, then squash merge. Avoid broad formatters, mass moves, simultaneous `App.tsx` ownership where avoidable, and uncoordinated shared-contract edits.
