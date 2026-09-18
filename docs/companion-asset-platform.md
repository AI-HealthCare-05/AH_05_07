# Companion asset platform

## Purpose

The companion system has two intentionally separate inventories:

1. **Active runtime set** — the currently qualified 11 species and their immutable
   registered lite/standard delivery identities.
2. **Candidate pool** — arbitrary future species, versions, variants and clips
   staged as review metadata only.

Adding a candidate must never make it selectable, fetchable, or production-active.

## Candidate intake

Future batches are staged in
`web/asset-candidates/companion-candidates.v1.json`.

The candidate schema is deliberately more flexible than the current runtime:
new species keys, variant keys and clip names are allowed. It rejects runtime
activation fields such as URLs, R2 object keys, production flags, screen bindings,
or `active` state. Candidate status is limited to `candidate` or `review`.

`web/scripts/verify-companion-candidates.mjs` validates:

- unique candidate IDs and SHA-256 identities
- bounded positive byte sizes
- safe relative source-review paths
- clip-name uniqueness
- provenance metadata
- absence of runtime activation fields

The normal companion manifest generator validates the candidate file before
regenerating the active manifest, but candidate metadata is **not** an input to
`companionAssetManifest`.

## Active registry

`web/src/ui/companionSceneRegistry.ts` is the runtime bridge from the scene
manifest to the current 11-species active set. It cross-checks every registered
scene character against the immutable companion delivery manifest.

`web/src/ui/companionPresentationProfiles.ts` owns presentation-only scene fit
data. Binary identity and presentation fit are separate concerns, so a future
asset can be reviewed without silently inheriting runtime activation.

The old scene-manifest field name `s02SelectableCharacters` remains a historical
storage detail. Runtime scene recipes no longer depend on that name directly.

## Promotion model

Promotion is intentionally explicit:

```text
new asset bytes
  -> candidate metadata
  -> candidate verifier
  -> visual/runtime review
  -> immutable delivery evidence
  -> active manifest / active registry decision
  -> affected scene qualification
  -> separate production release decision when required
```

No step is inferred from the previous one. In particular, publishing an object
or adding candidate metadata is not production activation.

## Current invariant

The active scene identity set remains exactly the existing 11 species. The
candidate pool may grow independently without changing S01/S02/S10 runtime
selection, health/model semantics, or the source/deployment boundary.
