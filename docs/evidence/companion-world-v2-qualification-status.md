# World v2 companion qualification status

## Current classification

The World v2 koala, mouse, pig and owl families remain **Candidate**.

No World v2 binary is Production-ready yet.

No World v2 binary is Rejected.

## Gates completed

For all eight World v2 binaries:

- audited Master archive identity: PASS
- candidate SHA-256 and byte identity: PASS
- candidate metadata intake: PASS
- provenance metadata: recorded
- isolated Three.js browser technical pre-qualification: PASS
- both variants / seven clips browser playback: PASS
- 1366 / 390 / 320 isolated viewer checks: PASS
- Blender editable reimport/checkpoint reopen: PASS
- human visual/art acceptance: **ACCEPT**

For the four World v2 lite binaries:

- S01 local production-path integration: PASS
- S02 local production-path integration: PASS
- S10 local production-path integration: PASS
- 1366×768 production-path presentation: PASS
- 390×844 production-path presentation: PASS
- 320×844 production-path presentation: PASS
- S02/S10 normalized subject bounds: PASS
- S10 head/spine look-controller availability: PASS
- horizontal overflow: none in the 36-case matrix
- active/runtime mutation during review: none
- tested physical Android device: **12 / 12 PASS**

Supplemental iOS evidence:

- Xcode iPhone Simulator Safari/WebKit: **12 / 12 PASS**
- simulator result is not physical-iPhone qualification

## Evidence now on main

The completed gates are recorded by the merged review series:

- #601 — isolated browser pre-qualification
- #603 — S01/S02/S10 production-path screen qualification
- #604 — Blender editable reimport
- #605 — human visual/art acceptance
- #607 — physical Android qualification
- #609 — iOS Simulator Safari/WebKit qualification

The iOS Simulator evidence explicitly does not claim physical-iPhone
qualification.

## Gates still open

Production promotion remains blocked on:

- physical iPhone qualification
- physical iPad qualification
- immutable production delivery evidence
- explicit active manifest promotion
- explicit active registry promotion
- affected release qualification after promotion
- explicit production release decision

## Standard variants

The World v2 standard binaries passed isolated browser technical qualification
and Blender editable reimport.

They were not forced into S01/S02/S10 or physical-device production-path
qualification because the current production contracts use lite companion
binaries on those surfaces.

This is intentional scope accuracy rather than missing coverage.

## Production boundary

No World v2 species has been added to `CompanionSpecies`.

No active companion binary has been replaced.

No production URL has been created for World v2.

No World v2 R2 object has been created, overwritten or deleted.

No Cloudflare or deployment setting has been changed by these qualification
gates.

The candidate inventory remains review-only and the World v2 family remains
**Candidate**.

The next gate is physical iPhone/iPad qualification. Immutable production
delivery and active manifest/registry promotion must remain separate until those
physical-device gates are resolved.
