# Shared Seoul presentation date

Issue #390 / draft PR #391. This increment implements the calendar follow-up from `scene-next-task-handoff.md` on `codex/living-journey-hybrid`.

## Behavior

- `useSeoulDate` owns one App snapshot. HTML dates, current/prior seven-day bounds and the S02 recipe consume that same value. Weekday selection does not read signup, challenge progress, measurements or model output.
- One timeout targets the next midnight in Asia/Seoul and rearms after firing. Returning to a visible tab or receiving `pageshow` catches up after suspended timers. Repeated same-day events do not request another window. Calendar arithmetic uses UTC fields, independently of the browser timezone and daylight saving time.
- Evidence fixtures keep their fixed `asOf` and install no live-date timer/listeners. Their API behavior remains unchanged.
- Rollover does not navigate, write records, produce a save celebration, or reset a draft. Blood-pressure fields (including the chosen observation date) and the mounted Model V2 form survive a pending or failed refresh. A draft's date is not silently reassigned at midnight; users can edit it before submitting.
- Existing explicit draft resets after confirmed saving, canceling an edit or changing account still apply. Asynchronous save completion, auth subscription and history callbacks use the current presentation date for resets, rather than their initial render's date.

## Request and session boundaries

`presentationRef` is published in a layout effect at commit. If selected bounds change, it invalidates the old window request generation before the passive fetch effect. Success and failure responses from an earlier generation cannot overwrite records, show a load error or expire the current session. Navigating away and back to identical bounds does not make an old generation valid again.

`refreshWindow` reads that committed snapshot and the latest session when invoked. A pre-midnight mutation that completes later therefore requests the currently selected bounds with the current token. It cannot start a fresh request for bounds captured by its old render. The existing account-generation check still runs before and after a mutation's refresh, so a previous account's completion cannot refresh or navigate the next account.

The mutation payload is unchanged: a blood-pressure observation uses its draft date, and a check-in uses the presentation date at submission. A rollover never retries a mutation or changes its submitted date. The existing one-time window retry after token renewal is retained. API/DB/auth/Model V2 contracts and the separate production S05 path remain intact; no dependency or service was added.

## Verification

`web/e2e/seoul-date-rollover.spec.ts` runs in the S02 review build via `playwright.scene.config.ts`, including the existing Browser E2E CI job. All records, tokens and input values are synthetic.

The browser timezone is America/Los_Angeles to distinguish Seoul midnight from the host calendar. Cases cover:

- Sunday → Monday and the following rearmed midnight; matching HTML/recipe snapshots and no implicit save/reward.
- A real WebGL canvas replaced by the next weekday recipe, with one canvas remaining and navigation usable.
- Multi-day timer suspension with simulated visibility recovery and a persisted `pageshow` event; same-day deduplication.
- Year rollover and leap day; deterministic fixture dates.
- Blood-pressure and Model V2 DOM-node identity and draft values through a pending refresh and 503.
- Delayed old-window 200, 401 and 503 responses; prior-window rollover and history traversal back to identical bounds.
- Delayed saving across midnight and same-user token renewal, with one unchanged POST and a current-bounds/current-token refresh.
- Account switching after midnight while an earlier account's save is pending; current-date empty draft and no stale refresh/navigation.

Run `npx playwright test --config=playwright.scene.config.ts` from `web/`. The production build also performs TypeScript and generated-manifest checks. The adjacent regression suites cover session privacy, account removal, transient Model V2 input, saved-scene navigation, request failure recovery and default-off scene policy; the separate production-on suite checks existing S05 behavior.

Local result for this increment: TypeScript/Vite build passed; all 15 new cases, eight existing S02 review cases, 65 adjacent regression cases and five production S05 cases passed. The WebGL clock test explicitly advances React's lazy/Suspense scheduling while fake time is paused. Current-commit CI results are tracked on PR #391.

Clock/event simulation and local Chromium WebGL are not real-device Safari/Android or actual OS suspension acceptance. Final clay art, responsive asset approval, S10, S05 migration parity and device performance/controlled rollout remain outstanding. The new production scene gate stays closed; PR #391 remains draft.

Implementation references: [React layout effects](https://react.dev/reference/react/useLayoutEffect), [Playwright clock emulation](https://playwright.dev/docs/clock), [Supabase auth subscriptions](https://supabase.com/docs/reference/javascript/auth-onauthstatechange). Supabase SDK/configuration and subscription lifecycle are unchanged.
