# Seven-day observation and challenge contract

## Separate records

- A risk signal is a versioned model output at one input time.
- A blood-pressure observation is a user-entered morning or evening measurement with its observation time.
- A challenge event is completion or skip of one selected action on one local date.

No record type overwrites another. A changed observation does not update a prior risk signal, and challenge completion is not evidence that blood pressure changed.

## Boundaries

- Store no diagnosis, medication, treatment, free-text medical history, or original clinical document.
- Do not feed observations or challenge events into the screening model.
- Display observations as a seven-day record, not as a treatment outcome or causal claim.
- The service may prompt users to seek appropriate professional care for urgent symptoms; it must not issue a diagnosis or treatment instruction.
