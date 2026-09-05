# SK7 Canva derivative staging — Issue #196

## Purpose and boundary

This is the measured derivative-review gate following the source-selection
record in [asset-register.md](asset-register.md). It prepares a local review
package and exact metadata manifest before any delivery decision. It does not
alter Canva, add an application runtime dependency, bind an image in `web/`,
create/upload an R2 object, or require a Cloudflare deployment.

Canva's connected review surface exposes source identifiers and thumbnails but
not a safe original-file export API. A thumbnail is not an approved derivative:
do not download, enlarge, or commit it as a substitute. The source owner
exports the approved editable source manually, then this repository's
dependency-free verifier records the resulting bytes.

The review package is intentionally untracked until a later delivery Issue
approves specific bytes and their placement. This avoids accidentally shipping
an unreviewed export because a local image happened to exist.

## Included sources and required export names

Export only the following `approved` sources from Issue #194. The `replaceable`
favicon, idle/focus poses, motion references, full-screen storyboard PNGs, and
utility-state PNGs remain excluded.

| Register ID | Canva source ID | Local review filename | Format and acceptance rule |
| --- | --- | --- | --- |
| `CANVA-ID-001` | `MAHUP7kjh_0` | `sk7-app-icon-512-v01.png` | PNG, exactly `512 × 512`, maximum 512 KB |
| `CANVA-ID-002` | `MAHUPyj8tPc` | `sk7-apple-touch-icon-180-v01.png` | PNG, exactly `180 × 180`, maximum 256 KB |
| `CANVA-BG-001` | `DAHUPf9rvoo` | `sk7-calm-clay-desktop-v01.webp` | Text-free WebP, at least `1280 × 720`, maximum 1.5 MB |
| `CANVA-BG-002` | `DAHUPljPCy8` | `sk7-calm-clay-mobile-v01.webp` | Text-free WebP, at least `720 × 1280`, maximum 1.2 MB |
| `CANVA-CHAR-001` | `MAHUPsGl3QY` | `sk7-character-base-cream-v01.png` | Text-free RGBA PNG, at least `256 × 256`, maximum 600 KB |
| `CANVA-CHAR-002` | `MAHUPqpW1LA` | `sk7-character-saved-v01.png` | Text-free RGBA PNG, at least `256 × 256`, maximum 600 KB |
| `CANVA-CHAR-003-empty` | `MAHUPpTX-fo` | `sk7-character-empty-v01.png` | Text-free RGBA PNG, at least `256 × 256`, maximum 600 KB |
| `CANVA-CHAR-003-retry` | `MAHUPmW52-Y` | `sk7-character-retry-v01.png` | Text-free RGBA PNG, at least `256 × 256`, maximum 600 KB |
| `CANVA-CHAR-003-locked` | `MAHUPoEyTFQ` | `sk7-character-locked-v01.png` | Text-free RGBA PNG, at least `256 × 256`, maximum 600 KB |

The desktop and mobile backgrounds are different source sets. Do not crop,
stretch, or upscale one to impersonate the other. The character exports must
retain an alpha-capable channel so they can remain optional decoration. No
export may contain Korean UI copy, an example account, a health value, a token,
an email address, or an identifier.

## Local review procedure

1. From each named Canva source, export only its flat derivative with the exact
   filename above. Export a text-free background layer; do not export a screen
   capture or a utility-state frame.
2. Place the nine files in the local, ignored directory
   `asset-review/inbox/v1/` at repository root.
3. Run the deterministic structural and metadata check:

   ```powershell
   python scripts/ci/verify_canva_derivative_staging.py --self-test
   python scripts/ci/verify_canva_derivative_staging.py `
     --assets-dir asset-review/inbox/v1 `
     --write-manifest asset-review/review-v1.json
   ```

4. Open `asset-review/review-v1.json`. For each asset, set these three
   `manual_review` values to `true` only after a sanitized review confirms:
   - `text_free`: the image contains no product UI copy, state wording, values,
     account information, or health information;
   - `viewport_fit`: the desktop/mobile background respects its intended
     viewport and focal point, and each character preserves its aspect ratio;
   - `blocked_image_fallback`: with the image unavailable, existing semantic
     HTML/CSS still communicates every label, status, and action.
5. Re-run the recorded-byte and manual-review check:

   ```powershell
   python scripts/ci/verify_canva_derivative_staging.py `
     --assets-dir asset-review/inbox/v1 `
     --manifest asset-review/review-v1.json `
     --require-manual-review
   ```

`review-v1.json` remains an ignored local review record in this Issue. A later,
separately approved delivery change may deliberately add the exact derivatives
and their manifest only after reviewing the resulting diff and package size.

## What the verifier proves

The verifier checks the exact approved filename set, file signature, MIME,
dimensions, byte budget, SHA-256, alpha-capable PNG requirement, and removable
PNG/WebP metadata chunks. It creates a review-only manifest with the exact
derived bytes. It refuses a manifest that claims a runtime binding or R2 upload.

It cannot decide whether a picture is visually text-free or whether a focal
point is suitable. Those remain explicit human review claims in the manifest;
the later runtime-binding Issue must also attach sanitized viewport evidence.

## Delivery remains separate

No result of this review creates an R2 bucket/object/key, changes cache headers,
or changes a public page. When a later delivery Issue is approved, it must use
the versioned `visual/v1/...` keys already reserved in
[asset-register.md](asset-register.md), retain the stated cache policy, bind
only the reviewed files, and verify the CSS/semantic fallback in the deployed
browser.
