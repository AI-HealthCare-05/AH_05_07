# SK7 Transcend Phase 3B — S02 spatial review captures

These are local synthetic Chromium screenshots for human comparison only. They
are not production, physical-device, or visual-approval evidence.

- Baseline: `6c5af11cf6d4ec38f44799f771fd40409cf249ab`
- Candidate: this Draft PR worktree
- Fixture: `VP-10`, S02, fixed at `2026-09-11T03:00:00Z`
- Motion: normal (`no-preference`)
- Environment: review scene and review companion modes, synthetic test auth/API
- After state: the semantic `동반자 위치 바꾸기` control was activated once
- Network: each capture observed one request for the same registered
  `bear/v007/lite.glb`; each page contained one scene canvas

| Viewport | Baseline | Candidate after one safe preset |
|---|---|---|
| 390×844 | [Before](before/S02-390x844-viewport.png) | [After](after/S02-390x844-viewport.png) |
| 1366×768 | [Before](before/S02-1366x768-viewport.png) | [After](after/S02-1366x768-viewport.png) |

The paired `capture.json` files record viewport, canvas count, GLB request URL,
and candidate normalized placement. The page and its internal scene viewport
were returned to their top positions before capture so the comparisons use the
same first-fold framing. Human visual review remains pending.
