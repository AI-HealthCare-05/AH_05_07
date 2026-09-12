# AI toolchain single source of truth

This document owns the **SK7 model-development toolchain**: adopted tool roles,
the direct AI/data dependency boundary, deliberately deferred tools, and the
change-control process for replacing or adding those tools.

It does **not** own current product status, Model V2 release status, or live
runtime state. Use the concern-specific authorities below instead:

| Concern | Authority |
| --- | --- |
| Contribution policy, risk lane, startup routing | `AGENTS.md`, `docs/project-handoff.md#fast-start` |
| Current product requirements | `docs/requirements.md` |
| Frozen Model V2 product semantics and data-use boundary | `docs/model-v2-product-contract.md`, `docs/architecture/ARCHITECTURE_INVARIANTS.md` |
| Current source implementation | canonical repository `main`, executable code, migrations, and tests |
| Recorded deployment topology and operator gates | `docs/deployment-ssot.md`; re-check live control planes when current runtime identity matters |
| Exact resolved package versions | `uv.lock` |
| AI/data tool roles and replacement policy | this document and ADR-0002 |

Historical Gate 1B, comparison, uncertainty, model-card, and pre-Model-V2
release-readiness records remain evidence for their recorded SHA and scope. They
must not be read as current Model V2 product or production status.

The user-facing product term remains **입력 기반 위험군 선별 신호**. It is not
a diagnosis, treatment recommendation, prevention claim, future-incidence
prediction, or causal-improvement claim. Model output, measured blood pressure,
challenge participation, and legacy records remain separate facts.

## Adopted stack

| Layer | Tool | Repository role | Version authority | License / terms |
| --- | --- | --- | --- | --- |
| Runtime | Python | Scripts, tests, API, artifact loading | `.python-version`, `pyproject.toml` | PSF License |
| Environment | uv | Dependency resolution and locked execution | CI action plus `uv.lock` | MIT or Apache-2.0 |
| Table preparation | pandas | XPT ingestion, joins, tabular transforms | `uv.lock` | BSD-3-Clause |
| Columnar files | PyArrow | Parquet engine for derived tables and frozen splits | `uv.lock` | Apache-2.0 |
| Classical ML | scikit-learn | Preprocessing, bounded classical-model development, metrics | `uv.lock` | BSD-3-Clause |
| Artifact serialization | joblib | Local model-development artifact serialization | `uv.lock` | BSD-3-Clause |
| Numeric dependencies | NumPy, SciPy | Transitive numeric implementation used by the adopted stack | `uv.lock` | BSD-3-Clause |
| Automated checks | pytest, Coverage.py, Ruff, mypy | Tests, coverage, lint, formatting, static analysis | `uv.lock` | MIT / Apache-2.0 as applicable |
| CI | GitHub Actions | Runs repository verification; never produces authoritative model evidence by itself | Workflow commit SHA | GitHub service terms; action licenses are upstream-owned |
| Source data | CDC/NCHS NHANES 2017–March 2020 Pre-pandemic | Public source named in the retained manifest | `data/manifest/nhanes_2017_2020.json` | CDC/NCHS published data terms |

Package names and exact versions must be recovered from `uv.lock`, not from a
chat transcript, workstation environment, or presentation. The direct AI
dependency allowlist is intentionally limited to `pandas`, `pyarrow`,
`scikit-learn`, and `joblib`.

## Retained model-development pipeline

The files below remain contracted development tools and are kept available for
their recorded data/model-development scopes. They are not a second release
authority for the frozen Model V2 product path.

| Stage | Repository tool | Durable output or gate |
| --- | --- | --- |
| Source declaration | `data/manifest/nhanes_2017_2020.json` | Dataset, files, join key, label, predictor allowlist, split seed |
| Manifest validation | `scripts/data/verify_manifest.py` | Rejects an incomplete or unsafe source contract |
| Raw schema audit | `scripts/data/audit_schema.py` | Confirms required local columns before model-development work |
| Derived table | `scripts/data/build_derived_table.py` | Creates a local leakage-checked Parquet table |
| Frozen split | `scripts/data/freeze_split.py` | Train/validation/test files plus split digest |
| Baseline comparison | `scripts/model/compare_baselines.py` | Logistic-regression and histogram-gradient comparison metrics |
| Prediction evaluation | `scripts/model/evaluate_predictions.py` | AUROC, PR-AUC, Brier, calibration, and subgroup evidence |
| Legacy artifact path | `scripts/model/train_artifact.py` | Versioned joblib artifact and SHA-256 metadata for its retained scope |
| Legacy comparison/promotion contract | `docs/model-promotion.md` | Historical deterministic comparison and promotion rules for that retained path |
| Runtime verification utilities | `app/core/model_artifact.py`, `app/core/model_registry.py`, `app/core/model_runner.py` | Hash, metadata, feature-order, and deterministic inference checks in their applicable scope |

Raw or derived participant-level data, trained artifacts, and local evaluation
outputs are not committed. Only sanitized aggregate evidence and immutable
digests may enter the repository.

## Frozen Model V2 boundary

The frozen Model V2 artifact, exact 11-feature semantics and order,
preprocessing, target-leakage prohibition, product input handling, transient
numeric inference, and non-numeric product projection are governed by
`docs/model-v2-product-contract.md` and the architecture invariants.

This toolchain SSOT cannot select, retrain, replace, recalibrate, or otherwise
change the frozen Model V2 contract. A toolchain dependency change also does not
mean a model change, product release, deployment, or production activation.

Blood-pressure measurements used to define a research label remain prohibited
as predictors. Model metrics or quality claims must come from the applicable
committed executable evidence, never from assistant prose.

## Deferred tools

The following tools are not current dependencies. Naming them here preserves the
evaluation boundary; it does not authorize installation or use.

| Tool family | Current decision | Evidence required before adoption |
| --- | --- | --- |
| XGBoost or LightGBM | Deferred | Reproducible need or benefit beyond the contracted stack plus deployment-cost review |
| PyTorch, TensorFlow, torchvision, torchaudio | Deferred | A task that the bounded classical stack cannot satisfy and measured benefit justifying operational weight |
| Optuna or another tuning framework | Deferred | A bounded search protocol, compute budget, leakage review, and reproducibility record |
| SHAP or another explanation package | Deferred | A specific evaluator/user need and a reviewed non-diagnostic explanation contract |
| MLflow or another experiment registry | Deferred | Repeated experiments whose provenance cannot be managed by manifests, digests, and repository evidence |
| Evidently or another model-monitoring suite | Deferred | A released inference path, lawful reference data, defined drift metric, threshold, owner, and response runbook |
| Prometheus/Grafana model dashboard | Deferred | An operator-owned SLI/SLO that existing platform evidence cannot cover |
| Redis, Celery, or queue worker | Deferred | Measured request-duration or reliability trigger and an ADR defining state, retry, idempotency, and rollback |
| LLM, sentence-transformers, or embeddings | Outside current scope | A separately approved product requirement, privacy/threat review, evaluation dataset, cost/latency limit, and ADR |
| OCR or medical-document ingestion | Outside current scope | A separately approved data-handling purpose, consent/retention design, threat review, and ADR |

## Assistant boundary

An implementation assistant may inspect code, draft patches, and explain
verification commands. It is not an application runtime dependency, a
training-data source, an evaluator, or a source of model metrics.
Assistant-generated text cannot replace executable evidence, human review, a
dataset usage record, or a model/release decision.

## Change control

Any addition, removal, replacement, or materially different use of an AI/data
tool requires all of the following in one reviewable change:

1. A GitHub Issue stating the measured requirement and current-stack gap.
2. A superseding ADR with alternatives, reproducibility, privacy, licensing,
   security, deployment, rollback, and maintenance consequences.
3. An update to this document, `pyproject.toml`, and `uv.lock`.
4. Updated executable verification and, where applicable, bounded evidence
   produced by committed scripts.
5. A pull request and merge before Notion or submission material calls the tool
   adopted.

Do not silently exchange libraries because an assistant, tutorial, or reference
architecture recommends a different tool. `AGENTS.md` remains the higher-level
risk policy.

`scripts/ci/verify_ai_toolchain.py` enforces the direct dependency allowlist and
the presence of the contracted pipeline files. A lock refresh that changes
transitive versions still requires normal review and passing affected checks.

## Recovery rule

When reconstructing project context, do not infer current product/model/runtime
status from historical Gate 1B, model-comparison, model-card, or readiness
documents. Start from `AGENTS.md` and `docs/project-handoff.md#fast-start`, then
open only the concern-specific authority from the table at the top of this file.

If a historical record conflicts with a current authority, the historical record
remains evidence for its recorded SHA and scope; it does not become a competing
SSOT.
