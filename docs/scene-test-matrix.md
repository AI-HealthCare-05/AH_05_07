# Scene test matrix
| Boundary | Cases | Pass criterion |
|---|---|---|
| Policy | All S01–S14, unknown gate/recipe | Excluded/no-3D renderer and asset requests 0 |
| Noninterference | Same day/screen; vary BP/model/check-in/status | Same visual selection/position/mood |
| Calendar | Seoul midnight, UTC crossing, Sunday/Monday, leap date | Fixed weekday mapping; DOM/visual date match |
| S05 | before save, confirmed, timeout, unknown, 409, refresh pending | Only confirmed save animates once |
| S05 migration | remount, back/forward, retry, tier/reduce/hidden changes | No duplicate event or GLB refetch |
| Assets | 22 hashes; 11x7 unique clips | Immutable identity and inventory exact |
| Composition | 320x568, 320x844, 390x844, 1366x768 | Large projected subject, no clipping/CTA/nav overlap |
| Accessibility | keyboard, screen reader, 200% zoom, reduce | Every task works without scene; no focus capture |
| Loading | cold/warm, slow, image/chunk/GLB/decoder 404/abort | Budgets measured; semantic UI works |
| Lifecycle | hidden/offscreen, resize, route churn, context loss | No persistent inactive RAF or growing resources |
| Renderer retention | Repeated S02/S10/S05 exits, weak canvas references plus forced GC; physical review/off heap snapshots | Removed canvases are collectible, including lost contexts; native resources distinguished from prototypes |
| Truthfulness | VPF-1 empty/loading/error/stale/conflict/unknown | Distinct semantic states remain |
| S11 | signed-in input flow and synthetic states | No numeric results or visual reactions |
| Browser | Chromium/Firefox/Edge/macOS Safari/iOS Safari/Android Chrome | Browser evidence plus real-device cost |

Retain companion-production/runtime, visual-assets/qa, journey-navigation, model-v2 and session/privacy suites. WebKit automation is not an iOS GPU/memory measurement. Shared evidence uses synthetic fixtures, masked BP and no tokens/identifiers. Passes must name scope; never infer real-device acceptance from unit tests or headless software rendering.
