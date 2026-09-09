# Scene motion contract
## Baseline
New prototype uses neutral static pose and demand rendering. Environment static; no perpetual water/leaves/clouds/camera motion. No look/turn asset is assumed to exist. Existing production S05 one-shot then idle is retained separately. The [S05 review migration](scene-s05-migration.md) plays the same approved celebration once per eligible confirmed event, then samples a static idle frame; interruption consumes the event without replay.

Screen entrances: existing 260–360ms grammar; no navigation, focus or DOM rendering waits for animation. Reduced motion: no character/camera action or continuous RAF; existing short fade at most 160ms. The calendar runtime defaults to Tier 1 for reduced motion. Existing S05 neutral static GLB remains unchanged.

Future idle/rest loops need a separate keyboard-accessible DOM pause control. Pause/reduce/hidden/offscreen/route exit stop mixer and RAF; resume never catches up hidden time. Use bounded elapsed delta, not fixed 1/60 per display frame. Avoid autoplay beyond 5 seconds without a pause/stop/hide mechanism (WCAG 2.2 SC 2.2.2).

## Prohibited
Celebration outside confirmed S05 save, score/risk/participation reactions, anxious/sad/punishing poses, confetti, streak/reward bursts, camera orbit, automatic tours, scroll parallax and data-driven scenery.

## Character Interaction Spike — Phase 9 only
Not implemented. Pointer-up hit test against character proxy only; ignore drag/scroll; no preventDefault on scrolling. Raycast only on pointer events, no hover RAF. Target at least 44x44 CSS px, aligned with visible character. Ignore repeated taps while clip active; 600–1000ms cooldown candidate; no queue. Approved short greet/curious/look candidate -> finished -> idle; bounded timeout/error -> neutral. Save celebration wins; route/hide/reduce/pause interrupts. Separate optional DOM 'Moa에게 인사하기' control for keyboard users; no focusable control inside aria-hidden subtree. No mandatory task depends on character. No health/model meaning or new health telemetry. Cost included in scene budget.
