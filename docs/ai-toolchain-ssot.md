# AI toolchain single source of truth

This document is the repository authority for the SK7 model-development
toolchain. It records what is adopted, what is deliberately deferred, and how a
replacement is approved. `uv.lock` is the authority for exact resolved package
versions; this document is the authority for roles and boundaries.

The user-facing result is only an `입력 기반 위험군 선별 신호`. It is not a
diagnosis, treatment recommendation, prevention claim, or future-incidence
prediction. Model output, measured blood pressure, challenge participation,
and legacy records remain separate facts.

## Adopted stack

| Layer | Tool | Repository role | Version authority | License / terms |
| --- | --- | --- | --- | --- |
| Runtime | Python | Scripts, tests, API, artifact loading | `.python-version`, `pyproject.toml` | PSF License |
| Environment | uv | Dependency resolution and locked execution | CI action plus `uv.lock` | MIT or Apache-2.0 |
| Table preparation | pandas | XPT ingestion, joins, tabular transforms | `uv.lock` | BSD-3-Clause |
| Columnar files | PyArrow | Parquet engine for derived tables and frozen splits | `uv.lock` | Apache-2.0 |
| Classical ML | scikit-learn | Preprocessing, logistic baseline, histogram-gradient candidate, metrics | `uv.lock` | BSD-3-Clause |
| Artifact serialization | joblib | Local model artifact serialization | `uv.lock` | BSD-3-Clause |
| Numeric dependencies | NumPy, SciPy | Transitive numeric implementation used by the adopted stack | `uv.lock` | BSD-3-Clause |
| Automated checks | pytest, Coverage.py, Ruff, mypy | Tests, coverage, lint, formatting, static analysis | `uv.lock` | MIT / Apache-2.0 as applicable |
| CI | GitHub Actions | Runs repository verification; never produces authoritative model evidence by itself | Workflow commit SHA | GitHub service terms; action licenses are upstream-owned |
| Source data | CDC/NCHS NHANES 2017–March 2020 Pre-pandemic | Public candidate dataset named in the manifest | `data/manifest/nhanes_2017_2020.json` | CDC/NCHS published data terms |

Package names and exact versions must be recovered from `uv.lock`, not from a
chat transcript, workstation environment, or presentation. The direct AI
dependency allowlist is intentionally limited to `pandas`, `pyarrow`,
`scikit-learn`, and `joblib`.

## Internal executable pipeline

| Stage | Repository tool | Durable output or gate |
| --- | --- | --- |
| Source declaration | `data/manifest/nhanes_2017_2020.json` | Dataset, files, join key, label, predictor allowlist, split seed |
| Manifest validation | `scripts/data/verify_manifest.py` | Rejects an incomplete or unsafe source contract |
| Raw schema audit | `scripts/data/audit_schema.py` | Confirms required local columns before training |
| Derived table | `scripts/data/build_derived_table.py` | Creates a local leakage-checked Parquet table |
| Frozen split | `scripts/data/freeze_split.py` | Train/validation/test files plus split digest |
| Baseline comparison | `scripts/model/compare_baselines.py` | Logistic-regression and histogram-gradient metrics |
| Prediction evaluation | `scripts/model/evaluate_predictions.py` | AUROC, PR-AUC, Brier, calibration, and subgroup evidence |
| Artifact creation | `scripts/model/train_artifact.py` | Versioned joblib artifact and SHA-256 metadata |
| Promotion decision | `docs/model-promotion.md` | Deterministic comparison and promotion rules |
| Runtime verification | `app/core/model_artifact.py`, `app/core/model_registry.py`, `app/core/model_runner.py` | Hash, metadata, feature-order, and deterministic inference checks |

Raw or derived participant-level data, trained artifacts, and local evaluation
outputs are not committed. Only sanitized aggregate evidence and immutable
digests may enter the repository.

## Model family contract

- Default baseline: scikit-learn logistic regression.
- Bounded candidate: scikit-learn histogram gradient boosting.
- Promotion uses the frozen validation split and the rules in
  `docs/model-promotion.md`; test data is evaluated once after selection.
- Blood-pressure measurements used to define the label are prohibited as
  predictors.
- Repeated normalized input with one immutable artifact must return the same
  result.
- No metric or quality claim may be copied from an assistant response. Run the
  committed scripts against the frozen inputs and retain their sanitized
  machine output.

## Deferred tools

The following tools are not current dependencies. Naming them here preserves
the evaluation history; it does not authorize installation or use.

| Tool family | Current decision | Evidence required before adoption |
| --- | --- | --- |
| XGBoost or LightGBM | Deferred | Reproducible improvement over both contracted models plus deployment-cost review |
| PyTorch, TensorFlow, torchvision, torchaudio | Deferred | A task that classical tabular models cannot satisfy and measured benefit justifying operational weight |
| Optuna or another tuning framework | Deferred | A bounded search protocol, compute budget, leakage review, and reproducibility record |
| SHAP or another explanation package | Deferred | A specific evaluator/user need and a reviewed non-diagnostic explanation contract |
| MLflow or another experiment registry | Deferred | Repeated experiments whose provenance cannot be managed by manifests, digests, and repository evidence |
| Evidently or another model-monitoring suite | Deferred | A released model, lawful reference data, defined drift metric, threshold, owner, and response runbook |
| Prometheus/Grafana model dashboard | Deferred | A released inference path and an operator-owned SLI/SLO that repository/Cloud Run evidence cannot cover |
| Redis, Celery, or queue worker | Deferred | Measured request-duration or reliability trigger and an ADR defining PostgreSQL job state, retry, and idempotency |
| LLM, sentence-transformers, or embeddings | Outside current scope | A separately approved product requirement, privacy/threat review, evaluation dataset, cost/latency limit, and ADR |
| OCR or medical-document ingestion | Outside current scope | A separately approved data-handling purpose, consent/retention design, threat review, and ADR |

## Assistant boundary

OpenAI Codex Work may help inspect code, draft patches, and explain verification
commands. It is not an application runtime dependency, a training-data source,
an evaluator, or a source of model metrics. Assistant-generated text cannot
replace executable evidence, human review, a dataset usage record, or a model
promotion decision.

## Change control

Any addition, removal, replacement, or materially different use of an AI/data
tool requires all of the following in one reviewable change:

1. A GitHub Issue stating the measured requirement and current-stack gap.
2. A superseding ADR with alternatives, reproducibility, privacy, licensing,
   security, deployment, rollback, and maintenance consequences.
3. An update to this document, `pyproject.toml`, and `uv.lock`.
4. Updated executable verification and, where applicable, frozen comparison
   evidence produced by committed scripts.
5. A pull request and squash merge before Notion or submission material calls
   the change adopted.

Do not silently exchange libraries because a newer assistant, tutorial, or
reference architecture recommends a different tool. `scripts/ci/verify_ai_toolchain.py`
enforces the direct dependency allowlist and the presence of the contracted
pipeline files. A lock refresh that changes transitive versions still requires
normal review and passing tests.

## Scale-up and submission recovery

For a later scale-up or final submission, collect these authorities in order:

1. This document for selected and deferred tools.
2. `uv.lock` for exact package versions.
3. `data/manifest/nhanes_2017_2020.json` and `docs/data-contract.md` for source,
   features, label, and split contract.
4. `docs/model-promotion.md` plus sanitized script outputs for selection
   evidence.
5. Artifact metadata and SHA-256 digest for the released model version.
6. The superseding ADR and merged pull request for every approved tool change.

If any item is absent, describe the model gate as incomplete rather than
reconstructing it from memory.

## Gate 1B preparation revision

ADR-0003 defines version 2 feature semantics and the single
`scripts/data/prepare_gate_1b.py` operator entry point. The underlying four stages
are retained, with explicit categorical types and shared scikit-learn
preprocessing for comparison and artifact creation. The exact lockfile is
unchanged. The synthetic Linux/Windows workflow is a code regression gate; it
never downloads NHANES or publishes Gate 1B evidence. Actual preparation now has user-approved evidence in `docs/model-gate-1b-evidence.md`;
Actual internal validation is recorded in `docs/model-comparison-evidence.md`;
quality acceptance and promotion remain incomplete.

### Evidence input byte stability

Issue #208 found that Windows automatic CRLF checkout changed the manifest and
lockfile SHA-256 without changing Git content or dependency versions. Evidence
uses actual file bytes, so `.gitattributes` pins these two inputs to LF. The
Windows/Linux data workflow includes `tests/data/test_checkout_bytes.py`, which
compares a fresh `core.autocrlf=true` checkout with Git blob bytes and hashes.
See the runbook's checkout byte identity section for the fresh-checkout rerun
requirement. Existing evidence must remain untouched; this correction adds no
tool or version change and does not establish operational Gate acceptance.

Local Windows validation (2026-09-05): all 29 data tests passed, including the
fresh-checkout regression; full Ruff lint/format, Gate 1B contract/self-test,
toolchain contract, secret boundary and whitespace checks passed. Remote
Windows/Linux results are recorded in the referencing PR's Data preparation
checks; both must pass before merge. No actual-data rerun is part of this fix.

## Frozen validation execution path (Issue #213)

ADR-0004 and `docs/model-comparison-runbook.md` define the existing
`compare_baselines.py` as the single execution entry, shared `preprocessing.py`,
aggregate functions in `evaluate_predictions.py`, fixed `evaluation_rules.py`
and strict comparison verifier. Libraries and uv.lock are unchanged. Former
standalone prediction-file CLI use is replaced by this validated path. CI uses
only synthetic fixtures. Gate 1B #208 is complete via merged PR #212 at
`04ab996ba68c852fdf3f47ca94101294bd849f00`, with successful Windows/Linux evidence
and regression checks. Its state remains prepared_not_trained. The implemented comparison path was
subsequently run on approved train/validation; user-approved aggregates are in
`docs/evidence/model-comparison.json`, with the report and limitations in
`docs/model-comparison-evidence.md`. The comparison status is
validation_compared_not_promoted. The relative HGB result does not establish
quality sufficiency, statistical significance, Korean-user performance or release
suitability. No tool, lock, CONFIG, probability calibration or model is changed
by publication. Windows/Linux CI validates committed aggregates without fitting.

## Exploratory uncertainty implementation (Issue #217)

PR #216 merged at `b77f2ce3c81c620dcef4074fca60faaa88a8b5e7` with passing
Windows/Linux committed comparison, synthetic and general CI. Issue #215 is
closed for evidence publication only. Approved comparison and Gate JSON remain
unchanged. ADR-0005 and `docs/model-uncertainty-runbook.md` define a separate
paired-bootstrap CONFIG/schema and a future reproduction-gated execution path.
This PR implements and synthetically validates it; actual uncertainty execution
requires separate approval after merge. Pointwise conditional exploratory
intervals do not establish training stability, multiplicity control, NHANES
survey inference or Korean-user validity. Calibration, older-age performance,
external validation and prospectively defined release criteria remain open.
