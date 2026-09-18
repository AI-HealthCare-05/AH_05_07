# World v2 SK7 screen integration qualification

## Result

Classification: **Candidate**

Local SK7 production-path screen qualification: **PASS**

Production-ready: **No**

The test completed all 36 planned cases:

- species: koala, mouse, pig, owl
- candidate variant: lite
- screens: S01, S02, S10
- viewports: 1366×768, 390×844, 320×844
- completed cases: 36
- passed cases: 36
- failed cases: 0

## Matrix

| Species | Screen | Viewports passed | Result |
| --- | --- | ---: | --- |
| koala | S01 | 3/3 | PASS |
| koala | S02 | 3/3 | PASS |
| koala | S10 | 3/3 | PASS |
| mouse | S01 | 3/3 | PASS |
| mouse | S02 | 3/3 | PASS |
| mouse | S10 | 3/3 | PASS |
| pig | S01 | 3/3 | PASS |
| pig | S02 | 3/3 | PASS |
| pig | S10 | 3/3 | PASS |
| owl | S01 | 3/3 | PASS |
| owl | S02 | 3/3 | PASS |
| owl | S10 | 3/3 | PASS |

## Test model

The application used its normal local production-path runtime contract.

The active selection remained registered bear-lite.

For each case, Playwright intercepted that single registered GLB request and
returned the exact SHA-verified World v2 candidate bytes.

This means the review exercised the actual product layout, scene renderer,
framing and ownership paths without adding the candidate species to the active
registry.

## Screen scope

### S01

The login narrator used the real login-narrator framing contract.

Each candidate:

- reached renderer ready
- remained decorative
- kept interaction disabled
- stayed inside its character container
- produced no horizontal overflow
- used exactly one registered GLB request

### S02

The production realtime scene path loaded each candidate into the current
living-scene renderer.

Each candidate:

- reached living-scene ready
- had one scene canvas
- suppressed the separate companion renderer
- stayed within normalized subject bounds
- stayed within the visual stage
- produced no horizontal overflow
- used exactly one registered GLB request

### S10

The production full-scene path passed the same bounds and ownership checks.

The current bounded head/spine look controller remained available for all four
World candidates.

## Renderer evidence

- 36 cases: `ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (LLVM 10.0.0) (0x0000C0DE)), SwiftShader driver)`

Renderer identity is recorded for environment provenance.

This run is not physical-device performance evidence.

## Important interpretation

This PASS is stronger than isolated GLB playback evidence because the World v2
lite candidates successfully passed the actual local SK7 S01, S02 and S10
production-path presentation contracts.

It still does not activate the candidates.

## Non-claims

This result does not establish:

- physical Android performance
- physical iPhone or iPad performance
- final owner visual acceptance
- final art acceptance
- production R2 delivery
- active manifest promotion
- active registry promotion
- deployed Cloudflare state
- production release approval

## Mutation boundary

The run changed none of:

- companion candidate inventory
- CompanionSpecies
- active companion manifest
- active scene registry
- presentation profiles
- runtime URLs
- R2 objects
- Cloudflare
- deployment

The World v2 family remains **Candidate**.
