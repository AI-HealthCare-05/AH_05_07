# World v2 iOS Simulator Safari qualification

## Result

Automated Xcode iPhone Simulator Safari/WebKit review: **12 / 12 PASS**

Physical iPhone qualification: **NOT CLAIMED**

The result JSON SHA-256 is:

`c00c29677ba7e59ed4a0de5cbf466aef3cd38b1c1e23fc6840929855944eb90e`

## Environment

- Simulator: iPhone 17
- Runtime: com.apple.CoreSimulator.SimRuntime.iOS-26-5
- Xcode: Xcode 27.0 / Build version 27A266a
- SafariDriver: Included with Safari 26.6.2 (21624.5.1.11.3)
- Safari: 26.5

### Recorded layout viewports

- `402×714 @ 3x`: 12 cases

### WebGL renderer

- `Apple GPU`: 12 cases

## Matrix

All four World v2 lite candidates passed the three reviewed product screens:

- koala: S01, S02, S10
- mouse: S01, S02, S10
- pig: S01, S02, S10
- owl: S01, S02, S10

Total:

- expected: 12
- passed: 12
- failed: 0

Every PASS required:

- renderer ready
- exactly one candidate-substituted registered GLB request
- no horizontal layout overflow
- visible canvas
- review target inside the Simulator viewport
- visible projected candidate subject
- S10 look-controller contract on S10

Twelve SafariDriver screenshots were stored outside the repository. Every
screenshot byte length and SHA-256 matched its machine-evidence record.

## Interpretation

This is execution inside an actual Xcode iPhone Simulator using Mobile
Safari/WebKit. It is stronger evidence than desktop responsive emulation.

It is still **not physical-iPhone qualification**.

The Simulator result does not establish physical-device GPU performance,
thermal behavior, battery use, cellular/Wi-Fi behavior, hardware-memory
pressure, or real-finger touch characteristics.

The physical iPhone gate therefore remains open because no physical iPhone was
available.

## Production boundary

This qualification did not activate the World v2 candidates.

No active companion registry/manifest, R2 object, Cloudflare configuration, or
production deployment was changed.
