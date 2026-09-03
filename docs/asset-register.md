# SK7 asset register

## Scope and status

This register records the user-approved G1 visual source snapshots. None of the entries below is committed as a binary, uploaded to R2, or approved as an unoptimized runtime payload by this documentation change.

The SHA-256 value, byte size, and dimensions identify the reviewed source snapshot. A resized, recompressed, converted, or metadata-scrubbed file is a new derivative and requires its own versioned entry before public delivery.

## Common provenance

| Field | Record |
|---|---|
| Owner and creator | Repository owner `emotigom`, who directed generation, selected the results, removed backgrounds, and composed the final map |
| Creation and editing tool | Canva AI image generation and Canva editing/composition tools |
| Ownership basis | User-created project output approved by its creator for SK7 product use under the creator's Canva account terms; no third-party stock source is declared and exclusive copyright is not asserted |
| Creation date | `2026-09-03` |
| G1 review date | `2026-09-03` |
| Current location | User-owned working source; the approved desktop preview is attached to Issue #136 |
| Public/private state | Public candidate, not yet delivered by the application or R2 |
| Retention | Editable Canva sources remain user-controlled; reviewed flat source snapshots are retained outside runtime delivery until superseded or deliberately deleted |
| Delivery rule | Create optimized AVIF or WebP derivatives during G2, remove unnecessary metadata, and register exact delivered bytes before R2 upload |
| Accessibility rule | The composite receives descriptive alternative text when informative; isolated landmarks are decorative when equivalent day names and state are present in semantic HTML |

Canva terms and the ownership basis must be reviewed again before reuse outside SK7 or transfer to a third party.

## Registered source snapshots

Reserved object keys are immutable target names only. Their presence in this register does not claim that an R2 object exists.

| ID | Title and purpose | Canonical source file | Reserved versioned object key | Source metadata | SHA-256 | Source / replacement history |
|---|---|---|---|---|---|---|
| `MAP-001` | Desktop seven-day journey master for the signed-in signature experience | `moa-journey-map-desktop-master.png` | `sk7/visual/moa/v1/moa-journey-map-desktop-master.png` | `image/png`; `1920 × 1080`; `1,744,532` bytes | `2d863031958ba19a4fecdf3c9bcc7c2f8bcee05ee6ea5a2103b62ff860fc2e9b` | Approved [`합성3.png`](https://github.com/user-attachments/assets/5a64f8ba-8a4e-47fc-bdba-5fc9d071ac9e) attached to [Issue #136](https://github.com/AI-HealthCare-05/AH_05_07/issues/136); supersedes unapproved internal composition drafts |
| `LM-001` | Day 1 Korean garden gate landmark | `landmark-01-garden-gate.png` | `sk7/visual/moa/v1/landmark-01-garden-gate.png` | `image/png`; `1024 × 1024`; `317,767` bytes | `cede0c3a39895e49d42551fb128e29bf49848e324f69c29ee7af6e83954c9b9a` | User-owned working source; no public predecessor |
| `LM-002` | Day 2 herb garden landmark | `landmark-02-herb-garden.png` | `sk7/visual/moa/v1/landmark-02-herb-garden.png` | `image/png`; `1024 × 1024`; `638,568` bytes | `cbbb2f4c158728e3ef391a5d561c88fa8acbf242390fb6dce6a5c4ca85441079` | User-owned working source; no public predecessor |
| `LM-003` | Day 3 shade tree and resting bench landmark | `landmark-03-shade-tree.png` | `sk7/visual/moa/v1/landmark-03-shade-tree.png` | `image/png`; `1024 × 1024`; `393,378` bytes | `0ccfecac62185ea22f6d2fdd90a2a2ca82d031d0d20e1d5b276c627ecd8f0713` | Reviewed source filename was `landmark-03-shade-tree2.png`; canonicalizes the approved organic-ground version and supersedes the unapproved no-ground candidate |
| `LM-004` | Day 4 wooden footbridge landmark | `landmark-04-wooden-bridge.png` | `sk7/visual/moa/v1/landmark-04-wooden-bridge.png` | `image/png`; `1024 × 1024`; `504,080` bytes | `ff073450a0a3440b648769c0840cf22772d07f4a503037c936ddaaa36859807f` | User-owned working source; supersedes unapproved generation drafts |
| `LM-005` | Day 5 reading shelter landmark | `landmark-05-reading-shelter.png` | `sk7/visual/moa/v1/landmark-05-reading-shelter.png` | `image/png`; `1024 × 1024`; `484,883` bytes | `480cba3b6718db3328be74eb64ec4d6e6acbc198464878e099601d81c316e17a` | User-owned working source; no public predecessor |
| `LM-006` | Day 6 traditional Korean pavilion landmark | `landmark-06-korean-pavilion.png` | `sk7/visual/moa/v1/landmark-06-korean-pavilion.png` | `image/png`; `1024 × 1024`; `892,098` bytes | `30320bfcf260ef7d52358fb83dd156da9a563f62463c5bb63ba50ee67e0d5a40` | User-owned working source; supersedes unapproved generation drafts |
| `LM-007` | Day 7 sunset overlook landmark | `landmark-07-sunset-overlook.png` | `sk7/visual/moa/v1/landmark-07-sunset-overlook.png` | `image/png`; `1024 × 1024`; `527,881` bytes | `5e0a2cdb6058717ed8ed7425724111398c5846e65455c8f300cddcf6520392b0` | User-owned working source; supersedes unapproved generation drafts |

## Alternative text and semantic use

`MAP-001` candidate alternative text:

> A warm clay diorama with seven Korean garden landmarks arranged clockwise around one oval stone path: a garden gate, herb garden, shade tree and bench, wooden bridge, reading shelter, traditional pavilion, and sunset overlook.

When the map is adjacent to an equivalent seven-day list, it may be marked decorative to avoid repetition. `LM-001` through `LM-007` must use empty alternative text when composited as decoration; the corresponding day name and current state remain in semantic HTML.

## Pre-delivery gate

Before any registered candidate is uploaded or shipped:

1. Produce a responsive delivery derivative rather than publishing the full source set as the initial payload.
2. Remove unnecessary embedded metadata and verify that no name, contact, health record, token, document, or location metadata is present.
3. Record the derivative's new asset ID, immutable object key, SHA-256, MIME type, dimensions, byte size, review date, and source asset ID.
4. Validate visual quality, loading behavior, accessible fallback, cache behavior, and deletion or replacement procedure.
5. Link the approving Issue and pull request before R2 upload.
