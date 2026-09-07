# SK7 visual asset runtime

## Purpose and boundary

The application may consume approved, text-free `visual/v1/` Canva derivatives
as optional decoration. The CSS Calm Clay scene and live semantic HTML remain
the required product surface. Images never carry a state, health meaning,
measurement, challenge result, or **입력 기반 위험군 선별 신호**.

R2 objects are immutable inputs for this runtime. This change does not upload,
move, delete, overwrite, re-compress, or otherwise mutate an R2 object.

## Current v1 compatibility

The catalog in `web/src/ui/r2VisualAssets.ts` gives each asset a logical ID,
current object key and URL, planned v2 key, MIME type, screen scope, role,
decorative/active status, loading priority, and fallback reason. Components use
catalog records and do not know the R2 directory layout.

Current active mapping:

| Logical ID | Screen or scope | Current v1 object | Planned v2 object |
| --- | --- | --- | --- |
| `shared.calmClay.desktop` | Signed-in scenes, desktop source | `visual/v1/backgrounds/sk7-calm-clay-desktop-v01.webp` | `visual/v2/shared/backgrounds/calm-clay/desktop.webp` |
| `shared.calmClay.mobile` | Signed-in scenes, mobile source | `visual/v1/backgrounds/sk7-calm-clay-mobile-v01.webp` | `visual/v2/shared/backgrounds/calm-clay/mobile.webp` |
| `scene.S02.homeBase` | S02 | `visual/v1/characters/sk7-character-base-cream-v01.webp` | `visual/v2/scenes/s02/home-base.webp` |
| `scene.S06.challengeLocked` | S06 | `visual/v1/characters/sk7-character-locked-v01.webp` | `visual/v2/scenes/s06/challenge-locked.webp` |
| `scene.S12.empty` | S12 | `visual/v1/characters/sk7-character-empty-v01.webp` | `visual/v2/scenes/s12/empty-state.webp` |
| `scene.S13.retry` | S13 | `visual/v1/characters/sk7-character-retry-v01.webp` | `visual/v2/scenes/s13/retry-state.webp` |

`scene.S05.saveSuccess` remains registered but inactive. The production S05
bear-lite companion owns the save-success decorative slot, so the 2D saved
asset must not render alongside it.

`resolveSceneVisuals(screen)` is the runtime entry point. It returns the shared
desktop/mobile background pair and the active screen illustration, when one is
allowed. The `SceneVisualAsset` and `SceneVisualBackground` components are
decorative-only: empty alt text, `aria-hidden`, no pointer events, asynchronous
loading, and quiet failure back to the CSS scene.

## v2 directory contract

New runtime derivatives use product semantics rather than Canva/source-centric
folders:

```text
visual/v2/
  shared/
    backgrounds/calm-clay/desktop.webp
    backgrounds/calm-clay/mobile.webp
    identity/app-icon-512.png
    identity/apple-touch-icon-180.png
  scenes/
    s02/home-base.webp
    s05/save-success.webp
    s06/challenge-locked.webp
    s12/empty-state.webp
    s13/retry-state.webp
  manifest/visual-v2.json
```

The catalog URL is switched only after a new, versioned object exists and has
passed the delivery procedure. Existing v1 keys remain retained until an
explicit replacement or deletion decision.

## Fallback and responsive policy

CSS Calm Clay is Tier 0 and remains fully sufficient when every image request
is blocked. Backgrounds are low-opacity, non-interactive layers beneath scene
content; desktop and mobile use their separate sources. Character illustrations
are bounded in reserved, non-interactive zones. S02, S06, S12, and S13
illustrations are suppressed at narrow mobile widths when they could compete
with content or the fixed navigation.

An image load failure hides only that image. It does not retry, toast, replace a
state, clear data, or create a user-facing error. Live headings, state copy,
buttons, forms, and navigation remain independent of image delivery.

## Accessibility and performance

All runtime images are decorative (`alt=""`, `aria-hidden="true"`),
non-draggable, and pointer-inert. Meaningful labels and actions remain HTML.
Images load asynchronously with low priority and do not block the first
interactive path. Absolute reserved zones and fixed aspect-ratio styling avoid
layout shifts; reduced motion does not add image animation.

## Cache and replacement procedure

1. Export the approved Canva/original source locally.
2. Review text-free content, focal point, rights, dimensions, and metadata.
3. Strip nonessential metadata and create a WebP derivative where appropriate.
4. Record dimensions, bytes, MIME, SHA-256, alpha requirements, and review date.
5. Add the asset-register entry and a new versioned R2 object key.
6. Upload the new key without overwriting an existing public object.
7. Verify the public `GET` response and immutable cache policy.
8. Switch only the logical catalog URL.
9. Run blocked-image, reduced-motion, responsive, accessibility, and browser QA.
10. Retain or delete the old version only through an explicit follow-up decision.

Binary assets use versioned immutable cache keys. A manifest is short-lived and
must be revalidated. No runtime code should infer product semantics from an
asset filename, image pixels, or load success.
