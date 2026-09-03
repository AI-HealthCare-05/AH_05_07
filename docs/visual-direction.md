# SK7 G1 visual direction

## Status and authority

This document records the user-approved G1 direction for the SK7 signature experience. It narrows the visual choices allowed by the [visual production contract](visual-production-contract.md); it does not authorize runtime, dependency, Figma, R2, database, or deployment changes.

The approved desktop composition is attached to [Issue #136](https://github.com/AI-HealthCare-05/AH_05_07/issues/136). User-owned editable and source media remain outside the repository until a later gate approves a delivery format and location.

## Approved reference set

| Reference | Authority | Adopted use |
|---|---|---|
| Selected Moa character image | User-approved appearance reference | Face, palette, matte-clay finish, and calm expression |
| Body-only Moa turnaround | Geometry reference | Head, ear, torso, limb, and foot proportions across orthographic views |
| Moa pose sheet | Motion and staging reference | Readable silhouette and restrained, neutral movement only |
| `합성3.png` | Desktop journey-map master | Landmark order, relative scale, spacing, central negative space, and overall balance |
| Seven isolated landmark PNG files | Source asset set | Independent placement and later responsive or animated composition |

Moodboard and generated references influence tone only. They do not override product, safety, accessibility, privacy, or claim boundaries and do not authorize copying an external product layout.

No G1 Figma frame exists. G2 must create and approve responsive frames before implementation is treated as visually accepted.

## Adopted qualities

The three adopted qualities are:

1. **Calm** — warm neutrals, gentle spacing, soft light, and no alarm-like emphasis.
2. **Tactile** — matte clay, rounded forms, natural wood, pale stone, and restrained surface variation.
3. **Legible** — the current day, primary action, and separate fact types remain clearer than decoration.

## Rejected qualities

The three rejected qualities are:

1. **Clinical alarm** — urgent red states, medical warning symbols, or abnormality styling.
2. **Gamified reward** — streaks, trophies, badges, confetti, punishment, or success/failure scenery.
3. **Generic SaaS** — repeated dashboard cards, excessive pills, glass effects, gradients, or decorative charts.

## Anti-reference

Do not build a streak or reward dashboard in which blood-pressure values, challenge completion, skipped days, or missing observations change Moa's expression, destination, weather, color, route, or celebration state. That pattern combines separate facts and implies an evaluation or outcome that SK7 does not provide.

## Moa character contract

- Moa is a small cream-colored matte-clay bear.
- Preserve the approved head, ear, face, torso, limb, and foot proportions.
- Use sage green for the inner ears, nose, and eyebrows and dark brown for the eyes.
- Keep the expression calm, friendly, and emotionally neutral.
- The body geometry master has no head sprout, tail, bag, strap, prop, sign, text, or decoration.
- The sage crossbody satchel and muted-lavender accent are separate costume assets, not part of the body mesh.
- The rigging reference uses a neutral A-pose with arms visibly separated from the torso and parallel feet.
- Motion, when later approved, must remain slow and restrained and must honor reduced-motion preferences.

## Seven-day journey contract

The approved map is one continuous clockwise journey:

1. Korean garden gate
2. Herb garden
3. Shade tree and resting bench
4. Wooden footbridge
5. Reading shelter
6. Traditional Korean pavilion
7. Sunset overlook

The `1920 × 1080` desktop master preserves:

- one continuous oval pale-stone path;
- a large, uncluttered center for product hierarchy and character staging;
- clear separation among all seven landmarks;
- an orthographic isometric clay-diorama view looking down approximately 35 degrees;
- soft, diffused upper-left lighting and restrained contact shadows; and
- warm cream, sage green, muted lavender, natural light wood, pale stone, soft blue-green water, and a restrained coral sunset accent.

Moa's position may change only with the `Asia/Seoul` calendar day. Blood-pressure observations, challenge selection, check-in status, missing data, and model output must not drive the route or visual mood.

## Responsive composition

- Treat the Issue #136 composite as the desktop visual master, not as a universal responsive bitmap.
- Do not create mobile by cropping or proportionally shrinking the desktop composition.
- G2 must create a dedicated `390 × 844` composition and verify the `320 CSS px` boundary.
- Preserve chronological order and recognizable landmark identity when mobile placement changes.
- Keep today's context, measurement action, challenge action, and seven-day recap in the semantic order defined by the visual production contract.
- Decorative media must not be the only indication of the current day or participation state.

## Enhancement and fallback

Native React, HTML, and CSS remain the baseline. A static poster may support the composition, but core Korean content, authentication, measurement, challenge, history, and recovery actions must remain usable before media loads or when it fails.

Any later GLB, Three.js, React Three Fiber, or layered 2.5D treatment is an optional enhancement. G2 must measure the static baseline first and provide a static fallback for reduced motion, unsupported rendering, load failure, and intentional disablement.

Source PNG files are not approved as the initial page payload. G2 must create measured responsive AVIF or WebP delivery candidates and record each derived file separately before public delivery.

## Provisional visual tokens

These tokens are direction markers, not implementation values. G2 may adjust them after contrast, Korean typography, and fixture review while preserving the approved visual character.

| Token | Provisional value | Use |
|---|---|---|
| Warm canvas | `#F7EBD2` | Diorama background and open space |
| Cream surface | `#F2E8D5` | Clay platforms and quiet surfaces |
| Pale stone | `#DED4BF` | Continuous path and terrace elements |
| Sage | `#A5B59A` | Foliage and Moa accents |
| Deep sage | `#7F927A` | Limited depth and silhouette separation |
| Muted lavender | `#958CA5` | Roof tile and small accent use |
| Natural wood | `#B88759` | Gate, bridge, shelter, railing, and pavilion |
| Blue-green water | `#A7C8C2` | Bridge water only |
| Sunset coral | `#E58468` | Day 7 sun accent only |
| Quiet ink | `#4F473F` | Text candidate subject to contrast validation |
| Form radius | `16–28px` | Rounded panels and media framing |
| Contact shadow | low opacity, short blur | Grounding only; never decoration or status |

## G1 approval record

- Approved by: repository owner `emotigom`
- Approval date: `2026-09-03`
- Evidence: final composite attached to Issue #136
- Gate result: character and journey direction approved; responsive prototype and production implementation remain pending at G2 and G3

## G2 review candidate

The responsive G2 review candidate and its tooling substitution, fixture
matrix, validation results, and remaining approval work are recorded in the
[G2 prototype decision record](g2-prototype.md). The private interactive
prototype is available at
[sk7-g2-prototype.ahnsangkyoon.chatgpt.site](https://sk7-g2-prototype.ahnsangkyoon.chatgpt.site).

The linked Figma exploration is incomplete and reference-only. It is not an
approved G2 artifact. G2 remains open until the repository owner reviews the
desktop and mobile direction, the `320 CSS px` boundary is recorded, and any
required static review exports are attached.
