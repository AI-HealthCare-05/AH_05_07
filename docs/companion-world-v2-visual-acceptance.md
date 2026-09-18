# World v2 human visual acceptance

## Purpose

Automated technical checks cannot make the final visual or art decision for a
companion character.

The World v2 review package therefore preserves the exact browser evidence and
presents it for a separate human decision.

## Evidence package

The package contains 92 PNG review images:

- 36 actual local SK7 screen captures
- 56 isolated browser pose captures

The 36 screen captures cover:

- koala
- mouse
- pig
- owl
- S01
- S02
- S10
- 1366×768
- 390×844
- 320×844

The 56 pose captures cover:

- four species
- lite and standard
- seven companion clips

Every copied screenshot receives an SHA-256 identity in review-manifest.json.

The package also records the exact eight candidate binary identities.

## Human decision fields

Each species receives separate decisions for:

- overall candidate impression
- silhouette/readability
- motion
- S01 screen fit
- S02 screen fit
- S10 screen fit
- notes

Allowed completed values are:

- accept
- hold
- reject

The generated template begins as pending.

A pending template is evidence that review material is ready, not evidence that
the human review was completed.

## Family acceptance

An overall accept-family decision is valid only when every visual field for all
four species is explicitly accept.

A hold or rejection does not delete or overwrite the candidate binary.

The binary remains immutable review evidence.

## Production boundary

Visual acceptance is not production activation.

The visual decision document is required to keep
productionActivationApproved=false.

Even a fully accepted visual family still requires the remaining production
promotion gates, including physical-device qualification, delivery evidence,
active manifest/registry promotion and an explicit release decision.

## Review order

For each species:

1. inspect lite S01/S02/S10 at all three viewports
2. inspect standard and lite pose captures side by side
3. compare all seven clip poses
4. check species silhouette and distinguishing features
5. check framing, floor relationship and visual balance
6. record accept, hold or reject for each field
7. record a short note for any hold or rejection

Do not use browser FPS or technical PASS status as a substitute for visual
judgment.
