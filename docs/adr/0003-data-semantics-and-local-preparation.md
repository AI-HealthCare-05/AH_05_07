# ADR-0003 — Versioned data semantics and local preparation

Status: proposed in the Gate 1B prerequisite change; accepted only after merge.
Predecessor: ADR-0002. Related open operational work: Issue #208.

## Problem and decision

The prior builder classified absent BP as zero, treated questionnaire codes as
ordinary numbers, and used a dtype-based imputer. The API scaffold also mapped
non-equivalent product fields to source questions. Windows operators had no
single versioned entry point and repeated manual runs did not establish evidence.

Adopt preparation semantics version 2 as described in data-feature-semantics.md:
explicit eligibility and BP completeness, reviewed missing codes, categorical
sleep end levels, train-only continuous imputation, explicit missing categories,
manifest-driven splits and one shared scikit-learn preprocessing definition.
The same categories/fill values feed comparison and artifact creation. Remove
the unsafe API mapping and keep an unconditional not-ready response pending a
separate versioned input adapter and model release. Do not change the public DTO.

The operator uses one Python CLI with exit-code-based subprocess checks, immutable
input/checkout checks, external new work paths and two-run digest comparison.
Synthetic XPT integration tests exercise the real reader and CLI. Add bounded
Linux/Windows CI for these tests, with no dataset downloads or evidence uploads.

## Alternatives and effects

- Renaming ALQ111 alone cannot repair mismatched product semantics.
- Excluding every missing questionnaire row needlessly changes the cohort;
  explicit missing categories preserve availability without inventing answers.
- Treating coded survey answers/sleep endpoints as continuous hides their meaning.
- Replacing pandas/scikit-learn or adding a PowerShell runner is unnecessary.
- A complete-case BP pair requirement is stricter than deriving a positive label
  from one available component; the sample-size effect needs actual-data review.
- Shared preprocessing invalidates old raw-array model artifacts. Retrain and
  evaluate after Gate 1B rather than converting old artifacts opportunistically.

## Tools, cost, privacy and operations

Python 3.13.14 and uv.lock are unchanged. pandas 3.0.5, PyArrow 25.0.1,
scikit-learn 1.8.0 and joblib 1.5.3 keep their existing roles and licenses. No new
package/service or license terms are introduced. Two local preparation runs and
a scoped Windows CI job add bounded compute; no paid service is configured.
No survey weighting or population-validity claim is introduced.

All participant-level outputs and source hashes remain outside Git. Only the
existing allowlisted evidence is shareable after human review. Success does not
mark Gate 1B reviewed or train/deploy a model. No production operation is executed.
The app route change would require a separately classified Cloud Run release.
The web, DB and R2 need no deployment for this change.

Rollback: retain old source files and work directories, revert code only, and
keep the public signal unavailable. Never re-enable the previous input mapping
or accept old evidence under the new manifest. Future policy changes update the
manifest semantics version, this decision record, tests, and dependent docs.
