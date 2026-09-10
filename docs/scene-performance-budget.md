# Scene performance budget
All budgets are candidates until measurements pass. Decimal KB: 1 KB = 1000 bytes.
- Initial non-3D route: renderer/GLB/decoder bytes 0.
- First cold 3D activation: <=900000 additional encoded response-body bytes target; <=1200000 mobile ceiling.
- Count renderer, loaders, WASM/decoders, GLB, environment, textures and activation-only fallback/layers; report actual transfer separately.
- DPR default 1.25; 1.5 only after measurement. Dynamic shadows and postprocessing off.
- At most one active renderer, one mobile character and one focal mobile landmark.
- Demand-render neutral scene. Offscreen/hidden stationary scene persistent RAF=0.
- Active-motion candidate: stable 30fps mobile. Geometry/draw-call/peak-memory budgets remain unmeasured until forensics and real devices.
- Preserve semantic response and layout. Scene failure cannot delay task usability.

## Recorded starting point
bear-lite 518636 bytes; bear-standard 1032708 bytes. Historical renderer gzip 161318 bytes, not a current deployment measurement. Lite plus historical renderer =679954, leaving 220046 to the 900000 target. Standard leaves effectively no environment allowance at the mobile ceiling. No automatic lite->standard double download.

## Measurements
Record cold/warm separately: exact source/build, viewport/DPR, browser/OS/device, cache state/network, compressed payload, decoding/main-thread work, shader/upload time, draw calls, peak residency, frame intervals, route disposal. Unobservable cross-origin Resource Timing fields are UNKNOWN, not zero. Browser traces/headers can substantiate network bytes without changing CORS.
KTX2/Meshopt experiments count decoder overhead and validate external dependencies. Retain immutable originals; derivative gets new hash/revision. No benefit claimed until tested. See scene-glb-forensics evidence for structure, not runtime FPS.
