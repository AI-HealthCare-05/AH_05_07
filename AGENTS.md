# Repository rules

## Start here

Canonical source: `AI-HealthCare-05/AH_05_07`. Copies in `emotigom/ah-05-07-pages`
are derived deployment snapshots, not a second development or documentation authority.
Read [Fast start](docs/project-handoff.md#fast-start) and the active Issue first;
read further contracts/evidence only for the task's affected boundary. Do not
recursively load historical ledgers or reopen completed audits at every restart.
Keep all rules below. Preserve untracked `docs/scene-next-task-handoff.md`;
do not delete, move, overwrite, clean, reset, or stash it to prepare work.

- Use `입력 기반 위험군 선별 신호`, never diagnosis, treatment, prevention, or causal-improvement language.
- Do not store real clinical records, names, contacts, original documents, or free-text medical histories.
- Keep model output, measured blood pressure, and challenge adherence as separate facts.
- Keep `main` runnable. Use one Issue, one short branch, one PR, and squash merge for substantive changes.
- Do not add an LLM, OCR, Redis, or worker dependency without an ADR and a measured requirement.
- Flag target leakage: BP measurements cannot be predictors when they define the training label.
