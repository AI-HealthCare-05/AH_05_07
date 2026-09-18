# Asset review lane closeout — 2026-09-18

## Purpose

This record closes the remaining archive-classification work without expanding
production/runtime scope.

## Classification

### Production-ready

No new asset in this closeout is classified Production-ready.

Candidate metadata, archive integrity, static geometry checks and visual
comparison are not sufficient production qualification.

### Candidate

#### Initial companion baseline

- 4 species
- lite / standard
- 8 binaries
- status: Candidate
- disposition: comparison baseline only
- canonical companion intake: hold

The World v2 family remains the prioritized review family for those species.

#### World props

- 11 unique prop binaries
- status: Candidate
- lane: props
- companion candidate inventory: excluded

Six Frontend input files are byte-identical copies and do not increase the
unique prop count.

The paper plane remains an art-review hold, not Rejected.

#### Shallow scenes

- morning
- neutral
- evening
- baked / shell variants
- 3 designs
- 6 binaries
- status: Candidate
- lane: scene
- companion candidate inventory: excluded

### Rejected

No binary is newly classified Rejected by this closeout.

A binary is not rejected merely because production qualification is incomplete.

### Missing

The following species remain Missing from the audited Master:

- elephant
- fawn/deer
- sheep
- duck
- frog

They are not counted as completed assets or rejected assets.

## Separation rules

Companion candidate metadata, props and scenes remain separate concerns.

Props and scenes must not be copied into
`web/asset-candidates/companion-candidates.v1.json`.

Archive copies must not be counted as new unique assets when their SHA-256 is
identical.

The archived Frontend factory remains QA/source evidence, not current frontend
code SSOT.

## Runtime boundary

This closeout does not modify:

- `CompanionSpecies`
- active companion manifest
- active companion registry
- presentation profiles
- scene registry
- runtime URLs
- R2
- Cloudflare
- deployment
- production flags

## Next promotion work

Companion promotion remains blocked on browser/device/art/delivery evidence.

Props require a dedicated prop registry/delivery decision before runtime use.

Scenes require an explicit baked-versus-shell assembly decision before runtime
use.

The five Missing species require actual source assets before any review lane
can begin.
