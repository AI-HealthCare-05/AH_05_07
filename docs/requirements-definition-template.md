# Requirements definition template

Use this template when proposing or revising an accepted product requirement.
It is a planning aid, not a source that overrides the current
[`requirements.md`](requirements.md), domain contracts, or repository rules.
Do not mark a capability implemented until its merged code and recorded evidence
support that status.

## Change header

| Field | Record |
|---|---|
| Issue / decision | `<issue-or-decision-link>` |
| Owner | `<role-or-team>` |
| Date and source baseline | `<YYYY-MM-DD and main SHA>` |
| Change type | `<new requirement / clarification / status update / removal>` |
| Related contract | `<requirements, API, data, UX, or architecture link>` |

## Requirement

| Field | Record |
|---|---|
| ID | `<FR-xx or NFR-xx>` |
| Priority | `<P0 / P1 / P2>` |
| Status | `<Implemented / API only / Partial / Planned / Scaffold>` |
| Actor or owner | `<user / system / operator>` |
| Contract | `<one observable obligation>` |
| Acceptance | `<testable pass and failure condition>` |
| Evidence | `<test, OpenAPI path, browser result, PR, or deployment record>` |

## Boundaries and exceptions

- **Safety and claim boundary:** `<state the allowed wording and any prohibited
  diagnosis, treatment, prevention, or causal claim>`.
- **Privacy boundary:** `<state the permitted data class; exclude real clinical
  records, names, contacts, free text, credentials, and raw production output>`.
- **Authorization boundary:** `<state caller identity, ownership, and the
  non-disclosing behavior for unauthorized access>`.
- **Failure behavior:** `<state the user-visible recovery and what must not be
  represented as successful>`.
- **Out of scope:** `<state the adjacent capability this change does not add>`.

## Traceability check

| Concern | Required record |
|---|---|
| Product scope | Requirement ID and priority in [`requirements.md`](requirements.md) |
| Executable API | Generated OpenAPI update, or an explicit statement that no route changes |
| Data and ownership | Applicable data/RLS/migration contract, or not applicable |
| UX and accessibility | Affected state and acceptance evidence, or not applicable |
| Operations | Logging, deployment, rollback, and privacy impact, or no runtime change |

## Review decision

- [ ] The status represents current evidence, not an intended future state.
- [ ] Acceptance can pass or fail without real user data.
- [ ] This change does not make the risk signal, blood-pressure observation, or
  challenge adherence imply a diagnosis or causal relationship.
- [ ] The related API and acceptance-test documents agree, or the difference is
  explicitly recorded as planned work.
