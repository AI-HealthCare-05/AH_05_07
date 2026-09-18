# Companion candidate browser pre-qualification

## Purpose

The companion candidate pool is intentionally separate from the active SK7
runtime inventory.

A future species or binary must not be added to CompanionSpecies, the active
registry, presentation profiles, runtime URLs or delivery storage merely to
obtain browser technical evidence.

Candidate browser pre-qualification therefore reuses the existing isolated
tools/character-preview viewer.

## Review path

The review path is:

    canonical candidate metadata
      -> audited Master archive
      -> SHA/byte-verified external review copies
      -> isolated local character-preview
      -> two-variant and seven-clip browser checks
      -> viewport, fallback and resource checks
      -> immutable external browser evidence

The bridge uses the viewer's historical label light for a candidate whose
canonical variant is lite.

This is only a review-catalog mapping. It does not rename or alter the GLB.

## Input preparation

prepare_candidate_review.py reads:

- the canonical staging candidate inventory
- a supplied audited archive

For the selected candidate family it verifies:

- candidate identity uniqueness
- candidate binary SHA-256
- declared byte size
- safe relative source paths
- valid GLB v2 container structure
- exactly standard and lite review variants for each species

Prepared GLBs and catalog files are written to a new directory outside the
repository.

The original archive and canonical candidate inventory are not modified.

## Browser runner

verify_candidate_review.cjs validates the prepared candidate review input and
then delegates browser work to the existing character-preview verify.cjs.

The existing verifier remains authoritative for renderer behavior.

The candidate runner additionally verifies that the binary identities observed
by the browser verifier still match the exact candidate SHA-256 identities.

A validate-only mode checks candidate input integrity without starting a
browser.

## Technical PASS scope

For each available species, the existing viewer verifies both variants and all
seven companion clips.

A full candidate technical run includes checks for:

- GLB loading
- seven expected clip names
- standard/lite clip name and duration parity
- animation-time advance
- bone-pose change
- complete animation loop
- pause, stop and play controls
- 1366 by 768 layout
- 390 by 844 layout
- 320 by 844 layout
- horizontal overflow
- keyboard focus and camera controls
- repeated variant-swap resource bounds
- fixed review-ground behavior
- failed GLB fallback
- reduced-motion behavior
- initial reduced-motion no-fetch behavior
- WebGL context-loss fallback
- no-WebGL fallback
- no unexpected external network requests
- unchanged input GLB bytes after the run

The frame samples produced by the viewer are diagnostic browser measurements.

They are not physical-device or production FPS acceptance.

## Isolation boundary

This review path does not modify:

- web/asset-candidates/companion-candidates.v1.json
- CompanionSpecies
- active companion manifest
- active scene registry
- presentation profiles
- runtime URLs
- R2
- Cloudflare
- deployment
- production flags

The review asset root, local Three.js vendor and browser evidence directories
remain outside the repository.

## Interpretation

A PASS means the selected candidate binaries passed the isolated browser
technical checks implemented by the existing character-preview verifier.

A PASS does not mean:

- actual SK7 S01/S02/S10 integration is qualified
- a physical Android device is qualified
- a physical iPhone or iPad is qualified
- final visual or art acceptance is complete
- Blender editable reimport is complete
- immutable production delivery is complete
- the candidate is production-ready

## Promotion gates after pre-qualification

Candidate promotion still requires separate evidence or decisions for:

- owner visual and art acceptance
- actual SK7 S01/S02/S10 integration
- physical Android/iOS qualification
- Blender editable reimport where required
- immutable delivery evidence
- active manifest and registry promotion
- affected scene qualification
- explicit production release

Candidate intake, browser pre-qualification and production promotion remain
separate decisions.
