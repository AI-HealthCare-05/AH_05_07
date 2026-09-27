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

## Living Choice visit exception (E3)

Only the existing E2 plaza may display one supporting Living Choice marker after
Classic Today offers an explicit handoff of `active_challenge.action_id`.
The disposable `living_choice` URL hint accepts exactly `walk-10-minutes`,
`sleep-routine`, or `low-sodium-meal`; absent, unknown or duplicate hints select
no marker. A forged known hint has cosmetic meaning only, never selection,
completion, storage or identity authority. Leaving for Today drops the hint.
The renderer receives only the allowlisted hint, never API/auth/store access.
One still marker family varies only its motif/accent. It changes no companion,
lighting, destination, pinwheel, movement, or persistence behavior. Check-ins,
streaks, BP, Model V2 and outcomes remain forbidden inputs. This exception does
not apply to S02/S10 calendar scenery or the companion runtime.

## Companion identity firewall

S01 narrator, S02 scene identity, confirmed S05, and the S10 unified scene use
only the saved 11-species `sk7-companion-species` preference. Invalid or absent
preference falls back to the approved bear profile. Query parameters, BP, Model
V2 input/output, challenge facts, record coverage, or health semantics must
never choose either review or production species.

When the S10 scene is active in review or in an explicitly authorized
exact-production Journey host, it is the single decorative character owner:
the separate companion renderer is suppressed, the registered lite identity is
bound directly to the scene, and day-focus receives only the selected control's
screen coordinates. Exact-production S10 requires that explicit host ownership
bit; legacy/non-Journey callers remain closed so two production character
renderers cannot coexist.

S05 remains a confirmed-save exception for animation authority, not identity:
its qualified SavedScene resolves the saved species through active registered
`lite` membership. The isolated `?guest=1` sandbox reuses the same decorative
preference and S02 full-scene/Presence system. An actual guest confirmation may
create an explicit memory-only S05 `celebrate → idle` selection, but it never
creates a SavedScene persistence event. A direct guest S05 URL remains closed.
BP, challenge, and guest-navigation facts still cannot affect visual identity,
pose, position, lighting, or mood.

## Current scene activation

At the current source baseline, exact `review` keeps the qualified S02/S10
realtime review paths available. Exact `production` authorizes the qualified
S02 realtime scene when Journey presentation is selected and now also authorizes
S10 only when the Journey host explicitly hands ownership to the unified full
scene. In that S10 path the separate production companion is suppressed.
If the scene gate is missing/off, the independently qualified production
companion remains the rollback/fallback behavior.

This describes source capability, not proof of the deployed Cloudflare
scene/UI variables. Read runtime identity from live control planes; publication
follows [AGENTS.md](../AGENTS.md) and the [deployment runbook](deployment.md).

## S05 exception

The production `resolveProductionCompanion(mode, screen, confirmedSave, species)`
and the SavedScene boundary remain independent. The
[historical S05 review migration](scene-s05-migration.md) introduced a separate
boundary for an App-issued confirmed persistence event; after PR #584 the exact
scene gate may be `review` or `production`. Default/off/unknown values stay
closed.

Only confirmed persistence can produce the selected active registered lite
identity's `celebrate` exactly once then idle; failed/optimistic/unknown/conflict
events cannot. Query parameters cannot override the saved preference. Reduced
motion skips action. No health meaning. The SavedScene path implements exact
asset/species-safe byte caching and per-confirmed-event
deduplication across rerender/remount/back/forward/retry/tier changes. Do not
replay missed celebration after visibility or motion preference changes. The
recovery matrix supplements the existing production normal-lifecycle tests;
neither establishes physical-device acceptance.

Guest S05 does not use this persistence authority. It can render the same
selected active-lite animation only while an actual in-memory guest confirmation
is active; reload/direct navigation has no event to replay.

## Current model UI

Real signed-in S11 uses `ModelV2InputFlow`; synthetic evidence and the anonymous
fallback use `modelV2SyntheticResultState`, which never controls signed-in
visibility. The API product projection remains non-numeric. S11's default-visible
browser-local research preview, authorized window and automatic expiry follow
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

## My First Keepsake exception (E4)

Within the existing E2 plaza only, explicit keep confirmation converts the E3
candidate to a cosmetic identity: walking → `plaza-ribbon-v1`, sleep routine →
`quiet-moon-v1`, low-sodium meal → `garden-leaf-v1`. The source action and all
completion/health facts remain outside persisted world state. See the
[two-slot data contract](data-contract.md#my-space-cosmetic-snapshot-e4).

One saved keepsake takes precedence over the transient visit marker, using the
same still medallion family and location. Preview can replace/remove it; the
confirmed pinwheel remains a separate slot. The renderer receives only the
projected cosmetic identity, never persistence/Auth/API access. Classic exposes
the same confirmed state and removal when 3D cannot start or loses its context.
Neither saving nor rendering adds motion, audio, particles, rewards or a second
hero. Existing UI Foundry tokens/control/focus grammar serve both slots without
a new component framework.
