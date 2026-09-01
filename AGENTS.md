# Repository rules

- Use `입력 기반 위험군 선별 신호`, never diagnosis, treatment, prevention, or causal-improvement language.
- Do not store real clinical records, names, contacts, original documents, or free-text medical histories.
- Keep model output, measured blood pressure, and challenge adherence as separate facts.
- Keep `main` runnable. Use one Issue, one short branch, one PR, and squash merge for substantive changes.
- Do not add an LLM, OCR, Redis, or worker dependency without an ADR and a measured requirement.
- Flag target leakage: BP measurements cannot be predictors when they define the training label.
