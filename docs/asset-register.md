# SK7 asset register

## Scope and status

This register records the user-approved G1 visual source snapshots. None of the entries below is committed as a binary, uploaded to R2, or approved as an unoptimized runtime payload by this documentation change.

The SHA-256 value, byte size, and dimensions identify the reviewed source snapshot. A resized, recompressed, converted, or metadata-scrubbed file is a new derivative and requires its own versioned entry before public delivery.

## Canva selection register — Issue #194

Issue #194 is a read-only source review after the responsive Calm Clay Journey
QA passed at `1366 × 768`, `390 × 844`, and `320 × 844` with reduced motion.
It selects editable Canva sources for a later, separate derivative-delivery
Issue. It does **not** add a binary to this repository, alter Canva, create an
R2 bucket or object, or bind an image into the application.

`approved` below means that the identified editable source is approved as the
starting point for a measured derivative; it is not approval of any exported
byte. `replaceable` is an intentionally optional source that can be changed
without changing product behavior. `not used` means that a source was reviewed
but is explicitly excluded from runtime use. Every exported derivative still
needs its own dimensions, byte size, SHA-256, metadata review, and approving
Issue/PR entry.

### Source authority and non-runtime rule

| Source set | Canva location | Classification | Runtime decision |
|---|---|---|---|
| App identity | [00_Brand / App_Identity](https://www.canva.com/folder/FAHUP9boI5o) | `approved` source set | The existing text SVG favicon remains in use until a separately reviewed icon derivative replaces it. |
| Shared desktop background | [10_Backgrounds / Desktop](https://www.canva.com/folder/FAHUPnJovR8) | `approved` source set | Export only a text-free background layer at its native design size; current CSS landscape is the fallback. |
| Shared mobile background | [10_Backgrounds / Mobile](https://www.canva.com/folder/FAHUPpggvEk) | `approved` source set | Use a separately measured portrait derivative; do not crop or enlarge the desktop export to fit mobile. |
| Character base and poses | [20_Character](https://www.canva.com/folder/FAHUPsoe1YM) | `approved` source set | Decorative only, with semantic HTML retaining all state wording. |
| Character motion references | [20_Character / Motion](https://www.canva.com/folder/FAHUPgYc7Pk) | `replaceable` | Reference for restrained CSS motion only; no autoplay media is approved. |
| Mobile and desktop screen keyframes | [50_Storyboards / 14 Screen Journey](https://www.canva.com/folder/FAHUPr96FZ8) | `not used` | Whole-screen PNGs are review references only. Their baked UI copy and example state must never replace live Korean text, controls, or data. |
| Utility-state images | [50_Storyboards / 04_Utility_States](https://www.canva.com/folder/FAHUP8VsVkY) | `not used` | The app renders loading, sign-in-link, expiry, offline, export, and delete states as accessible HTML/CSS. |

### Selected source candidates

The asset IDs below are Canva source identifiers, not public URLs or R2 keys.
The source dimension and SHA-256 cells intentionally remain `pending export`:
Canva's review listing does not establish the bytes that would be delivered.

| Register ID | Source candidate and Canva asset ID | Role / target | Status | Viewport rule and CSS fallback | Planned derivative path |
|---|---|---|---|---|---|
| `CANVA-ID-001` | `SK7 app icon 512` · `MAHUP7kjh_0` | App icon master | `approved` | Export at native `512 × 512`; never upscale. Fallback: existing `web/public/favicon.svg`. | `visual/v1/identity/sk7-app-icon-512-v01.png` |
| `CANVA-ID-002` | `SK7 Apple touch icon 180` · `MAHUPyj8tPc` | Apple touch icon | `approved` | Export at native `180 × 180`; no CSS substitute is needed until explicit platform binding. | `visual/v1/identity/sk7-apple-touch-icon-180-v01.png` |
| `CANVA-ID-003` | `SK7 favicon 48` · `MAHUPxXL6XY` | Browser favicon candidate | `replaceable` | Native `48 × 48` only; existing SVG remains the fallback. | `visual/v1/identity/sk7-favicon-48-v01.png` |
| `CANVA-BG-001` | `SK7 Calm Clay Journey · 대표 배경` · `DAHUPf9rvoo` | Shared desktop scene layer | `approved` | Desktop-only source; cover/crop only after measured review. Fallback: CSS scene layers. | `visual/v1/backgrounds/sk7-calm-clay-desktop-v01.<webp|avif>` |
| `CANVA-BG-002` | `SK7 Calm Clay Journey · 대표 배경` · `DAHUPljPCy8` | Shared mobile scene layer | `approved` | Mobile-only source; no desktop upscale or forced reuse. Fallback: CSS scene layers. | `visual/v1/backgrounds/sk7-calm-clay-mobile-v01.<webp|avif>` |
| `CANVA-CHAR-001` | `sk7-character-base-cream-v01.png` · `MAHUPsGl3QY` | Neutral decorative character | `approved` | Preserve source aspect ratio and transparent edge quality; hide without loss of meaning. Fallback: no image. | `visual/v1/characters/sk7-character-base-cream-v01.<webp|png>` |
| `CANVA-CHAR-002` | `sk7-character-saved-v01.png` · `MAHUPqpW1LA` | Confirmed-save decorative state | `approved` | S05 only; confirmation text stays live HTML. Fallback: CSS save ripple / no image. | `visual/v1/characters/sk7-character-saved-v01.<webp|png>` |
| `CANVA-CHAR-003` | `sk7-character-empty-v01.png`, `sk7-character-retry-v01.png`, `sk7-character-locked-v01.png` · `MAHUPpTX-fo`, `MAHUPmW52-Y`, `MAHUPoEyTFQ` | Empty, recovery, and action-lock decorations | `approved` | Preserve source aspect ratio. S06/S12/S13 wording and recovery controls remain HTML. Fallback: no image. | `visual/v1/characters/sk7-character-<state>-v01.<webp|png>` |
| `CANVA-CHAR-004` | `sk7-character-idle-v01.png`, `sk7-character-focus-v01.png` · `MAHUPr73PpA`, `MAHUPltCh1o` | Optional neutral / focused decorations | `replaceable` | May be omitted at any viewport or reduced-motion preference. Fallback: no image. | `visual/v1/characters/sk7-character-<pose>-v01.<webp|png>` |
| `CANVA-MOTION-001` | `sk7-motion-ref-idle-breathe-in-v01.png`, `sk7-motion-ref-gentle-blink-v01.png`, `sk7-motion-ref-gentle-wave-v01.png` · `MAHUPlEld1g`, `MAHUPl-wsIQ`, `MAHUPqX8xvg` | Motion reference frames | `replaceable` | Translate only to the existing bounded CSS motion; `prefers-reduced-motion` keeps the 160 ms fade. | No binary path unless a later Issue approves media delivery. |
| `CANVA-REF-001` | `sk7-screen-s01…s05`, `s07…s09`, `s11`, `s14` mobile and desktop PNG keyframes | Screen composition references | `not used` | Do not ship or crop these full-screen captures. They contain UI copy/state examples and cannot be an accessibility fallback. | None. |
| `CANVA-REF-002` | `sk7-utility-u01…u06` PNGs | Utility-state references | `not used` | Do not ship; the live state label, retry, and confirmation controls are semantic HTML/CSS. | None. |

### S01–S14 screen mapping

Each screen remains comprehensible without image delivery. `Reference` means a
Canva full-screen keyframe guides visual QA only; it is not a runtime asset.

| Screen | Runtime candidate after a separate delivery Issue | Reference / source status | CSS fallback now |
|---|---|---|---|
| S01 welcome | `CANVA-BG-001/002`, `CANVA-CHAR-004` optional | S01 mobile/desktop keyframes · `not used` | Gate, copy, and actions remain HTML/CSS. |
| S02 today home | `CANVA-BG-001/002`, `CANVA-CHAR-004` optional | S02 mobile/desktop keyframes · `not used` | CSS landscape and semantic action cards. |
| S03 challenge select | `CANVA-BG-001/002` optional | S03 mobile/desktop keyframes · `not used` | Live selection controls and explanatory copy. |
| S04 BP entry | `CANVA-BG-001/002` optional | S04 mobile/desktop keyframes · `not used` | Live labelled fields, units, and validation. |
| S05 confirmed save | `CANVA-CHAR-002` optional | S05 mobile/desktop keyframes · `not used` | Confirmed-save message and CSS ripple. |
| S06 action locked | `CANVA-CHAR-003` locked pose optional | No whole-screen keyframe registered · no asset required | Live action-lock explanation. |
| S07 today detail | `CANVA-CHAR-004` focus pose optional | S07 mobile/desktop keyframes · `not used` | Separate fact lanes in HTML. |
| S08 records | `CANVA-BG-001/002` optional | S08 mobile/desktop keyframes · `not used` | Semantic record list and filters. |
| S09 record detail | `CANVA-CHAR-004` focus pose optional | S09 mobile/desktop keyframes · `not used` | Detail and edit controls in HTML. |
| S10 seven-day recap | `CANVA-BG-001/002` optional | No whole-screen keyframe registered · no asset required | CSS recap, labels, and separate fact lanes. |
| S11 signal unavailable | No character or data illustration is needed | S11 mobile/desktop keyframes · `not used` | Honest unavailable state; no score or model output. |
| S12 confirmed empty | `CANVA-CHAR-003` empty pose optional | No whole-screen keyframe registered · no asset required | Empty explanation and next actions in HTML. |
| S13 load failure | `CANVA-CHAR-003` retry pose optional | No whole-screen keyframe registered · no asset required | Failure explanation and retry control in HTML. |
| S14 settings/help | `CANVA-BG-001/002` optional | S14 mobile/desktop keyframes · `not used` | Live settings/help navigation. |

### Export, delivery, and cache contract

1. A later, dedicated delivery Issue may export only `approved` candidates.
   It must choose one format per derivative (`AVIF` or `WebP`; `PNG` only where
   alpha or platform behavior requires it), strip nonessential metadata, and
   record width, height, bytes, content type, SHA-256, focal point, and
   `decorative` status in this register.
2. The future bucket is `sk7-assets-prod`; the planned immutable prefixes are
   `visual/v1/backgrounds/`, `visual/v1/characters/`, and
   `visual/v1/identity/`. No bucket, object, or binding exists because of this
   register. A future manifest belongs under `visual/v1/manifests/`.
3. Immutable binaries use `Cache-Control: public, max-age=31536000, immutable`.
   A manifest uses `Cache-Control: public, max-age=300, must-revalidate`.
   Objects are versioned rather than overwritten, and public listing remains
   disabled.
4. No image may contain product UI copy, a person name, email address, health
   value, token, or identifier. The full-screen and utility captures above are
   explicitly excluded for this reason. All released text, state, and controls
   remain selectable semantic HTML.

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
| Delivery rule | Create optimized AVIF or WebP derivatives during G3, remove unnecessary metadata, and register exact delivered bytes before R2 upload |
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

## G3 measured delivery derivatives

The following local application derivatives are metadata-stripped WebP files
made from `MAP-001` for the G3 signed-in journey treatment. They are committed
with the application only; no R2 object or public CDN delivery is implied by
this record.

| ID | Purpose and local path | Source asset | Delivery metadata | SHA-256 | Review / replacement history |
|---|---|---|---|---|---|
| `MAP-002` | Desktop journey image, `web/public/assets/moa-journey-map-v1-desktop.webp` | `MAP-001` | `image/webp`; `1280 × 720`; `34,856` bytes; ImageMagick resize, quality 82, metadata stripped | `9be3641f08386428a0eb44acfd9dd203297376cd21724862bcbf047345adb78e` | Created and reviewed for G3 on `2026-09-03`; local runtime derivative of `MAP-001` |
| `MAP-003` | Mobile journey image, `web/public/assets/moa-journey-map-v1-mobile.webp` | `MAP-001` | `image/webp`; `768 × 432`; `17,994` bytes; ImageMagick resize, quality 80, metadata stripped | `af1d70fb4bffbc165317352987ffe493ca9d63f0e9d73a41d3cb95e51977c558` | Created and reviewed for G3 on `2026-09-03`; local runtime derivative of `MAP-001` |
| `FAV-001` | Local application favicon, `web/public/favicon.svg` | Application utility artwork | `image/svg+xml`; `64 × 64`; inline vector; no embedded metadata | N/A (text SVG tracked with source) | Created for G3 local preview console hygiene on `2026-09-04`; no external source or runtime delivery dependency |

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
