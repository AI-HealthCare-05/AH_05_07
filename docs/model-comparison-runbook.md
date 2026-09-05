# Frozen validation comparison runbook

Issue #213 implementation is complete through merged PR #214. A subsequent
user-authorized actual train/validation run is recorded in
[model-comparison-evidence.md](model-comparison-evidence.md); Issue #215 publishes
the user-approved aggregates and their limitations. Gate 1B Issue #208 is complete
through PR #212, merged at `04ab996ba68c852fdf3f47ca94101294bd849f00` with all
Windows/Linux evidence/synthetic checks and general CI successful. The original
Gate 1B record remains `prepared_not_trained`; it is not model completion.

## Fixed inputs and execution

Use a fresh clean merged checkout and `uv sync --frozen --group ai`. The Python
and six AI/numeric versions must match the existing lock. Preserve original
Gate 1B outputs and use a new external output directory, not pre-created and
not overlapping the frozen split directory. No global Git configuration change.

```
uv run --frozen --group ai python scripts/model/compare_baselines.py --split-dir <external-frozen-splits> --work-dir <new-external-directory>
uv run --frozen --group ai python scripts/ci/verify_model_comparison.py --evidence <new-external-directory>/comparison-evidence.json
```

Check each exit code and stop on failure. There is no tuning flag or artifact
serialization. A failed preflight creates no output. Later failure preserves a
local `failure.json` with an enum reason and stage, never exception text or a
traceback. An existing result directory is always refused. Review failures
locally and use a new directory only after resolving their cause. Convergence
warnings and numerical RuntimeWarnings are errors; do not accept partial results.

Before fit, the runner checks approved Gate 1B allowlist/alignment, train and
validation file hashes, exact feature/column order, semantics version, metadata
seed/split digest/counts/partition hashes, finite valid inputs, disjoint join keys
and both training classes. Frozen partitions are already imputed. Continuous
fallback medians are recomputed only from train and compared to frozen metadata;
categorical missing remains -1. Feature order/types come from the manifest.
The common preprocessor fits exactly once on train, transforms validation, and
passes copies of the same matrices and training labels to both models. No scaler
or vocabulary is fitted on validation. Test file bytes are never opened, hashed,
or parsed: its digest is only compared as a field in existing metadata/evidence.
This path cannot independently rederive the full three-way split digest without
test; the approved Gate 1B evidence supplies that attestation.

The runner checks input/metadata/checkout stability again before writing results.
It does not claim protection against a malicious process changing bytes between
checks. Keep inputs immutable during execution.

## Rules fixed before actual evaluation

`evaluation_rules.py` CONFIG version 1 is hashed as sorted compact canonical JSON.
No result-driven threshold changes or unbounded search are permitted.

- LogisticRegression: lbfgs, C=1, max_iter=2000, seed 20260901.
- HistGradientBoostingClassifier: 100 iterations, learning_rate=0.1,
  max_leaf_nodes=31, min_samples_leaf=20, l2_regularization=0,
  early_stopping=False, seed 20260901. No validation-based early stopping.
- Unspecified estimator options retain the locked scikit-learn defaults. The
  existing transitive threadpoolctl bounds native fit/predict threads to one;
  no package or lockfile is added/changed. Bitwise cross-platform numerical
  equality is not claimed; reproducibility checks use the same environment.
- AUROC, average precision (the PR-AUC definition), Brier for both models.
- Calibration: ten uniform bins on [0,1], [0,.1), ... [.9,1], including empty
  bins. Each reports count, mean prediction and mean observed label when allowed.
- Fixed sex groups: source codes 1, 2 and missing (-1). Fixed age groups:
  18–39, 40–59, 60–80 inclusive (80 is top-coded, not exact age).
- Every group has a row count and each metric has status/reason/value. Empty
  groups/bins use null with empty_group/empty_bin. Fewer than 20 rows suppress
  metric values as insufficient_rows. At least 20 single-class rows retain
  computable Brier but AUROC and PR-AUC are null/single_class. Nonfinite metrics
  become null/nonfinite_metric. Invalid labels or probabilities fail the run.
  These fixed suppression rules reduce disclosure; they do not establish
  statistical power, fairness, clinical validity or permission to publish.
- No NaN/Infinity JSON. Relative comparison retains the existing strict higher
  PR-AUC, no-worse Brier and no-worse AUROC conjunction; missing required metrics
  produce not_computable. Both reports are required. The result is a relative
  comparison only, not artifact selection, promotion approval or adequate quality.

## Evidence and local boundary

`comparison-evidence.json` is a NEW aggregate candidate schema, separate from
unchanged Gate 1B JSON. The recursive verifier allows only schema/status,
execution SHA, provenance (Gate execution SHA and canonical JSON digest,
manifest/lock/split/metadata/train/validation hashes, feature order, semantics),
fixed CONFIG and its digest, the two metric/calibration/subgroup reports,
relative result, `test_used=false` and `release_approved=false`. Gate JSON hashing
uses sorted compact canonical JSON to avoid a new checkout-newline dependency.
Metadata hashes disclose no fill values. Execution SHA differs intentionally
from the earlier Gate 1B preparation SHA. The verifier checks structure and
repository alignment, not provenance authenticity or independently recomputed
performance. Human aggregate review is required before public publication.

Rows, per-person predictions, labels, join identifiers, fitted estimators, fill
values and full logs are never emitted in the candidate or console. Fitted
estimators exist only in local process memory and are not serialized; no
per-person prediction files are written by this path. Local inputs and any
failure record remain private. Approved actual aggregates are stored in `docs/evidence/model-comparison.json`;
publication does not rerun fitting.

Further training, test evaluation, model card/artifact/promotion,
release, user input adapter and UI work remain separate. The public result
continues to be named 입력 기반 위험군 선별 신호; existing model-unavailable behavior
is unchanged.

## Follow-up uncertainty path

Issue #217 and [the uncertainty runbook](model-uncertainty-runbook.md) define
a separate exploratory bootstrap contract and reproduction gate. The original
comparison command, CONFIG and approved evidence remain unchanged. Implementation
merged in PR #218, the separately approved local execution succeeded, and its
[aggregate report](model-uncertainty-evidence.md) was published through merged
PR #220. #217/#219 are complete for their respective scopes. Any future actual
execution still needs separate approval; [release contracts](model-release-readiness.md)
remain under review in #221.
