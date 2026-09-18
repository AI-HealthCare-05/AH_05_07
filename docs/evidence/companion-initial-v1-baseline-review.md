# Initial companion candidate baseline review

## Decision

The eight `factory004` binaries for `koala`, `mouse`, `pig` and `owl` remain
**Candidate** evidence, but they are intentionally held as comparison
baselines.

They are not Rejected.

They are also not added to the canonical companion candidate inventory in this
lane.

The World v2 family for the same four species is the primary review family,
while these initial binaries remain available for A/B provenance and regression
comparison.

## Identity

- source revision: `factory004`
- species: 4
- variants: lite / standard
- binaries: 8
- classification: Candidate
- disposition: `preserved-comparison-baseline-only`
- canonical intake: hold

| Binary | Bytes | Triangles | Primitives | Clips |
| --- | ---: | ---: | ---: | --- |
| `koala-factory004-lite.glb` | 513,288 | 15,516 | 18 | celebrate, curious, greet, idle, move, rest, special |
| `koala-factory004-standard.glb` | 968,136 | 32,044 | 18 | celebrate, curious, greet, idle, move, rest, special |
| `mouse-factory004-lite.glb` | 579,060 | 18,302 | 23 | celebrate, curious, greet, idle, move, rest, special |
| `mouse-factory004-standard.glb` | 1,061,852 | 35,924 | 23 | celebrate, curious, greet, idle, move, rest, special |
| `owl-factory004-lite.glb` | 648,412 | 19,662 | 18 | celebrate, curious, greet, idle, move, rest, special |
| `owl-factory004-standard.glb` | 1,167,308 | 38,294 | 18 | celebrate, curious, greet, idle, move, rest, special |
| `pig-factory004-lite.glb` | 525,332 | 15,952 | 14 | celebrate, curious, greet, idle, move, rest, special |
| `pig-factory004-standard.glb` | 942,744 | 30,920 | 14 | celebrate, curious, greet, idle, move, rest, special |

## Why the baseline is retained

The World v2 binaries are separate immutable binaries rather than replacements
that erase the earlier factory output.

Retaining the initial family provides:

- byte/SHA provenance for the pre-World state
- A/B reference for World geometry and structure changes
- animation/rig regression reference
- a recovery point for later visual investigation

## Boundary

Baseline retention does not:

- activate these binaries
- add a runtime URL
- publish an R2 object
- add `CompanionSpecies`
- add an active registry entry
- create another production family

A later decision may register them as review metadata if that becomes useful,
but there is no need to duplicate the already-prioritized World family merely
to increase candidate counts.
