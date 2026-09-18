# World props v2 review

## Classification

The World prop family contains **11 unique GLB binaries**.

All remain **Candidate** assets in a dedicated props lane.

They are not companion candidates and are not added to
`web/asset-candidates/companion-candidates.v1.json`.

Six Frontend factory inputs are byte-identical copies of World props and are
not counted as six additional props.

## Inventory

| Asset | Bytes | Triangles | Primitives | Clips | Frontend duplicate | Review |
| --- | ---: | ---: | ---: | --- | --- | --- |
| `ball` | 34,924 | 1,924 | 3 | nudge | no | candidate |
| `book` | 46,736 | 4,992 | 8 | page-peek | yes | candidate |
| `cushion` | 28,116 | 1,404 | 2 | settle | no | candidate |
| `lamp` | 28,916 | 1,400 | 4 | none | yes | candidate |
| `mug` | 25,708 | 1,272 | 3 | none | yes | candidate |
| `notebook` | 46,544 | 4,368 | 7 | page-peek | yes | candidate |
| `paper-plane` | 3,036 | 5 | 1 | short-glide | yes | art hold |
| `pencil` | 6,108 | 144 | 4 | none | no | candidate |
| `plant` | 83,480 | 5,280 | 18 | leaf-sway | yes | candidate |
| `stool` | 23,232 | 1,504 | 6 | none | no | candidate |
| `table` | 14,944 | 880 | 5 | none | no | candidate |

## Reuse classification

Useful quiet-environment composition candidates include:

- table
- stool
- mug
- plant
- book
- notebook
- lamp
- cushion

Optional decorative candidates include:

- ball
- pencil
- paper plane

The paper plane remains an **art hold** because its fold/direction readability
was weak in the previous bright static review.

That is a visual-review hold, not a binary rejection.

## Duplicate accounting

The Frontend factory's copies of:

- mug
- book
- notebook
- plant
- lamp
- paper plane

are byte-identical source-input copies of the World prop binaries.

Therefore:

- World props = 11 unique assets
- Frontend duplicated inputs = 6 copies
- total unique props = 11, not 17

## Boundary

This lane does not define:

- production prop URLs
- runtime scene assembly
- R2 object identities
- presentation placement
- physical-device performance
- final art approval

Those require a later prop/scene promotion lane.
