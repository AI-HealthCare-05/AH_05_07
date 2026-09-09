# Scene policy contract
## Input firewall
Allow screen ID, validated Seoul calendar presentation, viewport profile, reduced motion/visual disable, visibility, approved recipe and quality capability only. Do not accept a domain object or spread an API response into visual props.
Reject BP values/deltas, systolic/diastolic, model inputs/score/probability/category/result/readiness, challenge identity/start/end/selection/success rate/completed/skipped, missing-record flags, health improvement, account/session/record identifiers.

Semantic UI may truthfully change CTA, selected state and copy from domain facts; these values must not affect Moa pose, position, route, lighting, environment density or mood. Record navigation does not move Moa in time.

## S05 exception
The production `resolveProductionCompanion(mode, screen, confirmedSave)` and boundary remain independent. The [S05 review migration](scene-s05-migration.md) uses a separate boundary only for an App-issued persistence event and `VITE_SK7_SCENE_MODE=review`.
Only confirmed persistence can produce celebrate exactly once then idle; failed/optimistic/unknown/conflict events cannot. Reduced motion skips action. No health meaning. The review migration implements per-confirmed-event deduplication across rerender/remount/back/forward/retry/tier changes. Do not replay missed celebration after visibility or motion preference changes. The new recovery matrix supplements the existing production normal-lifecycle tests; neither establishes physical-device acceptance.

## Current model UI
Real signed-in S11 uses ModelV2InputFlow; synthetic evidence uses modelV2ResultState. Preserve both and numeric-result non-exposure. Even readiness/processed state must not choose a different visual. Character excluded.

## Authorization and identity
Exact off/review/production values only; invalid/missing fails closed. Review is not production approval. Production cannot select arbitrary assets/species/clips through query parameters. Unknown recipes and unapproved assets fail to CSS. Existing asset identity and original provenance remain unchanged.
