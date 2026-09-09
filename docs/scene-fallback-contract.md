# Scene fallback contract
| Tier | Representation | Eligibility |
|---|---|---|
| 3 | High-quality real-time 3D | Approved screen/asset and measured headroom |
| 2 | Optimized real-time 3D | S02/S10 candidates; later S05 parity |
| 1 | Layered 2.5D/poster | Static screens, reduce, unsupported/failed/disabled 3D |
| 0 | Existing CSS + semantic UI | All media unavailable or intentionally disabled |

Tier cannot promote an excluded screen to 3D. Core controls, data meaning, reading order, keyboard, API and recovery behavior are equal in every tier.
Poster stays until first valid frame. Never show two Moas. Image failure removes only image; no toast or automatic retry. Chunk/GLB/decoder/context failure falls back, never routes to S13. Data errors retain existing truthful S13/stale handling even if scene loads.
Offscreen/hidden stop rendering; route exit disconnects listeners, aborts cancellable work and ignores stale completions. Dispose geometries/materials/textures/renderer; shared resources need explicit ownership. Late-loaded models are disposed. No infinite recovery loop. A failed recipe remains downgraded for current visit. No celebration backlog.
S05 current CSS fallback and confirmed-save message/CTA remain untouched before migration. Tier 0 does not manufacture a second confirmation.
