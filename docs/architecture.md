# Architecture and ERD

## Decision

React/Vite runs as static assets on a Cloudflare Worker. FastAPI inference runs on Cloud Run Seoul. Supabase Auth/PostgreSQL runs in Seoul. The API image loads an immutable CPU model artifact. Redis, a separate worker, and an LLM remain deferred until a benchmark demonstrates that a batch task violates the request contract.

```mermaid
flowchart TD
    UI["React/Vite · Cloudflare Worker"] --> API["FastAPI · Cloud Run"]
    API --> DB["Supabase · Auth/PostgreSQL"]
    API --> MODEL["Versioned CPU model artifact"]
    TRAIN["Local or Actions training"] --> ARTIFACT["Model card + digest"]
    ARTIFACT --> MODEL
```

```mermaid
erDiagram
    USER ||--o{ RISK_ASSESSMENT : owns
    USER ||--o{ BP_MEASUREMENT : records
    USER ||--o{ CHALLENGE : selects
    CHALLENGE ||--o{ CHALLENGE_CHECKIN : has
    USER ||--o{ RESULT_FEEDBACK : submits
    MODEL_VERSION ||--o{ RISK_ASSESSMENT : produces
```

Persist only structured values required by the contract. No uploaded documents, medication records, free text, contacts, or raw device files. Feedback is review data, not a training label. A later asynchronous job must persist state and result in PostgreSQL; Pub/Sub alone is insufficient.
