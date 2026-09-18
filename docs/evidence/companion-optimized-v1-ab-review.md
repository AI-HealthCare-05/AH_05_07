# Optimized companion candidate A/B review

## Scope

This record preserves candidate-stage A/B evidence for optimized derivatives
of the currently active 11-species SK7 companion family.

This is review evidence only.

It does not replace an active binary and does not establish production
performance improvement.

## Candidate family

- 11 existing companion species
- 2 optimized variants per species
- 22 optimized GLB binaries
- candidate variants: `optimized-lite`, `optimized-standard`
- source revision:
  `sha256:0414073ca69bb741ea1e19368d4d5a716cdc025012712bcff4651eefcc29b774`
- Master archive SHA-256:
  `5f7541e8f48a0f3dd7bf58e0cf6f82d19a25063c38f8c018567bdfb727cebed2`

Species:

`bear`, `rabbit`, `cat`, `dog`, `red_panda`, `otter`, `capybara`,
`hedgehog`, `penguin`, `fox`, `squirrel`.

## A/B findings

The optimized binaries were compared against the existing immutable active
binaries for the matching species, version and source variant.

Observed findings:

- 22/22 optimized pairs retained matching surface data in the diagnostic A/B review.
- 22/22 retained matching rig/skeleton and animation data.
- triangle counts were unchanged between each original/optimized pair.
- GLB primitive total decreased from 608 to 112.
- total bytes decreased from 17,867,184 to 17,522,404.
- the byte reduction is 344,780 bytes, approximately 1.93%.

Primitive reduction and byte reduction are binary/asset-structure observations.

They are not evidence of improved FPS, frame time, browser memory, physical
device performance, or production suitability.

## Reference-budget caution

The archived authoring tooling carried reference triangle values of 13,500 for
lite and 32,000 for standard.

The optimized candidates are not promoted or rejected here based on those
historical reference values.

Those values are not treated as the current runtime acceptance contract.

## Promotion boundary

Before an optimized binary can replace an active production binary, separate
qualification is still required for:

- actual SK7 Three.js/WebGL rendering
- affected S01/S02/S10 scene behavior
- physical Android/iOS performance
- final owner art acceptance
- Blender editable reimport
- immutable delivery evidence
- explicit production promotion

Candidate registration satisfies none of those promotion gates.
