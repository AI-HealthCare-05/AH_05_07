# World shallow scene v2 review

## Classification

The shallow-scene family contains:

- 3 design families: morning, neutral, evening
- 2 assembly variants per design: baked, shell
- 6 GLB binaries total

The correct count is therefore **3 scene designs / 6 binaries**.

It is not six independent scene designs.

All six binaries remain **Candidate** assets in a dedicated scene lane.

They are not companion candidates.

## Inventory

| Design | Variant | Binary | Bytes | Triangles | Primitives |
| --- | --- | --- | ---: | ---: | ---: |
| `evening` | `shell` | `evening-shell-world-v2-001.glb` | 20,500 | 1,248 | 2 |
| `evening` | `baked` | `evening-world-v2-001.glb` | 173,568 | 9,924 | 7 |
| `morning` | `shell` | `morning-shell-world-v2-001.glb` | 88,908 | 4,992 | 3 |
| `morning` | `baked` | `morning-world-v2-001.glb` | 243,392 | 13,048 | 9 |
| `neutral` | `shell` | `neutral-shell-world-v2-001.glb` | 20,484 | 1,248 | 2 |
| `neutral` | `baked` | `neutral-world-v2-001.glb` | 119,240 | 6,528 | 6 |

## Assembly rule

The baked and shell variants represent alternative assembly strategies.

A later runtime should not blindly render:

`baked scene + shell scene + the same individual props`

at the same time.

That could duplicate geometry and visual objects.

A promotion lane must explicitly choose the intended composition model:

1. baked scene as the assembled environment, or
2. shell plus individually controlled props.

## Current value

The shell form preserves potential reuse of floor/background structure while
allowing individual props to remain separately controlled.

The baked form preserves a compact preassembled scene candidate.

Neither approach is selected for production in this review.

## Remaining gates

- runtime assembly contract
- duplicate-object prevention
- Three.js rendering qualification
- responsive framing
- physical-device cost
- final art acceptance
- immutable delivery evidence
- explicit production decision
