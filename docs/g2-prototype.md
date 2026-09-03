# SK7 G2 prototype decision record

## Status and scope

This document records the approved G2 prototype for
[Issue #138](https://github.com/AI-HealthCare-05/AH_05_07/issues/138). G2
approval does not authorize production React, CSS, asset, API, authentication,
database, or deployment changes.

The prototype uses only synthetic `VPF-1` content with locale `ko-KR`,
timezone `Asia/Seoul`, canonical `as_of`
`2026-09-03T09:00:00+09:00`, and the shared blood-pressure mask
`•••/•• mmHg`.

## Review artifacts

| Artifact | Role | Status |
|---|---|---|
| [Interactive prototype](https://sk7-g2-prototype.ahnsangkyoon.chatgpt.site) | Review the four canonical states at desktop and mobile sizes | Private, G2-approved version 2 |
| Site source commit `7f268f4d625e2a55c02f594e3e765ac4c1d46598` | Immutable source reference for the approved review build | Recorded |
| [Partial Figma file](https://www.figma.com/design/SmDrtp13Oa8LMGs0pw0C52) | Early exploration only | Incomplete; not the G2 deliverable |
| [`합성3.png` on Issue #136](https://github.com/AI-HealthCare-05/AH_05_07/issues/136) | Approved desktop journey-map foundation | G1-approved |

Direct Figma authoring stopped after the available Figma MCP call limit was
reached. The repository owner approved continuing with a private HTML/React
review prototype instead. This is a tooling substitution for G2 review only;
the incomplete Figma file must not be represented as an approved or complete
prototype.

## Canonical review matrix

The prototype exposes exactly these eight state and viewport combinations:

| Fixture | Desktop | Mobile |
|---|---:|---:|
| `VP-04 empty` | `1366 × 768` | `390 × 844` |
| `VP-07a locked-unrecorded` | `1366 × 768` | `390 × 844` |
| `VP-10 recap` | `1366 × 768` | `390 × 844` |
| `VP-11a load-failure` | `1366 × 768` | `390 × 844` |

## Approved decisions

### Information hierarchy

The prototype keeps today's context first, then blood-pressure measurement,
challenge participation, and the seven-day recap. Desktop presents the
measurement and challenge work in distinct lanes. Mobile preserves the same
semantic and focus order without implying a relationship between them.

### Mobile composition

Mobile uses a dedicated vertical composition rather than cropping the desktop
screen. The journey image becomes a compact context region above the actions,
and measurement, challenge, and recap remain separate sections.

### Journey-map placement

The approved G1 desktop master remains the visual foundation. The journey is
subordinate to the current action, and day 3 is identified by Korean text and
structure in addition to the visual marker. Blood-pressure values, challenge
participation, missing data, and load failure do not change Moa, the route,
weather, landmark order, or visual reward state.

### Static fallback

The review build uses a static journey-map image with native HTML controls and
Korean text. Core hierarchy, labels, facts, and recovery actions therefore do
not depend on animation, WebGL, Three.js, or text embedded in the image. The
build disables transitions when `prefers-reduced-motion: reduce` is active.

### Deferred implementation questions

- Responsive AVIF or WebP candidates, public delivery, and asset registration
  remain G3 work.
- Production focus movement, announcements, contrast evidence, 200% zoom,
  browser support, and sanitized golden captures remain G3 implementation
  evidence.
- GLB, Three.js, React Three Fiber, and layered 2.5D remain optional later
  enhancements and require measured need plus a separate decision.
- The incomplete Figma exploration is retained only as a reference. A later
  Figma continuation, if any, must be explicitly approved and versioned.

## Verification performed

| Check | Result |
|---|---|
| Production build | Passed |
| Four fixtures at `1366 × 768` | Reviewed with no internal overflow observed |
| Four fixtures at `390 × 844` | Reviewed with no internal overflow observed |
| Four fixtures at `320 × 844` | No internal overflow, lost semantic region, or lost recovery action observed |
| Desktop primary action height | `48px` |
| Mobile primary action height | `44px` |
| Shared blood-pressure evidence | Masked as `•••/•• mmHg` |
| `VP-11a` truthfulness | Load failure remains distinct from confirmed empty and offers one retry action |
| Reduced-motion fallback | Transition removal is defined for `prefers-reduced-motion: reduce` |

These checks are prototype evidence, not production conformance evidence.
Standalone PNG review exports were waived after the repository owner reviewed
and approved the exact-dimension interactive artifact. No canonical G3 golden
capture is claimed because the screenshot export session did not complete.

## G2 approval record

- Approved by: repository owner `emotigom`
- Approval date: `2026-09-03`
- Approved artifact: private interactive prototype version 2 at source commit
  `7f268f4d625e2a55c02f594e3e765ac4c1d46598`
- Evidence: eight baseline state and viewport combinations plus four
  `320 × 844` boundary checks
- Static export decision: standalone PNG review exports waived for G2; G3
  sanitized golden captures remain required when implementation begins
- Gate result: G2 approved; production implementation remains pending at G3
