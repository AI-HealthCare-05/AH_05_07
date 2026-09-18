# World v2 physical-device review

## Purpose

Desktop Chromium and responsive emulation are not physical-device
qualification.

The World v2 physical-device review therefore runs the actual local SK7
production-path presentation in the browser of a real phone or tablet.

## Isolation

The review server:

- runs only from the developer Mac
- binds to the local LAN
- requires a random session token
- uses synthetic E2E data
- blocks API writes
- substitutes candidate bytes only for the existing registered bear-lite request
- never adds koala, mouse, pig or owl to CompanionSpecies
- does not publish candidate assets
- does not alter R2, Cloudflare or deployment

The build and review evidence stay outside the repository.

## Matrix per physical device

Each physical device completes 12 cases:

- koala: S01, S02, S10
- mouse: S01, S02, S10
- pig: S01, S02, S10
- owl: S01, S02, S10

Only the World v2 lite binaries are used because the current S01/S02/S10
production contracts select lite assets.

## PASS capture

When the reviewer presses PASS, the local evidence log records:

- physical device class
- candidate species
- screen
- actual CSS viewport
- device pixel ratio
- renderer-ready state
- registered GLB request count
- horizontal-overflow state
- WebGL renderer identity when exposed
- short requestAnimationFrame diagnostic sample

Frame timing is diagnostic only.

It is not a universal device-performance threshold.

## Device classes

The harness supports independent evidence for:

- Android
- iPhone
- iPad

A device class is qualified only after all 12 cases have an explicit PASS.

Evidence for one device class must not be used to claim qualification of a
different physical device class.

## Human criteria

Before pressing PASS, confirm:

- the correct candidate is visible
- no obvious clipping or broken geometry
- the canvas/scene is stable
- text and controls remain usable
- no horizontal layout overflow is visible
- S10 interaction/attention does not visibly break the character
- scrolling and touch remain responsive

Use FAIL if the physical device exposes a problem even when the page reports
renderer ready.

## Production boundary

Physical-device PASS is still not production activation.

Candidate delivery, active registry promotion and release remain separate gates.

## Visible-subject hardening

The first Android review attempt exposed a harness gap: an S10 case could reach
the technical renderer-ready/request-count conditions while the human reviewer
did not actually see the candidate character.

That attempt is not qualification evidence.

The hardened review now requires all PASS events to satisfy:

- renderer ready
- exactly one candidate-substituted registered GLB request
- no horizontal overflow
- review canvas visibly intersects the physical viewport
- review target visibly intersects the physical viewport
- candidate subject bounds intersect the normalized scene view
- non-trivial projected subject width and height
- explicit human confirmation that the character is actually visible

The harness automatically scrolls the S01 narrator or S02/S10 visual stage into
the physical viewport.

PASS remains disabled until the automatic visibility checks pass and the human
reviewer checks **캐릭터가 실제 화면에 보입니다**.

If the character is absent, clipped beyond recognition, or otherwise not
visually present, the reviewer must use FAIL even if the renderer itself is
technically ready.
