# World v2 iOS Simulator Safari qualification

This lane executes the World v2 lite companion candidates inside an actual
Xcode iPhone Simulator using Mobile Safari/WebKit and SafariDriver.

The automated matrix contains 12 cases:

- koala: S01, S02, S10
- mouse: S01, S02, S10
- pig: S01, S02, S10
- owl: S01, S02, S10

Each technical PASS requires:

- renderer ready
- exactly one substituted registered GLB request
- visible canvas
- target inside the Simulator viewport
- visible projected candidate subject
- no horizontal document overflow
- S10 look controller available on S10

A SafariDriver screenshot is retained for every case.

This is genuine iOS Simulator Safari/WebKit evidence, not desktop responsive
emulation.

It is not physical-iPhone qualification. It does not establish physical GPU,
thermal, battery, radio/network, hardware-memory, or real-finger touch
behavior.

No candidate activation, R2 mutation, Cloudflare change, or deployment occurs.
