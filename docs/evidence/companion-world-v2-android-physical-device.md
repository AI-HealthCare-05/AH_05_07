# World v2 Android physical-device qualification

## Result

Tested physical Android device: **12 / 12 PASS**

The authoritative result is the hardened V2 review.

The earlier Android V1 attempt was invalidated because its original harness
could accept a technically ready S10 case without requiring the human reviewer
to confirm that the candidate character was actually visible.

## Matrix

The tested Android device passed:

- koala: S01, S02, S10
- mouse: S01, S02, S10
- pig: S01, S02, S10
- owl: S01, S02, S10

Candidate variant: **lite**

Total:

- expected: 12
- completed: 12
- passed: 12
- failed: 0

Source event log SHA-256:

`5808fdf726d433061c6c82c49df620d60b07a9a329d6b53a54f0f9c61f683de3`

## V2 PASS contract

Every PASS required:

- renderer ready
- exactly one candidate-substituted registered GLB request
- no horizontal document overflow
- visible canvas
- review target inside the physical viewport
- non-trivial candidate subject bounds intersecting the scene
- explicit human confirmation that the candidate was actually visible

All 12 authoritative Android events satisfied those requirements.

## Performance interpretation

The recorded frame samples are diagnostic observations from this one tested
physical Android device.

They are not a universal Android performance threshold or certification for all
Android hardware.

The current harness did not record a device model, so the claim is deliberately
limited to **the tested physical Android device**.

## Remaining physical-device gates

Still open:

- physical iPhone qualification
- physical iPad qualification

## Production boundary

Android physical-device PASS is not production activation.

No candidate registry, runtime manifest, R2 object, Cloudflare configuration or
deployment was changed.

The World v2 family remains Candidate pending the remaining device and release
gates.
