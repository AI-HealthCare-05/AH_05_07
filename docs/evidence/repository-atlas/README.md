# SK7 Repository Evidence Atlas

Offline, pinned-source repository evidence audit and navigation helper. This directory is **not** current product/runtime authority and does not replace [`docs/README.md`](../../README.md) or any boundary-specific contract.

The committed surface is intentionally compact:

- `SOURCES.json`: curated source selections pinned to the audited SHA.
- `evidence-index.json`: normalized evidence records.
- `authority-graph.json`: typed, endpoint-validated evidence/source/boundary relationships.
- `source-validation.json`: local validation of curated source records.
- `gaps.json`: confirmed local/source gaps only; ambiguous remote or symbolic references remain unverified, not broken.
- `reference-summary.json`: aggregate reference counts and offline verification status.
- `inventories/summary.json`: aggregate tracked-tree inventory counts only.
- `reports/`: human-readable atlas, gap report and authority map.

Raw per-file inventories and per-reference validation tables are computed in memory and are intentionally **not committed**. This keeps the audit reproducible without turning generated detail into a permanent document registry.

Read-only drift check:

```bash
python3 scripts/check_repository_evidence.py --check
```

Regeneration requires an attached branch and the reviewed full HEAD SHA:

```bash
python3 scripts/check_repository_evidence.py --write --expect-head "$(git rev-parse HEAD)"
```

The audit makes no network assertion about PRs, Issues or GitHub URLs, does not attest to deployed runtime state, and is not wired into required CI.
