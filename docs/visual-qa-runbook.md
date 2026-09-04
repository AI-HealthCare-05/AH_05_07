# SK7 responsive visual QA runbook

## Evidence boundary

Use only the synthetic fixture routes and masked values. Do not capture real names, email addresses, observation values, tokens, request headers, or console logs. This runbook confirms layout and state truthfulness; it does not approve medical interpretation or final art assets.

## Required viewports

| Viewport | Check |
| --- | --- |
| 1366 x 768 | Desktop hierarchy, navigation, no horizontal scroll |
| 390 x 844 | Mobile reading order, fixed navigation, tap targets |
| 320 x 844 | Boundary reflow, no clipped Korean text or overlap |

## Capture matrix

Capture S01, S02, S03, S04, S07, S08, S09, S10, S11, S12, S13, and S14 with synthetic fixtures only. For every capture, confirm that blood-pressure observations, challenge participation, legacy records, and the unavailable **입력 기반 위험군 선별 신호** remain separate facts.

## Manual checks

- Tab through the visible controls: focus is visible and follows reading order.
- Open Records, 7-day recap, signal, and Settings; browser back/forward restores the selected context without claiming a write succeeded.
- Confirm S12 is an empty response and S13 is a retryable load failure, never the same state.
- Enable reduced motion and confirm scene changes remain understandable without travel, ripple, or shared-element movement.
- Mark each candidate Canva layer as `approved`, `replaceable`, or `not used`; do not upload anything to R2 in this issue.

## Result record

Record the tested commit, viewport, fixture, pass/fail result, and a short non-sensitive observation. Attach only sanitized screenshots to the pull request. A failed visual check becomes a separate implementation issue; asset selection starts only after all required rows pass.
