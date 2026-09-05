# Approved exploratory validation uncertainty evidence

Status: `exploratory_uncertainty_not_promoted`. Publication Issue #219 completed
via PR #220, merged at `64aca180aab940a731c322fcf22693a5ec58d756`; all 14 CI checks passed.
[Approved JSON](evidence/model-uncertainty.json) is copied byte-for-byte from the
reviewed external output. A file-specific -text Git attribute preserves the
approved CRLF bytes across checkouts; manifest/lock LF attributes are unchanged.
Its execution commit remains
`65ec302886cd6bcf288194ad2e2b6639e6f867a1`, not this publication commit.

- Comparison CONFIG: `aed79ee34d52ff2777a1e4412473f80f121c561fa76226f47f8a2a0e0a52cb49`.
- Uncertainty CONFIG: `283ff15107ba98230719ee9f56f5749358f36a288685aaa316575a861d253e6a`.
- Original comparison canonical digest: `d40c4273a297a615cbc15634c573084322541cce6c59638772e588f58fbafeac`.
- Original comparison execution: `668a0d81fb7b477b278dca8319440900bc530dd3`.
- Published file SHA-256: `59843a41746f155d73bd759749f8c1be93ab8ec6b1cebf262b4f8e57bb0ea812`.

## Windows execution report from the preceding chat run

The separately authorized run used Python 3.13.14, uv 0.12.8, scikit-learn 1.8.0,
NumPy 2.4.1, SciPy 1.17.0, pandas 3.0.5, PyArrow 25.0.1, joblib 1.5.3 and
threadpoolctl 3.6.0. Frozen train/validation had 5,560/1,192 rows. The report
records clean execution SHA, LF manifest/lock matching Git blobs, and approved
input provenance. Each model was fitted once using the existing train-only
preprocessing and CONFIG; complete overall/subgroup/calibration reports and the
relative decision reproduced within the fixed tolerance before bootstrap.

Exactly 2,000 paired replicates per nonempty eligible group used seed 20260901,
PCG64 and 95% percentile intervals with linear quantiles under ADR-0005.
Sync, preflight, analysis, separate verifier and postchecks returned exit 0.
Input provenance, reference, both CONFIG digests and execution SHA remained
unchanged. This is a report of that execution, not a new execution in this PR.

## Aggregate results and fixed conclusion

All brackets below are pointwise conditional 95% intervals; differences are HGB-LR.

| Metric | LR point [interval] | HGB point [interval] | Difference [interval] |
| --- | --- | --- | --- |
| AUROC | 0.6730 [0.6422, 0.7034] | 0.6875 [0.6582, 0.7177] | +0.0146 [-0.0065, 0.0357] |
| Average precision | 0.5305 [0.4887, 0.5764] | 0.5933 [0.5479, 0.6385] | +0.0628 [0.0278, 0.0955] |
| Brier | 0.2243 [0.2148, 0.2339] | 0.2193 [0.2086, 0.2297] | -0.0050 [-0.0118, 0.0019] |

탐색적 조건부 분석에서 전체 AP 개선을 뒷받침하나, 전체 AUROC·Brier 차이의
구간은 0을 포함하며 고연령 성능·calibration·외부/한국 사용자 검증·명시적
출시 기준은 미해결.

Age 60-80 code group (80 is top-coded), 392 rows: HGB AUROC is 0.5704
[0.5123, 0.6225], LR 0.5010 [0.4396, 0.5572]; difference +0.0694
[-0.0008, 0.1376]. Its AP difference is +0.1247 [0.0599, 0.1775] and Brier
difference -0.0114 [-0.0235, 0.0007]. Overall averages do not resolve this
limited discrimination, low-bin HGB underprediction, age 18-39 Brier worsening
or age 40-59 AUROC worsening from the original comparison.

Every metric in overall and each nonempty sex/age group has 2,000 valid and zero
invalid replicates. The empty missing-sex group has zero attempted/valid/invalid
replicates and null points/intervals with empty_group. No other interval was
suppressed for fewer than 20 rows or fewer than 1,900 valid replicates.

These are exploratory intervals designed after observing the comparison and
conditional on fixed fitted predictions. They do not include training variation,
control multiple comparisons, account for NHANES complex sampling, establish
Korean-user generalization or supply prospective release criteria. Excluding
zero does not authorize model selection, promotion or release.

## User approval and verifier recheck are different evidence

The user reviewed the external JSON and explicitly approved public aggregate
publication in this chat. This approval is limited to disclosure; it is not
model selection, promotion, release or independent certification of source data.

In this publication turn, the existing verifier was rerun against the actual
execution commit's contract before copying (exit 0). Both CONFIG digests and
the original comparison reference matched, and source/copied bytes matched.
The repository verifier checks recursive keys, CONFIG/reference linkage,
point alignment, arithmetic, finite ordered bounds, counts and suppression.
It does NOT independently recalculate confidence intervals from real predictions,
authenticate source records or establish statistical validity. No such
prediction-based independent recalculation is claimed by this chat or CI.
Windows/Linux committed-uncertainty CI runs this same aggregate verifier only;
existing synthetic numerical tests and other evidence/general checks remain.

## Implementation, execution and publication status

Issue #217 scoped implementation and synthetic CI only. PR #218 merged as the
execution commit above; its Windows/Linux synthetic and general checks passed,
fulfilling those implementation conditions. The later separately approved local
execution succeeded. Issue #219 disclosure is merged via PR #220. Issues #217
and #219 are closed for implementation and disclosure respectively. Neither
closure means all model validation complete. [Release readiness](model-release-readiness.md)
and human decisions are tracked in Issue #221.

The approved comparison/Gate JSON, both CONFIGs, dependencies and lock remain
unchanged. This PR does not retrain, bootstrap, calibrate, tune, read/hash/evaluate
test, serialize models, promote or deploy. No raw data, per-person predictions,
labels, identifiers, fill values, bootstrap samples or full logs are published.
`test_used=false` and `release_approved=false` remain unchanged. Calibration,
older-age performance, external/Korean validation and explicit release criteria
require separate reviewed work; no threshold is chosen to fit these results.
