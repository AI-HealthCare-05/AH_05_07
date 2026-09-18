# Companion candidate SK7 screen integration review

## Purpose

The isolated character-preview browser qualification proves that a candidate
GLB can load and animate in Three.js.

It does not prove that the same geometry fits the actual SK7 product surfaces.

This review adds a second, still non-production gate for the World v2 candidate
family.

## Candidate substitution model

The product is built with its normal active runtime contract.

The test does not add koala, mouse, pig or owl to CompanionSpecies.

The test does not alter the active companion manifest.

Instead, Playwright intercepts the single registered bear-lite GLB request and
returns the exact locally verified candidate bytes for one case.

The product therefore executes its normal layout, renderer, scene ownership,
framing and interaction path while the reviewed geometry is substituted only
at the network-response boundary.

This mechanism exists only in the E2E test process.

## Production-path environment

The integration review runs with:

- UI mode: journey
- scene mode: production
- companion mode: production
- synthetic E2E session and API facts
- local Vite production preview
- port 4173 only

The runner refuses to continue if port 4173 is already occupied.

It does not kill the occupying process.

It does not select an alternate port.

## Screen matrix

Current production contracts use lite companion assets on the affected screens.

Therefore the actual screen integration matrix uses the four World v2 lite
candidates:

- koala
- mouse
- pig
- owl

Screens:

- S01 login narrator
- S02 production realtime scene
- S10 production realtime scene

Viewports:

- 1366 by 768
- 390 by 844
- 320 by 844

Total cases:

- 4 species
- 3 screens
- 3 viewports
- 36 product-screen cases

The World v2 standard candidates remain covered by the separate isolated
browser technical qualification. They are not artificially treated as current
production-screen selections.

## S01 checks

The S01 case preserves the actual login narrator contract:

- registered bear-lite selection remains the runtime identity
- candidate bytes replace only the GLB response
- login-narrator framing remains active
- decorative interaction remains disabled
- canvas exists and reaches ready state
- slot stays inside its narrator character container
- no horizontal document overflow
- no page error
- exactly one registered GLB request

## S02 checks

The S02 case uses the production realtime scene path.

It verifies:

- living scene reaches ready
- one scene canvas owns the character
- the separate companion renderer is suppressed
- subject bounds remain inside the normalized scene envelope
- canvas remains inside the living visual stage
- no horizontal document overflow
- no page error
- exactly one registered GLB request

## S10 checks

The S10 case uses the production full-scene path.

It verifies the same scene ownership and geometry boundaries as S02 and also
requires the current bounded companion-look controller to remain available.

## Evidence interpretation

A passing 36-case run demonstrates that the candidate lite geometry can pass
the current local production-path SK7 screen/layout contracts under synthetic
E2E data.

It still does not establish:

- final owner art acceptance
- physical Android performance
- physical iPhone or iPad performance
- production delivery publication
- R2 publication
- active manifest promotion
- active registry promotion
- deployed Cloudflare state
- production release approval

The candidates remain Candidate until those separate gates are closed.
