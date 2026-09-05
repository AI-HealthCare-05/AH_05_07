# Model Gate 1B local data preparation runbook

## Purpose and boundary

Gate 1B proves that the declared NHANES files can be audited, transformed into
the contracted predictor table, and divided into a reproducible frozen split.
It does not train, compare, serialize, promote, or deploy a model. The public
risk-signal path remains `503 model_not_ready`.

Run every data command in a local workspace outside the Git repository. Never
commit or upload raw XPT files, derived Parquet files, split Parquet files,
participant identifiers, individual health values, local paths, credentials,
or full console logs. The only shareable Gate 1B record is the generated
sanitized evidence JSON after a human checks it against the field allowlist
below.

## Authorities

- `docs/ai-toolchain-ssot.md` fixes the approved tools and change process.
- `uv.lock` fixes exact resolved versions.
- `data/manifest/nhanes_2017_2020.json` fixes the dataset, file names, module
  columns, label inputs, predictor allowlist, and split seed.
- `docs/data-contract.md` fixes the product and leakage boundaries.
- CDC/NCHS is the data source. Obtain the named release files manually from the
  source linked in the manifest and follow its published usage terms.

## Required local files

Place these seven files in one local raw-data directory outside the repository:

| Module | File | Required non-key columns |
| --- | --- | --- |
| Demographics | `P_DEMO.xpt` | `RIAGENDR`, `RIDAGEYR` |
| Body measures | `P_BMX.xpt` | `BMXBMI` |
| Blood pressure label inputs | `P_BPXO.xpt` | `BPXOSY1`–`BPXOSY3`, `BPXODI1`–`BPXODI3` |
| Physical activity | `P_PAQ.xpt` | `PAQ605`, `PAQ620` |
| Smoking | `P_SMQ.xpt` | `SMQ020` |
| Alcohol | `P_ALQ.xpt` | `ALQ111` |
| Sleep | `P_SLQ.xpt` | `SLD012` |

Every file also requires the `SEQN` join key. `SEQN` may exist in local
intermediate data for deterministic joins and split hashing, but it must never
be a model predictor or appear in shared evidence.

## Single entry point on Windows, macOS, or Linux

Use the merged, clean repository checkout. Preserve earlier runners and results;
do not execute an old downloaded runner. The repository now owns the only
operator entry point. It does not switch branches, pull, install tools, download
data, change execution policy, train, or deploy.

First install the exact environment (one-time or after an approved lock change):

```powershell
uv sync --group ai --frozen
```

Run the next command only if sync succeeds. The work directory must not exist;
use a new location outside the Git repository, separate from the raw directory.
Do not pre-create it. Paths with spaces are supported. Run from the repository
root, or supply the absolute script path when using the prepared Python.

```powershell
uv run --frozen --group ai python scripts/data/prepare_gate_1b.py --raw-dir "C:\pj\sk7-model-local\nhanes-2017-2020" --work-dir "C:\pj\sk7-model-local\gate-1b-reviewed"
```

There is no PowerShell `.ps1` wrapper, stderr redirection, execution-policy
change, or `git switch` call. Native subprocess success is determined by exit
code. A nonzero result means stop; existing raw files and results are preserved.

The preflight checks exact Python and the six locked AI/numeric package
versions, clean Git state, all seven files, and disjoint external paths. It
records source hashes locally, rejects an existing work directory, and runs:

1. `verify_manifest.py`
2. `audit_schema.py`
3. `build_derived_table.py`
4. `freeze_split.py`
5. `verify_model_gate_1b_contract.py --evidence ...`

The sequence runs twice into `run-a` and `run-b`. Each child uses the same
Python executable and repository working directory. Any failed stage stops
later stages; child logs containing paths or rows are not printed. The final
source hashes and clean commit must still match. Both evidence records must be
identical before `gate-1b-evidence.json` is created at the work root.

`local-review.json` records the local source hashes, environment, and comparison
result; do not upload it. `run-a` and `run-b` contain participant-level material
and must remain local. Only the root evidence JSON is a candidate for human
review and sharing. `prepared_not_trained` never means reviewed, trained, or
released. Synthetic CI success is not evidence about the operator's real files.

| Failed stage | Local action |
| --- | --- |
| Environment | Resolve the exact `.python-version` / frozen lock environment; do not edit the lock to fit the machine. |
| Clean checkout | Preserve local edits and select a clean checkout. The runner will not reset it. |
| Source preflight | Check the named official file locally; do not paste paths or file content. |
| Schema | Confirm the files are XPORT release files with the required columns, not HTML download pages. |
| Derive | Review key uniqueness, adult/BMI eligibility, BP availability, and unexpected questionnaire codes against the contract. |
| Split | Check both classes and sufficient rows in each partition, exact columns, and observed numeric training values. |
| Evidence / comparison | Keep both runs; investigate code/source changes or digest differences before training. |

Low-level commands remain for development and local diagnosis. They do not
replace the entry point's environment, clean-checkout, or two-run checks.
Do not share their tracebacks or participant-level output.

## Sanitized evidence allowlist

Review `gate-1b-evidence.json` before sharing it. It must contain only:

- schema version, gate name, and `prepared_not_trained` status;
- full repository commit SHA and public dataset identifier;
- SHA-256 digests for the manifest, `uv.lock`, derived table, and split files;
- frozen split digest and committed seed;
- predictor names, label name, and `prohibited_predictors_absent: true`;
- aggregate total/train/validation/test row counts.

It must not contain `SEQN` values, source rows, individual measurements, label
values, fill values, class counts, local paths, usernames, email addresses,
tokens, credentials, request headers, or raw logs. Hashes prove byte identity;
they do not authorize publishing the hashed files.

Suggested Issue or pull-request result:

```text
Gate 1B local preparation: passed|failed
Repository commit: <full SHA>
Environment: Windows / Python from .python-version / uv.lock
Manifest audit: passed|failed
Seven-module schema audit: passed|failed
Leakage assertion: passed|failed
Frozen split: passed|failed
Sanitized evidence reviewed: yes|no
Notes: <short non-sensitive note>
```

Attach the reviewed JSON only when project policy permits it. Never attach the
data files or complete terminal output.

## Failure and rerun rules

- Missing file or column: stop and correct the local source set; do not weaken
  the manifest or silently substitute another release.
- Duplicate join keys or failed leakage assertion: stop and open a bounded
  Issue before changing transformation logic.
- Different digest from a rerun at the same commit and input bytes: retain both
  sanitized evidence files locally and investigate before model work.
- A tool or version change: follow ADR-0002 and the AI toolchain SSOT before
  rerunning.

Gate 1B is complete only after the operator runs this procedure and reviews the
sanitized evidence. Merging the runbook and verifier alone establishes the
contract; it does not mark the data gate as passed.
