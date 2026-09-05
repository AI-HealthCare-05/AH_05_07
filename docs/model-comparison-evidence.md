# Approved validation comparison evidence and limitations

Status: `validation_compared_not_promoted`. Publication Issue: #215.
Implementation Issue #213 was fulfilled by PR #214, merged as
`668a0d81fb7b477b278dca8319440900bc530dd3` with Windows/Linux synthetic and general
CI passing. Implementation completion and this actual-result publication are
separate scopes. Neither is model promotion.

[Approved aggregate JSON](evidence/model-comparison.json) is copied without
field changes from the local result. Its execution commit remains
`668a0d81fb7b477b278dca8319440900bc530dd3`, not the publication commit.
CONFIG SHA-256: `aed79ee34d52ff2777a1e4412473f80f121c561fa76226f47f8a2a0e0a52cb49`.
The existing Gate 1B evidence and evaluation CONFIG are unchanged.

## Windows operator execution report

The operator report records Python 3.13.14, uv 0.12.8, pandas 3.0.5,
PyArrow 25.0.1, scikit-learn 1.8.0, joblib 1.5.3, NumPy 2.4.1 and SciPy 1.17.0.
Frozen train contained 5,560 rows and validation 1,192 rows. Input hashes,
feature order, semantics and metadata matched approved Gate 1B; LF manifest/lock
bytes matched Git blobs. Both models used common train-fitted preprocessing
and the same validation partition under the precommitted rules. The comparison,
subsequent verifier and post-run commit/input/CONFIG checks completed with exit 0.
No result-driven parameter changes, extra search or rerun are reported.

| Model | Validation AUROC | PR-AUC (average precision) | Brier |
| --- | --- | --- | --- |
| LogisticRegression | 0.672959 | 0.530483 | 0.224278 |
| HistGradientBoostingClassifier | 0.687532 | 0.593331 | 0.219326 |

The tool emitted `candidate_meets_relative_conditions`: HGB has higher overall
PR-AUC and no-worse overall AUROC/Brier, with both calibration/subgroup reports.
This records only the predeclared relative conjunction. Model quality sufficiency,
statistical significance and release suitability are not established.

## Limitations that remain visible

- Age 60–80 (80 is top-coded), 392 validation rows: HGB AUROC 0.570383
  (about 0.5704), versus logistic 0.501008. The overall result must not obscure
  this subgroup's limited observed discrimination.
- HGB underpredicts in its low prediction bins. For [0,0.1), 134 rows have mean
  predicted 0.054031 versus observed proportion 0.134328. For [0.1,0.2),
  104 rows have 0.153490 versus 0.211538; for [0.2,0.3), 102 rows have
  0.253451 versus 0.323529. No probability correction was performed.
- Age 18–39, 415 rows: Brier worsens from 0.175858 to 0.176357 for HGB.
- Age 40–59, 385 rows: AUROC worsens from 0.641739 to 0.634952 for HGB.
- The original comparison produced no confidence intervals or significance tests.
  The later [separate exploratory uncertainty report](model-uncertainty-evidence.md)
  adds conditional pointwise intervals without changing this comparison JSON;
  it does not establish general robustness to sampling or training variation.
- The fixed fewer-than-20-row rule suppresses metric values. Logistic calibration
  has two insufficient-row bins and one empty bin; HGB has two insufficient-row
  bins. The missing-sex group is empty for both models. Status/reason/null values
  remain in the JSON, with no invented values or silent omissions.
- This is internal validation on a US public NHANES dataset and its specified
  analysis cohort, without survey-weighted population inference. It does not
  establish performance for Korean users or an external clinical population.

## Aggregate verification and human publication approval

Before copying, the local JSON passed the existing verifier against the current
repository contract; copied bytes were compared with the source. The verifier
checks the recursive field allowlist, fixed CONFIG, Gate/manifest/lock/input
hash references, allowed finite metrics, aggregate count consistency and the
relative decision. It does not recompute performance from participant data,
authenticate source provenance, or prove statistical validity.

The user separately reviewed this JSON and explicitly approved repository public
publication. Approval concerns the aggregate publication, not release suitability
or AI independent certification of source records. The Windows execution report,
automatic aggregate validation and human approval are distinct evidence types.
Windows/Linux committed-comparison CI reruns only the existing JSON verifier;
it performs no actual fitting or source-data access. Synthetic CI remains separate.

## Preserved boundaries and next design

`test_used=false` and `release_approved=false`. No per-person predictions,
labels, identifiers, fill values, source files or full logs are published.
The original local result and Gate 1B JSON are preserved. This publication does
not retrain, tune, calibrate probabilities, evaluate test, serialize a model,
promote, deploy or implement an input adapter.

The separate exploratory uncertainty result is now reported above. Further
work requires reviewed designs to investigate
older-age and calibration limitations and subgroup regressions, define external
and Korean-user validation, and set explicit quality/release criteria. Any later
calibration, test protocol, artifact/adapter or promotion work needs its own
approval. No post-result rule or metric is changed by this evidence PR.
