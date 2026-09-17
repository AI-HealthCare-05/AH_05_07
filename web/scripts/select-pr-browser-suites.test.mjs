import test from 'node:test';
import assert from 'node:assert/strict';
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

test('unknown or workflow changes fall back to the complete PR browser gate', () => {
  assert.deepEqual(names(['.github/workflows/browser-e2e.yml']), fullGate);
});

test('empty diff fails safe to the complete PR browser gate', () => {
  assert.deepEqual(names([]), fullGate);
});
