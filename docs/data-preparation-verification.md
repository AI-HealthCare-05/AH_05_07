# Data preparation prerequisite — verification record

Date: 2026-09-05. Reviewed base: `20f23f7597ceb812170f6582fd6f5011cb5ec654`.
Status: local implementation verified; remote publication and Windows run pending.
Related operational Issue: #208, which remains open.

## Executed evidence

Environment: Linux x86_64, Python 3.13.14, exact unchanged `uv.lock`.
pandas 3.0.5, PyArrow 25.0.1, scikit-learn 1.8.0, joblib 1.5.3,
NumPy 2.4.1 and SciPy 1.17.0. No production datasets were used.

| Check | Command | Result |
| --- | --- | --- |
| Source semantics and real CLI integration | `uv run --frozen --group ai --group app python -m pytest tests/data -q` | 28 passed |
| Unreleased API input barrier | `uv run --frozen --group ai --group app python -m pytest app/tests/risk_signal_apis --confcutdir=app/tests/risk_signal_apis -q` | 3 passed |
| Lint | `uv run --frozen --group ai --group app ruff check .` | Passed |
| Formatting | `uv run --frozen --group ai --group app ruff format . --check` | Passed |
| Gate 1B contract and verifier controls | `python scripts/ci/verify_model_gate_1b_contract.py` and `--self-test` | Passed |
| Toolchain contract | `python scripts/ci/verify_ai_toolchain.py` | Passed |
| Secret boundary and verifier controls | `python scripts/ci/verify_secret_boundary.py` and `--self-test` | Passed |
| Whitespace | `git diff --check` | Passed |

The 28 data checks include a generated numeric SAS v5/XPT round trip through
pandas, a clean temporary Git checkout, actual subprocess execution of both
preparation passes, exact evidence equality, and mismatched-evidence rejection.
They also exercise spaces in paths, existing-output refusal, dirty checkout,
missing source files, malformed XPT, external-path enforcement, BP missingness,
source special codes, duplicate keys, train-only imputation, disjoint partitions,
source-order stability, and synthetic fitted-pipeline serialization.
Synthetic fixtures and test artifacts stay in temporary test directories. No
participant rows, source XPT, Parquet, trained production artifact or Gate 1B
operational evidence is part of the patch.

## Not executed / not claimed

- Windows OS or the operator's PowerShell session: not executed here.
  `.github/workflows/data-preparation.yml` supplies Windows/Linux regression jobs
  for execution after publication. It does not mean those jobs have run.
- Real NHANES files and operational Gate 1B evidence: not executed or reviewed.
- Two-model real-data evaluation, promotion, release or model quality: not done.
- Browser visual QA, DB tests or web build: not rerun; no web/DB changes.
- Cloud Run, Cloudflare, R2 or Supabase mutation: none.
- GitHub Issue/branch creation: connector returned 403, resource not accessible
  by integration. Git push preflight also lacked credentials. No remote branch,
  PR or workflow run was created by this session. A reviewable patch is supplied.

Before actual-data operation, publish the patch from an authorized checkout,
review the PR and Windows CI result, and merge. Then run the single entry point
on local external files and review only its allowed evidence JSON. The existing
public service is unchanged until any separately classified deployment occurs.
