# Exploratory validation uncertainty runbook

Issue #217 implemented this path through merged PR #218. The separately
approved actual run succeeded at `65ec302886cd6bcf288194ad2e2b6639e6f867a1`.
Issue #219 completed publication via merged PR #220; see
[the execution and verification report](model-uncertainty-evidence.md).
PR #216 merged at `b77f2ce3c81c620dcef4074fca60faaa88a8b5e7`. Its committed
comparison, synthetic Windows/Linux checks and general CI passed. Issue #215
was closed as evidence publication complete, not all model validation complete.
Approved comparison JSON and its original execution commit remain unchanged.

## Method and interpretation

ADR-0005 and `scripts/model/uncertainty_rules.py` freeze a separate CONFIG/digest.
For overall validation and every existing sex/age group: paired unstratified
row sampling with replacement, original n draws each time, exactly 2,000 draws,
NumPy Generator(PCG64), seed 20260901 reset per group. The same sampled row vector
selects labels and both probabilities. No extra draws replace invalid iterations.
Models are not refitted inside bootstrap. Report each model's AUROC, average
precision and Brier point and 95% percentile interval plus HGB-minus-LR point
and interval; `np.quantile([.025,.975], method="linear")` is fixed.

Valid counts are per metric and paired across LR/HGB/difference. Single-class
AUROC/AP draws are invalid, while Brier remains valid. Fewer than 1,900 valid
replicates means null intervals, even when the original point is computable.
At least 20 rows are required: smaller/empty groups expose count and reasons,
null points/intervals and zero attempted replicates. Above the threshold,
attempted=2,000 and valid+invalid=2,000 for each metric; unavailable metrics are
never invented. Nonfinite or out-of-range inputs fail before bootstrap.

This was designed after viewing the original comparison and is exploratory,
pointwise and conditional on fixed fitted predictions. It excludes training
variation, multiple-comparison control, NHANES complex sampling and Korean-user
generalization. Excluding zero is not a promotion, quality or release criterion.
Calibration limitations, older-age discrimination, external/Korean validation
and explicit prospectively designed release criteria remain separate work.
No observed result is used to redefine existing release conditions.

## Future separately approved execution

Use a new clean merged checkout with LF manifest/lock and the unchanged frozen
AI environment. Preserve all previous inputs and output directories. Do not
pre-create the new external work directory or overlap it with the split directory.

```
uv sync --frozen --group ai
uv run --frozen --group ai python scripts/model/validation_uncertainty.py --split-dir <approved-external-splits> --work-dir <new-external-directory>
uv run --frozen --group ai python scripts/ci/verify_model_uncertainty.py --evidence <new-external-directory>/uncertainty-evidence.json
```

Check exit codes; stop on any failure. Preflight checks the original approved
comparison and Gate evidence, train/validation hashes, metadata, feature order,
semantics, fixed environment and clean commit via the existing input validator.
No test file is opened or hashed; only its preexisting metadata digest is compared.
The existing common preprocessor and model factory are shared: fit each model
once on train and keep validation probabilities only in process memory.

Recompute the COMPLETE original reports: overall/subgroup AUROC/AP/Brier,
calibration summaries, counts, unavailable status/reasons and relative decision.
Structure, counts and categorical values must match exactly. All float values
must satisfy abs(new-old) <= 1e-10 + 1e-8*abs(old). On mismatch, abort BEFORE
bootstrap; do not change model settings/tolerance or search for a matching result.
This verifies aggregates, not individual prediction equality with the earlier
run because earlier individual predictions were not retained.

Recheck input provenance, both CONFIG digests, reference evidence and clean
execution commit after bootstrap. The original comparison execution SHA and
canonical JSON digest are separate from the new execution SHA. The shared input
provenance must still match the original. Only a successful aggregate candidate
is written; failures leave local enum stage/reason, never private exception text.
Existing directories are refused; no prior evidence is overwritten. Immutable
inputs remain an operator requirement; stability checks are not an adversarial
filesystem-locking guarantee.

## Evidence contract and verification limits

New schema version 1, status `exploratory_uncertainty_not_promoted`:

- original_comparison_sha256 (canonical JSON) and original_execution_commit;
- new execution_commit and unchanged verified input provenance;
- comparison_config_sha256 and separate uncertainty_config/config digest;
- reproduction passed/scope, all fixed groups with row/attempt counts;
- three metric entries per group, each with LR/HGB/difference point
  status/reason/value and interval status/reason/endpoints/valid-invalid counts;
- test_used=false, release_approved=false.

The recursive verifier checks exact keys, digests/reference linkage, point
alignment/tolerance, difference arithmetic, finite ordered bounded endpoints,
replicate arithmetic and publication suppression. It cannot recalculate
percentiles without predictions/samples and does not certify source provenance.
No private arrays are embedded or stored. Only aggregate candidates can be
reviewed for publication; the human review is still a separate approval.

Synthetic tests independently check sklearn metric agreement including ties,
direct resampling calculation, paired row correspondence, sign reversal, exact
zero differences, seed repeatability, invalid-count thresholds, reference
mismatch stopping, and actual CLI access/write boundaries. These numerical tests
provide prediction-based recalculation evidence on synthetic data only. Existing
committed comparison/Gate verifier jobs stay enabled and never refit actual data.

Per-person predictions, labels, identifiers, bootstrap indices/samples and model
files stay out of files and logs. Fitted objects and prediction arrays exist only
in memory. The approved result is now included as `docs/evidence/model-uncertainty.json`
after user-reviewed publication merged in PR #220; CI verifies aggregates without actual fitting
or bootstrap. Any future actual run still requires separate approval. This
publication performs no actual fit/analysis, calibration, tuning, test evaluation,
serialization, promotion or deployment.
