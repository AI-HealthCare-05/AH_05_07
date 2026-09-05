# Data preparation prerequisite — verification record

Date: 2026-09-05. Reviewed base: `20f23f7597ceb812170f6582fd6f5011cb5ec654`.
Status: local Windows verification and published Windows/Linux CI passed; PR #210 awaits user merge.
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

## Published verification follow-up

PR: [#210](https://github.com/AI-HealthCare-05/AH_05_07/pull/210).
Verified implementation commit: `fa1e091b9a4fa70cb7b6ea465b533ff060480fe7`.
The supplied patch SHA-256 matched SHA256SUMS.txt before application.

Local Windows PowerShell, Python 3.13.14: frozen AI/app sync, 28 data tests,
3 API tests, full Ruff check and format check, Gate 1B contract and self-test,
AI toolchain contract, secret boundary and self-test, and whitespace checks
all completed with exit code 0. `pyproject.toml` and `uv.lock` are unchanged.

- [Data preparation CI](https://github.com/AI-HealthCare-05/AH_05_07/actions/runs/33966811022):
  both `ubuntu-latest` and `windows-latest` synthetic preparation jobs passed.
- [General CI](https://github.com/AI-HealthCare-05/AH_05_07/actions/runs/33966811009):
  lint, app tests, web build and deployment-smoke controls passed.

Issue #208 links the prerequisite PR and remains open. These results establish
synthetic regression coverage, not operational Gate 1B acceptance.

## Not executed / not claimed

- Real NHANES files and operational Gate 1B evidence: not executed or reviewed.
- Two-model real-data evaluation, promotion, release or model quality: not done.
- Browser visual QA: not rerun; no web/DB changes. General CI ran app tests
  with its MySQL service and built the web client.
- Cloud Run, Cloudflare, R2 or Supabase mutation: none.

User review and merge remain pending. Actual-data preparation and human evidence
review are separate work under #208. The existing public service is unchanged
until any separately classified deployment occurs.
