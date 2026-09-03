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
