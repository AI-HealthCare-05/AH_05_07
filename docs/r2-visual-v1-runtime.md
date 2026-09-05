# SK7 R2 visual v1 runtime boundary

The public R2 release at `https://sk7-assets.gomdory.com/visual/v1/` is a
decorative enhancement to the CSS-first SK7 journey. It does not carry UI
copy, state, controls, or health-record content.

## Runtime allow-list

- Desktop and mobile Calm Clay backgrounds are selected independently by
  viewport.
- The base, saved, locked, empty, and retry characters are tied only to their
  matching semantic scenes (S02, S05, S06, S12, S13).
- Characters use empty alternative text and are hidden when their individual
  image request fails.
- The app uses no whole-screen PNG, utility PNG, idle, focus, or motion asset.

## Failure boundary

An unavailable external image must leave the CSS scene, live HTML wording,
navigation, forms, and save controls usable. The browser test aborts the R2
origin to verify this boundary with synthetic fixture data.

## Delivery baseline

The operator confirmed R2 bucket `sk7-assets-prod`, custom domain
`sk7-assets.gomdory.com`, `visual/v1/`, manifest MIME/CORS/cache policy, and
the cache rule before this runtime binding. CSS remains the fallback; this
document does not treat an image request as a dependency for application
availability.
