# Observation data lifecycle gate

No observation or challenge event is persisted until this contract is completed.

## Required decisions

- Authentication identity: the stable account identifier used as the record owner.
- Retention: a documented default duration and the rule for expiry.
- Deletion: a user-initiated deletion path that removes observations and challenge events for that identity.
- Export: whether a user can export their own records and the minimal format.
- Access: no cross-user record access; administrative access requires a documented operational need.

## Non-negotiable boundaries

- Do not store free-text health history, diagnosis, medication, treatment, original document, or contact details with these records.
- Do not use records for model retraining or feature inputs without a separate reviewed decision.
- A completed retention decision must be implemented and tested before changing `observation_storage_not_ready` to a write path.
