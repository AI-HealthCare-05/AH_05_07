# ADR-0005 — Exploratory conditional paired bootstrap

Status: proposed under Issue #217; accepted only after user merge. This records
methods before any new actual-data uncertainty result. It extends ADR-0004,
without changing approved comparison evidence, CONFIG, features, preprocessing,
model settings, frozen split or relative comparison conditions. Lock unchanged.

This is exploratory analysis designed AFTER observing the existing validation
comparison. It estimates pointwise uncertainty conditional on fixed fitted
models and validation predictions. It does not cover training variability,
multiple comparisons, NHANES complex sampling/weights or Korean-user transport.
An interval excluding zero cannot authorize promotion or release.

Within overall validation and each existing sex/age group, draw exactly its
original n rows with replacement, 2,000 times. One index vector selects the
label, LR probability and HGB probability together. Use NumPy Generator(PCG64)
seed 20260901, reset to that seed independently for each group; groups are not
joint simultaneous inference. No stratification and no refill/retry of invalid
replicates. Models are never refitted inside bootstrap.

For AUROC, average precision and Brier, report each model's original point
estimate, 2.5%/97.5% percentile endpoints and paired HGB-minus-LR difference
points/endpoints. NumPy quantile method='linear' (Hyndman-Fan type 7) is fixed.
A replicate is valid for a metric only when both model metrics and their
difference are finite. Single-class AUROC/AP are invalid; Brier is computable.
Track metric-specific paired valid/invalid counts. Publish intervals only with
at least 1,900 of the planned 2,000 replicates valid and an available point.
For n<20 suppress points/intervals, record zero attempted draws and an explicit
empty_group/insufficient_rows reason. No rows/predictions/samples are persisted.

A separate uncertainty CONFIG/digest/schema binds approved comparison canonical
JSON digest, original execution commit and new execution commit/input provenance.
Before bootstrap, refit each existing model ONCE using unchanged train-only
preprocessing/configuration. Compare all overall/subgroup metrics, calibration
reports, counts, status/reasons and relative decision with approved JSON. Numeric
metric values must satisfy abs(new-old) <= 1e-10 + 1e-8*abs(old); integer counts,
structure and nonnumeric fields must match exactly. Mismatch aborts without
bootstrap or successful evidence. This aggregate check cannot prove identical
individual predictions; no previous individual predictions were retained.

A strict verifier checks schema, constants/digests/provenance, point alignment,
difference arithmetic, interval bounds/order, replicate arithmetic and disclosure
rules. It does not recompute intervals without private predictions. Synthetic
numerical tests separately compare the bootstrap implementation with direct
prediction-based resampling and sklearn metric oracles. Existing evidence and CI
remain; Windows/Linux CI runs synthetic uncertainty tests only.

Paired resampling preserves within-row model correlation; independent samples
would discard it. Percentile intervals are transparent and bounded in compute;
BCa, stratification or extra valid draws would change this predeclared question.
Using NumPy tie-grouped metric arithmetic avoids repeated estimator fitting and
is tested against locked sklearn AUROC/AP/Brier. Existing dependencies suffice.
Rollback is code-only and preserves prior local outputs; no new service, license
or data retention dependency. Fitted models and predictions live in process
memory only. Actual runs need separate approval after merge. Calibration,
older-age performance, external/Korean validation and explicit release criteria
remain future design work, not thresholds chosen to fit the observed results.
