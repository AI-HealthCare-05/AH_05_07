# SK7 Showcase — Cinema Portal v1

## UX structure

The normal SK7 landing remains the product landing.

A single low-weight Showcase entry appears after the signed-out S01 landing:

`SHOWCASE · Seven days can tell a story. · 01:00 WATCH THE FILM`

It opens a full-screen native `<dialog>` that treats the film as a cinema
experience. A small `DETAILS ↗` link opens `/showcase/`, which holds the longer
evidence / product / companion explanation.

Signed-in product screens do not receive the Showcase entry.

## Benchmark decisions

- Film Secession: take the separation between cinema viewing and museum/detail
  exploration, plus the feeling of watching inside a space.
- Depo Studio: take the compact showreel entry (`Depo Showreel / 00:43 / play`)
  rather than adding another explanatory homepage section.
- Gapsy Studio: take the wide screen as the spatial focus, but not the cost of a
  whole 3D building.
- Brazen/StackNova case study: take the principle that a showreel can carry full
  visual weight while deeper portfolio tracks remain separate destinations.

We do **not** copy the brands, layouts, artwork, or motion. The SK7 implementation
uses its existing Warm Mineral / Living Evidence direction.

## Technical boundaries

This slice intentionally avoids:
- `web/src/App.tsx`
- `web/src/main.tsx`
- `web/vite.config.ts`
- package manifests
- Auth/API/DB/Model V2
- S02 / Companion / Presence Host source

The only shared product entry touched is `web/index.html`, with two additive
same-origin asset tags. The adaptive apply script patches those tags only after
checking that another lane has not already added them.

## Film publication boundary

The Cinema modal now targets the reviewed, content-addressed 60-second public cut:

`https://sk7-companion.gkrry.com/showcase/v1/video/sk7-cinema-public-teaser-v1-60s-ed7e1baa477a.mp4`

Public object verification:

- bytes: `5,791,297`
- SHA-256: `ed7e1baa477a503ce0340f512ad5d1b076900c83ef69e29384a6d6939c783f4b`
- MIME: `video/mp4`
- cache: immutable public asset

The longer 4-minute narrated submission remains in private source/archive storage.
It is intentionally not referenced by the public Cinema runtime.

## Accessibility

- native dialog semantics
- Escape closes
- focus returns to Showcase opener
- video source attaches only after the user explicitly opens Showcase
- reduced-motion removes nonessential motion
- mobile details control moves below the screen instead of staying vertical
