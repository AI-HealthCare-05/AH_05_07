# SK7 Repository Evidence Atlas

Task-local evidence tooling and navigation, not product/runtime authority.

- [Work contract](WORKPLAN.md) · [Original request](TASK_REQUEST.md)
- [Resume here](RESUME.md) · [State](STATE.json) · [Atomic queue](QUEUE.json)
- [Source selections](SOURCES.json) · [Evidence index](evidence-index.json) · [Gaps](gaps.json)

Implementation v1 is complete for the pinned audited SHA. Generated reports are under `reports/`.

Read-only drift check:

```bash
python3 scripts/check_repository_evidence.py --check
```

Regeneration is write-preflighted and requires the reviewed full HEAD SHA. The committed detail surface keeps `validation.json` plus `reference-summary.json`; redundant full reference/Markdown tables are intentionally not generated. No CI integration or publication is authorized.
