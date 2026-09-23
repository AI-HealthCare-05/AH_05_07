# Companion asset platform

## Purpose

The companion system has three intentionally separate views:

1. **Active runtime membership** — the currently qualified 11 species and their
   immutable registered `lite` identities.
2. **Read-only development/review catalog** — immutable published delivery
   metadata and capability status; catalog inclusion is not activation.
3. **Candidate pool** — arbitrary future species, versions, variants and clips
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

## Read-only delivery import and review catalog

`web/scripts/import-companion-r2-inventory.mjs` accepts a supplied JSON export;
it does not list a bucket or call an R2 API. The current deterministic input is
`docs/evidence/companion-r2-v1.json`, optionally joined to
`docs/evidence/scene-glb-forensics.json`. The adapter:

- rejects malformed identities, absent/invalid SHA-256, unsafe or cross-prefix
  object keys, duplicates, non-HTTPS origins, and non-GLB MIME;
- validates exact audit identity plus the seven required clips and reports
  missing clips, required extensions, and external dependencies;
- writes only the deterministic
  `web/asset-candidates/companion-review-catalog.v1.json` review input; and
- has no credentials, mutation, upload, activation, or public LIST path.

`web/src/ui/companionReviewCatalog.ts` is a read-only abstraction over that
generated input. It can enumerate and resolve review-eligible entries, but it
has no operation that writes or satisfies active membership.

## Active registry

`web/src/ui/companionSceneRegistry.ts` is the runtime bridge from the scene
manifest to the current 11-species active set. It cross-checks every registered
scene character and required clip set against the immutable companion delivery
manifest. Product surfaces resolve through `companionActiveAsset.ts` and
`companionAssetResolver.ts`; renderers do not choose from the broad available
inventory.

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
  -> immutable delivery evidence or supplied read-only inventory export
  -> deterministic review catalog
  -> isolated Transcend Lab capability/clip review
  -> explicit active registry decision
  -> affected scene qualification
  -> separate production release decision when required
```

No step is inferred from the previous one. In particular, publishing an object
or adding candidate metadata is not production activation.

The separate `web/transcend-lab` build may select a review-eligible catalog
entry, display species/version/variant/asset identity and capability status,
verify the received bytes/SHA/GLB structure, and play a required clip. Its module
graph admits only the two read-only product seams (membership and review
catalog); it cannot import App, auth/API/model code, write product state, or
change membership.

## Current invariant

The active scene identity set remains exactly the existing 11 species. The
candidate pool and review catalog may grow independently without changing
S01/S02/S05/S10 runtime selection, health/model semantics, or the
source/deployment boundary.
