# SK7 final holistic UI redesign result

- Starting main SHA: `b109c885d1e9058a2c49c81f2593e711ed5137ff`
- Branch: `ux/final-holistic-redesign`
- Audit: 70 local screenshots across S01–S14, four required viewports, and the corrected 200% layout proxy
- After inventory: [final-holistic-design-after.json](./final-holistic-design-after.json)

## Outcome

The redesign keeps the S01–S14 journey and existing data/API contracts intact while making the shell, task hierarchy, record browsing, and responsive behavior feel like one product.

P0 results:

- Mobile navigation/content collision: resolved. On 320px and 390px the primary nav remains persistently reachable as a fixed bottom navigation while its measured height, safe area, and clearance are reserved in layout, preventing content collision.
- 200% layout proxy navigation readability: pass. Short labels remain horizontal, readable, and contained; full labels remain available through `aria-label`.
- S10: reduced from 8 audited panel/card surfaces to 5. Mobile height is 1795px at both 390px and 320px; corrected proxy remains 1531px, with no meaningful height regression.

## Screen grades after

| Screen | Before | After | Notes |
| --- | --- | --- | --- |
| S01 | A | A | Single-task login gate retained; copy tightened. |
| S02 | B | A | Lead action plus lighter secondary rows. |
| S03 | B | A | Compact choices and reduced repeated instruction. |
| S04 | B | A | Shorter intro and clearer field rhythm. |
| S05 | A | A | Save confirmation remains primary; bear-lite slot remains decorative. |
| S06 | B | A | Selected action, period, and today state compressed. |
| S07 | B | A | Today fact lead receives stronger hierarchy. |
| S08 | B | A | Compact utility row and grouped record list. |
| S09 | A | A | Detail contract and safe delete flow retained. |
| S10 | C | B | Compact period header, summary, optional challenge section, grouped list. |
| S11 | B | B | Visual density reduced; model semantics and readiness copy unchanged. |
| S12 | A | A | Empty-state contract retained. |
| S13 | A | A | Error/retry contract retained. |
| S14 | B | A | Settings/help changed to a lighter divider list. |

## Design changes

- Desktop/tablet navigation keeps the current redesign. On mobile, the primary nav is fixed to the viewport bottom with short labels, full `aria-label` names, and a CSS-variable height plus `env(safe-area-inset-bottom)` reserved in the shell and scroll padding.
- S02 now leads with one state-derived next action, followed by the two remaining conceptual destinations (`blood-pressure`, `challenge`, `today-detail`) so lead and secondary navigation cannot duplicate a destination.
- S02 secondary copy matches its destination: `혈압 관찰` opens S04, `오늘 상세` opens S07, and `7일 챌린지` opens the approved challenge destination for the current state.
- S10 keeps blood pressure observation, challenge check-ins, legacy records, the selected seven-day window, and active challenge period as separate facts. It now uses one compact summary, an optional challenge section, and one grouped record list.
- S08 shares the grouped-record visual language with S10 while keeping browsing/detail access as its primary purpose.
- Rounded bordered surfaces were reduced in favor of spacing, dividers, tint, and typography. S14 no longer presents four equal cards.
- H1 programmatic focus remains enabled for orientation but uses a quiet dotted ring and underline; interactive controls retain the strong focus-visible ring.
- Korean copy was tightened in the login, home, challenge selection, blood-pressure intro, challenge state, recap, and settings/help surfaces. S11 semantic copy was not changed.

## QA and boundaries

- `npm run build`: passed.
- Browser contract E2E includes 320px/390px fixed-nav reachability, bottom-clearance checks, mid-page S10 navigation, and the three-state S02 destination matrix.
- Browser contract E2E: 54 passed; production fixture boundary: 1 passed.
- New responsive E2E: mobile nav collision and 200% label geometry passed.
- New S05 companion reserved-slot E2E passed at 1366px, 390px, and 320px in review mode.
- `git diff --check`: passed.
- Screenshots rendered: 70, local only.
- Runtime behavior changes: presentation-only navigation placement, surface hierarchy, responsive spacing, focus styling, and Korean copy; no request, state, validation, persistence, or deletion-flow behavior changed.
- S11/model semantic changes: 0.
- Model/research changes: 0.
- API/DB/deploy changes: 0.
- Companion production policy changes: 0.

Remaining P1/P2 follow-ups are visual polish items only: consider further shortening the longest S10/S14 captions and recheck muted-text contrast if the palette changes.
