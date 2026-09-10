# SK7 Living Journey Hybrid — local UI candidate

Issue #400 · baseline `5d97f868d955c332205bf22a39afa16889d11c4c` · branch `codex/sk7-journey`.

This is a working **review-only UI candidate**, not a production release or new device acceptance. The exact existing `VITE_SK7_SCENE_MODE=review` gate selects S02/S04/S05 layouts; off/missing/invalid/production keep the original UI and gates. Companion production behavior remains independent.

## Run and inspect

From this worktree:

```sh
npm --prefix web ci
node web/scripts/preview-journey-review.mjs
```

Open <http://127.0.0.1:4177>. The command makes an isolated synthetic build in ignored `web/test-results/living-scene-review/journey-preview`, binds to loopback, serves only GET/HEAD, and freezes approved bear GLBs after byte/hash verification. Media failure leaves existing static/CSS fallbacks. Stop with Ctrl-C; rerun the same command to rebuild/restart. The current process has been opened and operated in the Codex in-app browser.

1. S02: choose **혈압 기록하기**.
2. S04: enter synthetic **120 / 80**, choose **혈압 기록 저장**.
3. S05: verify **기록을 저장했어요**, then choose **오늘의 기록 보기**.
4. Reload the page to reset the tab's mock state. A direct S05 URL cannot manufacture confirmation.

Only the existing synthetic harness is used. A browser-memory response confirms the mock save; no API server or DB persistence was verified. Only this BP journey's mock write is supported in the manual preview. Other destinations remain reachable; their mutation/session behavior is verified with the existing automated API harness.

## Design and visual scope

- S02: a landscape-led two-column desktop composition, with a separate action and facts column. On mobile the character appears before the main action, with a compact first fold at 320px; tablet widths keep a full-width scene to preserve poster framing. The secondary actions and recent-history strip follow; their state-dependent destinations are unchanged.
- S04: a paper-like input surface beside a quiet landscape; on mobile it becomes a single full-width form with paired BP inputs. The actual form, values, validation, refs, disabled state and callbacks stay in App. A return action reuses navigation without clearing the draft.
- S05: a centered bear in a simple landscape, a static checkmark and clear return actions. Existing confirmed-event ownership, one celebration then idle, reduced-motion skipping, failure latch and lifecycle stay intact. The review camera moves from z=3.4 to z=3.8 solely for ear/headroom framing. No GLB, clip, recipe or renderer lifecycle rewrite.
- CSS is scoped to candidate classes and their containing shell. S03/S06–S14 continue to use the original layout. Shared styles and shell/controller implementations are unchanged.

The S02 stage uses its existing 200/240/360px heights and recipe assets in a new area/order/shape; S05's slot is now centered and enlarged to 160×192 CSS px at default text size. Those composition changes invalidate any claim that earlier physical-device visuals/performance evidence automatically qualifies this candidate.

## Exact before/after captures

All captures are local, synthetic, frozen at **2026-09-11 12:00 Asia/Seoul**, with no same-day BP initially and one synthetic legacy event. S04 shows 120/80; S05 is reached only after a successful mock response. Both sets use the same capture script, review/companion gates and reduced-motion setting, presenting the existing S02 static poster and S05 neutral idle. They are not production screenshots or physical-device evidence. Normal-motion behavior is checked separately by the saved-scene suite.

Each link below is a full-page PNG. A matching `-viewport.png` file records the actual first fold, including fixed navigation. Full-page captures can show the fixed nav across scrolled content; use viewport captures and keyboard navigation to assess visible controls.

| Screen / viewport | Before, baseline | After, candidate |
|---|---|---|
| S02 · 320x568 | [Before](before/S02-320x568.png) | [After](after/S02-320x568.png) |
| S02 · 390x844 | [Before](before/S02-390x844.png) | [After](after/S02-390x844.png) |
| S02 · 1366x768 | [Before](before/S02-1366x768.png) | [After](after/S02-1366x768.png) |
| S04 · 320x568 | [Before](before/S04-320x568.png) | [After](after/S04-320x568.png) |
| S04 · 390x844 | [Before](before/S04-390x844.png) | [After](after/S04-390x844.png) |
| S04 · 1366x768 | [Before](before/S04-1366x768.png) | [After](after/S04-1366x768.png) |
| S05 · 320x568 | [Before](before/S05-320x568.png) | [After](after/S05-320x568.png) |
| S05 · 390x844 | [Before](before/S05-390x844.png) | [After](after/S05-390x844.png) |
| S05 · 1366x768 | [Before](before/S05-1366x768.png) | [After](after/S05-1366x768.png) |

Reproduce candidate screenshots while the local review server is running:

```sh
JOURNEY_URL='http://127.0.0.1:4177/?e2e=signed-in&screen=S02' \
  node web/scripts/capture-journey-review.mjs web/test-results/living-scene-review/journey-captures
```

The before files were captured on the untouched baseline in this worktree before UI edits; don't overwrite them with the candidate. Source hashes and PNG checksums are recorded in `verification.json`.

## Verification and acceptance

The saved-scene suite imports seven additive candidate cases through `journey-candidate.cases.ts`, so existing Browser E2E CI runs them without workflow changes. These assert the primary action above mobile navigation; stable input nodes and focus during typing; actual S02→S04→S05→S02 navigation; all lead/secondary state combinations; preserved date/status markup for midnight synchronization; 200% text and total media failure; and unchanged scenery after a domain-fact change. Existing suites cover save pending/failure/duplicate prevention, stale refresh, empty/loading/error distinctions, hidden/reduced motion, remount/history, session/token/bootstrap/account-removal guards, and context disposal.

See `verification.json` for final commands/results. Existing scene manifests, asset identities and test contracts are reused. Earlier physical Android, Safari/simulator, VoiceOver, GPU/peak-memory/FPS, production network/cache and owner visual evidence are historical only. None is relabeled PASS for this composition. Actual API/DB writes, physical-device/Safari checks, fresh GPU/peak memory/FPS and production-network/cache measurements were not performed. User visual review of this candidate remains pending; #390 qualification and #396 research are separate.

## Protected boundaries

No API/DB/auth/deployment configuration, Model V2 artifact/schema/11-feature/preprocessing/family/parameters, risk-result display, or S11 storage/logging/analytics changes. BP, challenge and model remain separate facts. No new framework, dependency, router, state manager, scene mode or companion activation. Source callbacks, session generation/token guards and saved-event keys are unchanged. CI workflows are unchanged; no expectations were weakened or checks skipped.

Original checkout remains at its original HEAD with its untracked `docs/scene-next-task-handoff.md` untouched; it was checked for existence only. R0 control-plane findings are kept in the local report outside this UI PR. Commit/push/Draft PR are authorized; merge, mirror sync, deployment and production scene activation are excluded.
