# Model V2 G3 — Repository-safe Split Manifest

Aggregate/provenance information only. No participant identifiers or row-level
validation/final-test outcomes are stored in Git.

## Source

- file: `hn24_all.sas7bdat`
- SHA-256: `ff74cb84432cb1f10ba63d1a3aba54215ef38e47afef29547f83127aea9fc47f`
- split namespace: `SK7-V2-G3-20260907`
- split unit: `kstrata, psu`

## Frozen role counts

| Role | Rows | PSU clusters | Access |
| --- | ---: | ---: | --- |
| development | 4,157 | 134 | G4/G5 |
| validation | 978 | 31 | locked until G6 |
| final internal test | 804 | 27 | locked until explicit G8 approval |

- eligible cohort rows: **5,939**
- assigned PSU clusters: **192 / 192**

Role thresholds are applied to deterministic PSU hashes; row proportions
therefore need not be exactly 70/15/15.

## Safety state

- `participant_ids_in_manifest`: **False**
- `validation_target_distribution_written`: **False**
- `final_test_target_distribution_written`: **False**
- `model_fitting_performed`: **False**
- `performance_metrics_computed`: **False**
- `validation_performance_accessed`: **False**
- `final_test_performance_accessed`: **False**

## Gate state

- model fitting: **not performed**
- validation performance: **not accessed**
- final-test performance: **not accessed**
- production scoring: **disabled**

Participant-level role files remain outside Git.
