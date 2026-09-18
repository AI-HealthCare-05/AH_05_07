import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { selectPrBrowserSuites } from './select-pr-browser-suites.mjs';

const suites = files => selectPrBrowserSuites(files);
const names = files => suites(files).map(suite => suite.name);

const fullGate = [
  'browser regression',
  'model-v2 firefox and webkit',
  'journey UI',
];

const appShellGate = [
  'normal auth boundaries',
  'journey UI',
];

test('S02 presentation-only changes use the focused S02 lane', () => {
  assert.deepEqual(names([
    'web/src/components/JourneyToday.tsx',
    'web/src/components/journey-today.css',
    'web/e2e/ui-candidate.cases.ts',
  ]), ['S02 focused UI']);
});

test('S10 presentation-only component and test changes use the focused S10 lane', () => {
  assert.deepEqual(names([
    'web/src/components/JourneyRecap.tsx',
    'web/e2e/recap-candidate.cases.ts',
  ]), ['S10 focused UI']);
});

test('S10 recap CSS also runs review-scene framing coverage', () => {
  assert.deepEqual(names([
    'web/src/components/journey-recap.css',
  ]), ['S10 focused UI', 'S02 and S10 review scenes']);
});

test('S02 and S10 presentation changes run both focused lanes in parallel', () => {
  assert.deepEqual(names([
    'web/src/components/JourneyToday.tsx',
    'web/src/components/JourneyRecap.tsx',
  ]), ['S02 focused UI', 'S10 focused UI']);
});

test('App shell wiring alone selects normal auth and journey UI', () => {
  assert.deepEqual(names(['web/src/App.tsx']), appShellGate);
});

test('main shell wiring alone selects normal auth and journey UI', () => {
  assert.deepEqual(names(['web/src/main.tsx']), appShellGate);
});

test('App shell plus review-scene runtime adds the scene suite', () => {
  assert.deepEqual(names([
    'web/src/App.tsx',
    'web/src/components/VisualStage.tsx',
  ]), [...appShellGate, 'S02 and S10 review scenes']);
});

test('App shell plus companion renderer adds companion review suites', () => {
  assert.deepEqual(names([
    'web/src/App.tsx',
    'web/src/components/CompanionReviewRenderer.tsx',
  ]), [
    ...appShellGate,
    'review companion runtime',
    'production-on companion',
  ]);
});

test('App shell plus a Model V2 path falls back to the complete PR gate', () => {
  assert.deepEqual(names([
    'web/src/App.tsx',
    'web/src/ui/model/ModelScore.tsx',
  ]), fullGate);
});

test('App shell plus an auth path falls back to the complete PR gate', () => {
  assert.deepEqual(names([
    'web/src/App.tsx',
    'web/src/lib/authEmailConfirm.ts',
  ]), fullGate);
});

test('scene manifest tooling alone selects the review-scene suite', () => {
  assert.deepEqual(names(['web/scripts/verify-scene-manifest.mjs']), [
    'S02 and S10 review scenes',
  ]);
});

test('docs do not widen a targeted scene manifest diff', () => {
  assert.deepEqual(names([
    'docs/project-handoff.md',
    'web/src/ui/scene-manifest.v2.json',
  ]), ['S02 and S10 review scenes']);
});

test('selector implementation/test-only changes use the policy unit-test lane', () => {
  assert.deepEqual(names([
    'web/scripts/select-pr-browser-suites.mjs',
    'web/scripts/select-pr-browser-suites.test.mjs',
  ]), ['selector policy unit test']);
});

test('selector-only lane uses a web-working-directory-safe command', () => {
  assert.equal(
    suites(['web/scripts/select-pr-browser-suites.mjs'])[0].command,
    'node --test scripts/select-pr-browser-suites.test.mjs',
  );
});

test('browser-neutral web README does not widen an App shell diff', () => {
  assert.deepEqual(names([
    'web/README.md',
    'web/src/App.tsx',
  ]), appShellGate);
});

test('browser-neutral web README alone uses the tiny selector smoke', () => {
  assert.deepEqual(names(['web/README.md']), ['selector policy unit test']);
});

test('saved-scene runtime changes run only saved-scene parity', () => {
  assert.deepEqual(names(['web/src/components/SavedSceneBoundary.tsx']), [
    'saved-scene migration parity',
  ]);
});

test('review-scene runtime changes run only the S02/S10 scene suite', () => {
  assert.deepEqual(names(['web/src/components/VisualStage.tsx']), [
    'S02 and S10 review scenes',
  ]);
});

test('review-scene suite verifies companion-off under an explicit off build', () => {
  assert.equal(
    suites(['web/src/components/VisualStage.tsx'])[0].command,
    'npm run test:e2e:scene && SK7_SCENE_TEST_COMPANION=off npx playwright test --config=playwright.scene.config.ts --workers=1 --grep "S02 companion-off stays poster-only and requests no character GLB"',
  );
});

test('shared journey scene CSS runs the two directly related engine suites', () => {
  assert.deepEqual(names(['web/src/components/journey-candidate.css']), [
    'saved-scene migration parity',
    'S02 and S10 review scenes',
  ]);
});

test('shared scene disposal changes run the two directly related engine suites', () => {
  assert.deepEqual(names(['web/src/components/scene/disposeScene.ts']), [
    'saved-scene migration parity',
    'S02 and S10 review scenes',
  ]);
});

test('Seoul date runtime changes run only the review-scene suite', () => {
  assert.deepEqual(names(['web/src/lib/useSeoulDate.ts']), [
    'S02 and S10 review scenes',
  ]);
});

test('saved-scene test-only changes run only saved-scene parity', () => {
  assert.deepEqual(names(['web/e2e/saved-scene-review.spec.ts']), [
    'saved-scene migration parity',
  ]);
});

test('review-scene test-only changes run only the review-scene suite', () => {
  assert.deepEqual(names(['web/e2e/seoul-date-rollover.spec.ts']), [
    'S02 and S10 review scenes',
  ]);
});

test('companion-review test-only changes run only the review companion suite', () => {
  assert.deepEqual(names(['web/e2e/companion-review.spec.ts']), [
    'review companion runtime',
  ]);
});

test('production companion test-only changes run only production companion coverage', () => {
  assert.deepEqual(names(['web/e2e/companion-production.spec.ts']), [
    'production-on companion',
  ]);
});

test('production S10 scene test and config route only to the exact-production scene lane', () => {
  assert.deepEqual(names([
    'web/e2e/s10-production-scene.spec.ts',
    'web/playwright.s10-production.config.ts',
  ]), ['production S10 scene']);
});

test('candidate inventory and verifier use only the companion asset platform lane', () => {
  assert.deepEqual(names([
    'web/asset-candidates/companion-candidates.v1.json',
    'web/scripts/verify-companion-candidates.mjs',
    'web/scripts/verify-companion-candidates.test.mjs',
  ]), ['companion asset platform']);
});

test('asset platform plus scene recipe changes compose candidate and scene coverage', () => {
  assert.deepEqual(names([
    'web/asset-candidates/companion-candidates.v1.json',
    'web/src/ui/sceneRecipes.ts',
  ]), [
    'S02 and S10 review scenes',
    'companion asset platform',
  ]);
});

test('App plus shared scene runtime and production S10 contract compose focused lanes', () => {
  assert.deepEqual(names([
    'web/src/App.tsx',
    'web/src/components/VisualStage.tsx',
    'web/e2e/s10-production-scene.spec.ts',
    'web/playwright.s10-production.config.ts',
  ]), [
    ...appShellGate,
    'S02 and S10 review scenes',
    'production S10 scene',
  ]);
});

test('scene policy contract tests run without unrelated browser families', () => {
  assert.deepEqual(names([
    'web/e2e/scene-policy.spec.ts',
    'web/e2e/presentation-policy.spec.ts',
  ]), ['scene policy contracts']);
});

test('mixed directly routed tests compose their exact concern suites', () => {
  assert.deepEqual(names([
    'web/e2e/saved-scene-review.spec.ts',
    'web/e2e/companion-production.spec.ts',
    'web/e2e/scene-policy.spec.ts',
  ]), [
    'saved-scene migration parity',
    'production-on companion',
    'scene policy contracts',
  ]);
});

test('UI build matrix tooling runs only its own matrix lane', () => {
  assert.deepEqual(names(['web/scripts/verify-ui-build-matrix.mjs']), [
    'UI build matrix',
  ]);
});

test('App shell plus UI build matrix composes both direct concerns', () => {
  assert.deepEqual(names([
    'web/src/App.tsx',
    'web/scripts/verify-ui-build-matrix.mjs',
  ]), [
    ...appShellGate,
    'UI build matrix',
  ]);
});

test('companion renderer changes run only review and production companion coverage', () => {
  assert.deepEqual(names(['web/src/components/CompanionReviewRenderer.tsx']), [
    'review companion runtime',
    'production-on companion',
  ]);
});

test('companion renderer plus review test stays in the companion-only lane', () => {
  assert.deepEqual(names([
    'web/src/components/CompanionReviewRenderer.tsx',
    'web/e2e/companion-review.spec.ts',
  ]), [
    'review companion runtime',
    'production-on companion',
  ]);
});

test('mixed scene engine tests run both targeted engine suites', () => {
  assert.deepEqual(names([
    'web/e2e/saved-scene-review.spec.ts',
    'web/e2e/diorama-scene-review.spec.ts',
  ]), [
    'saved-scene migration parity',
    'S02 and S10 review scenes',
  ]);
});

test('scene production activation diff stays on directly affected browser concerns', () => {
  assert.deepEqual(names([
    'docs/evidence/scene-clay-posters.json',
    'docs/evidence/scene-diorama-posters.json',
    'docs/scene-release-gates.md',
    'web/README.md',
    'web/e2e/companion-production.spec.ts',
    'web/e2e/presentation-policy.spec.ts',
    'web/e2e/saved-scene-review.spec.ts',
    'web/e2e/scene-policy.spec.ts',
    'web/scripts/verify-ui-build-matrix.mjs',
    'web/src/App.tsx',
    'web/src/lib/useSavedSceneEvent.ts',
    'web/src/ui/savedScene.ts',
    'web/src/ui/scenePolicy.ts',
  ]), [
    'normal auth boundaries',
    'journey UI',
    'saved-scene migration parity',
    'S02 and S10 review scenes',
    'production-on companion',
    'scene policy contracts',
    'UI build matrix',
  ]);
});

test('activation-shaped diff plus protected model path still escalates to full gate', () => {
  assert.deepEqual(names([
    'web/src/App.tsx',
    'web/src/lib/useSavedSceneEvent.ts',
    'web/src/ui/scenePolicy.ts',
    'web/e2e/scene-policy.spec.ts',
    'web/src/ui/model/ModelScore.tsx',
  ]), fullGate);
});

test('activation-shaped diff plus unknown web runtime still escalates to full gate', () => {
  assert.deepEqual(names([
    'web/src/App.tsx',
    'web/src/ui/scenePolicy.ts',
    'web/src/unknown/NewRuntime.tsx',
  ]), fullGate);
});

test('unknown or workflow changes fall back to the complete PR browser gate', () => {
  assert.deepEqual(names(['.github/workflows/browser-e2e.yml']), fullGate);
});

test('empty diff fails safe to the complete PR browser gate', () => {
  assert.deepEqual(names([]), fullGate);
});


// These dependency-free source contracts run in the classify job before npm ci.
// Browser execution still belongs to the actual config-specific CI commands.
const source = path => readFileSync(new URL(path, import.meta.url), 'utf8');

test('production S10 is excluded from the generic browser build', () => {
  const config = source('../playwright.config.ts');
  const ignoreList = config.match(/testIgnore:\s*(\[[^\]]*\])/);
  assert.ok(ignoreList, 'the generic configuration must declare isolated suites');
  assert.deepEqual(JSON.parse(ignoreList[1]), [
    '**/saved-scene-review.spec.ts',
    '**/living-scene-review.spec.ts',
    '**/diorama-scene-review.spec.ts',
    '**/seoul-date-rollover.spec.ts',
    '**/production-fixture-boundary.spec.ts',
    '**/companion-review.spec.ts',
    '**/companion-production.spec.ts',
    '**/living-replay.spec.ts',
    '**/s10-production-scene.spec.ts',
  ], 'isolate production S10 without broadening ignores or collecting other dedicated suites');
});

test('the shared regression command retains the explicit production S10 run', () => {
  const regression = suites(['web/playwright.config.ts']).find(
    suite => suite.name === 'browser regression',
  );
  assert.ok(regression, 'the complete PR gate must retain browser regression');
  assert.deepEqual(regression.command.split(' && ').slice(0, 2), [
    'npm run test:e2e',
    'npx playwright test e2e/s10-production-scene.spec.ts --config=playwright.s10-production.config.ts --workers=1',
  ]);
});

test('the dedicated production S10 suite keeps its explicit synthetic build modes', () => {
  const config = source('../playwright.s10-production.config.ts');
  assert.match(config, /testMatch:\s*"s10-production-scene\.spec\.ts"/);
  assert.doesNotMatch(config, /testIgnore\s*:/, 'the dedicated suite must not ignore its own production tests');
  for (const [key, value] of [
    ['VITE_SK7_E2E_MODE', '1'],
    ['VITE_SK7_UI_MODE', 'journey'],
    ['VITE_SK7_SCENE_MODE', 'production'],
    ['VITE_SK7_COMPANION_MODE', 'production'],
  ]) assert.match(config, new RegExp(`${key}:\\s*"${value}"`));
  assert.match(config, /--host 127\.0\.0\.1 --port 4173 --strictPort/);
  assert.equal(
    suites(['web/e2e/s10-production-scene.spec.ts'])[0].command,
    'npx playwright test e2e/s10-production-scene.spec.ts --config=playwright.s10-production.config.ts --workers=1',
  );
});

test('S05 Android shares the relaxed fill threshold without dropping motion or clipping guards', () => {
  const ui = source('../e2e/ui-candidate.cases.ts');
  const threshold = 'expect(bounds.paintedHeight).toBeGreaterThanOrEqual(Math.floor(bounds.height * .74));';
  assert.equal(ui.split(threshold).length - 1, 2, 'both framing paths must retain the same fill threshold');
  assert.doesNotMatch(ui, /paintedHeight\)\.toBeGreaterThan\(bounds\.height \* \.8\)/);
  const begin = ui.indexOf("test('journey S05 Android profile keeps the canvas outside the rounded landscape clip'");
  const end = ui.indexOf("\nfor (const outcome", begin);
  assert.ok(begin >= 0 && end > begin);
  const android = ui.slice(begin, end);
  assert.ok(android.includes(threshold));
  assert.ok(android.includes('expect(report.counts.celebrate).toBeGreaterThanOrEqual(235)'));
  assert.ok(android.includes('expect(report.counts.idle).toBe(61)'));
  assert.ok(android.includes("for (const edge of ['left', 'right', 'top', 'bottom'] as const) expect(bounds[edge], `${bounds.phase} ${edge}`).toBeGreaterThanOrEqual(5);"));
  assert.ok(android.includes('expect(bounds.cssClippedPixels).toBe(0)'));
  assert.ok(android.includes('expect(geometry.devicePixelRatio).toBe(2.8125)'));
  assert.ok(android.includes('expect(geometry.drawingBuffer).toEqual({ width: 480, height: 336 })'));
  assert.ok(android.includes("expect(geometry.rippleOverflow).toBe('visible')"));
  assert.ok(android.includes("expect(geometry.landscapeOverflow).toBe('hidden')"));
  for (const [edge, comparison] of [
    ['left', 'toBeGreaterThan'],
    ['right', 'toBeLessThan'],
    ['top', 'toBeGreaterThan'],
    ['bottom', 'toBeLessThan'],
  ]) assert.ok(android.includes(`expect(geometry.canvas.${edge}).${comparison}(geometry.ripple.${edge})`));
});
