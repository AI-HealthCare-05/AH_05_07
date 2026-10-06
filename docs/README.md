# Documentation

Repository workflow is defined only in [AGENTS.md](../AGENTS.md).

- Product and UX: [requirements](requirements.md), [UX flow](ux-flow.md).
- Architecture: [architecture](architecture.md), [invariants](architecture/ARCHITECTURE_INVARIANTS.md).
- API and auth: [API contract](api-contract.md), [auth contract](auth-contract.md).
- Data: [data contract](data-contract.md), [observation lifecycle](observation-data-lifecycle.md), [observation/challenge](observation-challenge-contract.md).
- Model V2: [product contract](model-v2-product-contract.md), [development toolchain](ai-toolchain-ssot.md).
- Visuals: [scene policy](scene-policy-contract.md), [scene architecture](scene-architecture.md), [visual production](visual-production-contract.md), [companion runtime](companion-runtime.md).
- Experimental spaces: [Transcend](transcend/PROGRAM.md), [W1 contract](transcend/W1.md).
- Operations: [deployment](deployment.md), [recovery](architecture/RECOVERY_CONTRACT.md).

Read evidence, research, ADRs and history only for a named need. They are scoped
records, not live task or runtime state. A file's placement directly under `docs/`
does not make it current authority: unindexed execution, closeout and historical
review documents remain supporting records unless the current task or an indexed
current domain contract explicitly names them. Git history is the archive for
deleted historical material.
