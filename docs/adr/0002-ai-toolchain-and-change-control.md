# ADR-0002: freeze the bounded AI toolchain

## Status

Accepted.

## Context

SK7 has a bounded tabular screening task, a public-data manifest, and internal
scripts for leakage control, splitting, comparison, evaluation, and artifact
verification. The dependency declaration nevertheless included unused deep
learning, embedding, and Redis packages while omitting direct declarations for
packages used by the data pipeline. Tool choices recorded only in conversation
can also be lost or silently replaced during later scale-up work.

## Decision

Adopt Python, uv, pandas, PyArrow, scikit-learn, and joblib as the model
development stack. Keep logistic regression as the default baseline and
histogram gradient boosting as the only current candidate. Treat
`docs/ai-toolchain-ssot.md` as the role and change-control authority and
`uv.lock` as the exact version authority.

Remove unused Redis, PyTorch-family, and sentence-transformer dependencies.
Defer tuning, explanation, experiment-registry, drift-monitoring, queue,
LLM/embedding, and OCR tools until a measured requirement and a superseding ADR
exist. Codex Work is an implementation assistant only and cannot supply model
results or promotion evidence.

## Alternatives considered

- Keep every possible library installed for future flexibility. Rejected
  because it obscures the executable architecture, enlarges dependency and
  security review, and permits unreviewed tool drift.
- Adopt a deep-learning or boosted-tree ecosystem immediately. Rejected because
  no frozen comparison demonstrates a need beyond the contracted classical
  baselines.
- Add experiment and monitoring platforms before release. Rejected because no
  model is promoted and no production model SLI, drift threshold, or response
  owner exists yet.
- Record decisions only in Notion or handoff prose. Rejected because those
  records cannot enforce dependency changes in pull requests.

## Consequences

- A clean AI environment has four direct dependencies and reproducible resolved
  versions.
- Existing data and model scripts declare the libraries they actually import.
- Adding or exchanging an AI/data tool requires an Issue, superseding ADR,
  SSOT/lock update, executable evidence, and reviewed pull request.
- CI rejects silent direct-dependency additions, reintroduction of explicitly
  deferred heavy packages, or removal of a contracted pipeline file.
- Model training, promotion, monitoring deployment, and user-facing risk-signal
  release remain separate future gates.
