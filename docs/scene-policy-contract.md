# Scene policy contract

## Input firewall

Allow screen ID, validated Seoul calendar presentation, viewport profile,
reduced motion/visual disable, visibility, approved recipe, non-medical
companion preference, and quality capability only. Do not accept a domain
object or spread an API response into visual props.

Reject BP values/deltas, systolic/diastolic, model inputs/continuous
output/probability/category/result/readiness, challenge
identity/start/end/selection/success rate/completed/skipped, missing-record
flags, health improvement, account/session/record identifiers.

Semantic UI may truthfully change CTA, selected state, Model V2 text/value
presentation, and copy from domain facts. Those facts must not affect character
pose, position, route, lighting, environment density, mood, or species
selection. Record navigation does not move a character in time.

## Companion identity firewall

S01 narrator, S02 scene identity, and the S10 unified review-scene candidate
may use only the saved 11-species `sk7-companion-species` preference.
Production S10 continues to receive the same non-medical preference through its
existing separate host boundary; invalid or absent preference falls back to the
approved bear profile. Query parameters, BP, Model V2 input/output, challenge
facts, record coverage, or health semantics must never choose either review or
production species.

When the S10 scene is active in review or in an explicitly authorized
exact-production Journey host, it is the single decorative character owner:
the separate companion renderer is suppressed, the registered lite identity is
bound directly to the scene, and day-focus receives only the selected control's
screen coordinates. Exact-production S10 requires that explicit host ownership
bit; legacy/non-Journey callers remain closed so two production character
renderers cannot coexist.

S05 remains a separate confirmed-save exception: its qualified SavedScene uses
the fixed registered bear/lite asset, not the saved species preference. The
anonymous Demo S02 path may reuse the same decorative preference but remains
synthetic/read-only and must not create product data.

## Current scene activation

At the current source baseline, exact `review` keeps the qualified S02/S10
realtime review paths available. Exact `production` authorizes the qualified
S02 realtime scene when Journey presentation is selected and now also authorizes
S10 only when the Journey host explicitly hands ownership to the unified full
scene. In that S10 path the separate production companion is suppressed.
If the scene gate is missing/off, the independently qualified production
companion remains the rollback/fallback behavior.

This describes source capability, not proof of the deployed Cloudflare
scene/UI variables. Runtime deployment identity and control-plane verification
remain owned by [deployment SSOT](deployment-ssot.md).

## S05 exception

The production `resolveProductionCompanion(mode, screen, confirmedSave, species)`
and the SavedScene boundary remain independent. The
[historical S05 review migration](scene-s05-migration.md) introduced a separate
boundary for an App-issued confirmed persistence event; after PR #584 the exact
scene gate may be `review` or `production`. Default/off/unknown values stay
closed.

Only confirmed persistence can produce the fixed registered bear-lite
`celebrate` exactly once then idle; failed/optimistic/unknown/conflict events
cannot. S05 does not consume the saved species preference. Reduced motion skips
action. No health meaning. The SavedScene path implements per-confirmed-event
deduplication across rerender/remount/back/forward/retry/tier changes. Do not
replay missed celebration after visibility or motion preference changes. The
recovery matrix supplements the existing production normal-lifecycle tests;
neither establishes physical-device acceptance.

## Current model UI

Real signed-in S11 uses `ModelV2InputFlow`; synthetic evidence uses
`modelV2ResultState`. The API product projection remains non-numeric. From
2026-09-17 through 2026-10-17 KST only, S11 may additionally render the
already-computed browser-local continuous output as the time-boxed
research/development preview defined by
[the Model V2 product contract](model-v2-product-contract.md).

That temporary value is presentation-only for S11: it is not an API numeric
projection and must not be persisted, logged, converted to a probability/band,
or used to choose any scene, companion species, animation, pose, lighting,
environment, or mood. S11 remains excluded from companion selection.

## Authorization and identity

Exact `off`/`review`/`production` values only; invalid/missing fails closed.
Review is not production approval. Production cannot select arbitrary
assets/species/clips through query parameters. Unknown recipes and unapproved
assets fail to CSS/poster fallback. Existing asset identity and original
provenance remain unchanged.
