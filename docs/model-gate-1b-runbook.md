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

## Windows PowerShell preparation

Use explicit paths. The example keeps all participant-level material under
`C:\pj\sk7-model-local`, outside the repository.

```powershell
Set-Location C:\Users\emotigom\PycharmProjects\AH_05_07

$RawDir = "C:\pj\sk7-model-local\nhanes-2017-2020"
$WorkDir = "C:\pj\sk7-model-local\gate-1b"
$DerivedTable = Join-Path $WorkDir "derived.parquet"
$SplitDir = Join-Path $WorkDir "splits"
$EvidenceFile = Join-Path $WorkDir "gate-1b-evidence.json"
$Commit = (git rev-parse HEAD).Trim()

if ($Commit -notmatch '^[0-9a-f]{40}$') {
    throw "A full repository commit SHA is required."
}
if ((git status --porcelain)) {
    throw "Run Gate 1B only from a clean repository checkout."
}

New-Item -ItemType Directory -Force -Path $WorkDir | Out-Null
uv sync --group ai --frozen
```

Do not paste downloaded file URLs, cookies, or workstation paths into an Issue
or pull request.

## Canonical execution order

Stop at the first failure. Do not skip a failed stage or hand-edit its output.

```powershell
uv run --group ai python scripts/data/verify_manifest.py
uv run --group ai python scripts/data/audit_schema.py $RawDir
uv run --group ai python scripts/data/build_derived_table.py $RawDir $DerivedTable
uv run --group ai python scripts/data/freeze_split.py $DerivedTable $SplitDir --evidence $EvidenceFile --commit $Commit
```

The schema audit checks every module and column used by the derived-table
builder. The builder asserts that BP label inputs are absent from its output.
The split stage repeats that leakage assertion, uses the committed seed, and
writes `train.parquet`, `validation.parquet`, `test.parquet`, and
`split_metadata.json` locally. It optionally writes the sanitized evidence
record requested above.

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
