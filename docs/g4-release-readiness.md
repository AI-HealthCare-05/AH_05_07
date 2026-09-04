# G4 release readiness

G4 is the operational approval stage after G3. This document adds no feature and authorizes no production change.

## Fixed boundaries

- No production deployment, database migration, RLS/Auth/CORS change, environment-variable edit, or credential handling occurs in this documentation-only stage.
- Never record secret values, JWTs, magic-link URLs, real health values, user identifiers, request headers, or production console output.
- The browser uses publishable client configuration only; it never receives a service-role or secret key.
- Measurement, challenge participation, and legacy records remain separate facts without diagnosis, causation, scoring, urgency, reward, or health-outcome language.

## Release gates

1. Read-only: merged G3/main integrity, VPF-1 visual evidence, and browser accessibility evidence.
2. Read-only: configuration key names, public/private classification, Auth redirect/CORS origin inventory, deploy target, immutable commit, and rollback revision.
3. Read-only: signed-in journey, session recovery, RLS ownership-policy, test-account smoke-test, export, incident, and rollback plan.
4. Explicit release approval: target, time, rollback point, dedicated smoke-test account, then and only then any separately scoped production change.

## 2026-09-04 release evidence

Issue [#143](https://github.com/AI-HealthCare-05/AH_05_07/issues/143)
records the operator-reviewed G4 web rollout for release commit
`856606a2a230558887e294e44e8fe99186a542a8`.

| Check | Evidence-backed result |
| --- | --- |
| Production web, API, and CORS smoke | Passed without authentication or product data. |
| Magic-link sign-in and session refresh | Passed through an operator-reviewed browser check. |
| Browser console and expected network activity | No error was reported in the sanitized Issue record. |
| Cloud Run, Supabase migration, and production record write | Not performed in this rollout. |
| Post-release source baseline | PR #145 merged at `61ee356e43eeb4f06120af870c4fc2b9ee5f9d41`; it changes a local pgTAP assertion and requires no runtime deployment. |

The recorded current Worker version is
`38bb08b6-66ca-4933-8cbe-ee857aa4ece7`. The recorded rollback target is only
`38bb08b6`, which is also the prefix of the current version. It is therefore not
accepted as a distinct, immutable rollback identity. Rollback readiness and
rehearsal remain open until a different complete version identifier and a
sanitized rehearsal result are recorded.

This evidence closes the reviewed G4 web rollout only. It does not close the
linked-project RLS checks, automated signed-in browser evidence, representative
production-log review, clean-environment deployment rehearsal, or model release
gate listed in the acceptance plan.
