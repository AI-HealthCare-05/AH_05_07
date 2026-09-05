# Gate 1B approved preparation evidence

Status: `prepared_not_trained`. Related Issue: #208 (closed after PR #212 merge and CI verification).
Execution commit: `cb3a3f06d7378fe4d526abd66275af1e2fb5c7ad`.
The [approved JSON](evidence/model-gate-1b.json) is copied unchanged from the
latest generated evidence. Its commit identifies the actual preparation run,
not this publication commit. Only the runbook's allowlisted JSON is stored in
`docs/evidence/`; participant-level artifacts and other metadata remain local.

## Windows operator execution report

The local execution report records Windows, Python 3.13.14, uv 0.12.8,
pandas 3.0.5, PyArrow 25.0.1, scikit-learn 1.8.0, joblib 1.5.3,
NumPy 2.4.1 and SciPy 1.17.0 with the unchanged frozen lockfile.

The canonical `prepare_gate_1b.py` completed manifest and seven-module XPORT
schema validation, derived-table creation, frozen splits and evidence validation
twice using the same source files, environment and execution commit. Both
evidence records matched. Independent local checks recomputed output file hashes
and the split digest, checked source-hash and commit stability, and confirmed
the predictor exclusion of label inputs and the join identifier. All exited 0.

Aggregate rows: total 7,944; train 5,560; validation 1,192; test 1,192.
The previous run's source hashes, counts, derived-table bytes and split-file
bytes matched. Only the execution commit and the manifest/lock hashes changed.
PR #211 fixed automatic CRLF conversion with LF attributes. Before and after
this run, both checkout files contained no CRLF and matched Git blob bytes:

- Manifest SHA-256: `ab5b952d4041457f2ead0360ee46978db409aeddb7b8097e166dbaa714151b52`
- Lock SHA-256: `df3346e481200f56eaf19c142aff4d5d2853c20d2ca6cfbf32fabb7782b41912`

## Human approval and repository validation

The user reviewed the latest evidence JSON and explicitly approved public
repository publication in this task. This approval is an evidence publication
decision; it is not an AI assertion of independent source-data authenticity
or a claim that the user inspected every source row. The execution report above,
human approval, and automated JSON validation are separate facts.

Before copying, the original passed the existing verifier's exact field allowlist
and repository alignment checks. The copied bytes were compared with the original.
CI uses the same verifier on Windows/Linux to check the committed JSON against
the repository contract. That job neither downloads source data nor reruns data
preparation, and cannot establish source provenance or independently reproduce
the reported participant-level run. Existing synthetic regression jobs remain
separate from this evidence validation.

## Acceptance and remaining work

Issue #208's preparation, two-run reproducibility, human evidence review and
publication-approval conditions are supported by the report and approved JSON.
The evidence PR adds committed-evidence CI and synchronized acceptance/runbook/
handoff records. PR #212 is merged and its CI checks passed; #208 was closed on subsequent
user instruction as preparation complete. No raw files, Parquet, individual values, imputation
statistics, local review metadata or full logs are included.

Model training, evaluation, promotion and production deployment were not
performed during that preparation run. Later comparison and exploratory
uncertainty execution/publication are complete. AC-02/03/07 remain open for
reviewed input semantics, quality/external validation, selected artifact and
release approval; see the [draft model card](model-card.md) and
[current readiness matrix](model-release-readiness.md). Preparation evidence does not enable
the `503 model_not_ready` API or establish model quality.


## Gate 1B closure and next implementation

PR #212 merged at `04ab996ba68c852fdf3f47ca94101294bd849f00`; its Windows/Linux
committed-evidence and synthetic checks plus general CI all passed. All #208
preparation/publication conditions were confirmed and the Issue was closed on
user instruction. The
approved evidence remains unchanged and `prepared_not_trained`, not model complete.
Issue #213 comparison implementation completed via PR #214. Subsequent
comparison and uncertainty evidence are distinct from this preparation record.
No test evaluation, serialization, promotion, adapter/UI activation or model
deployment is claimed by any of these published aggregates.
