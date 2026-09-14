import test from 'node:test';
import assert from 'node:assert/strict';
import { selectPrBrowserSuites } from './select-pr-browser-suites.mjs';

const names = files => selectPrBrowserSuites(files).map(suite => suite.name);

const fullGate = [
  'browser regression',
  'model-v2 firefox and webkit',
  'journey UI',
];

test('S02 presentation-only changes use the focused S02 lane', () => {
  assert.deepEqual(names([
    'web/src/components/JourneyToday.tsx',
    'web/src/components/journey-today.css',
    'web/e2e/ui-candidate.cases.ts',
  ]), ['S02 focused UI']);
});

test('S10 presentation-only changes use the focused S10 lane', () => {
  assert.deepEqual(names([
    'web/src/components/JourneyRecap.tsx',
    'web/src/components/journey-recap.css',
    'web/e2e/recap-candidate.cases.ts',
  ]), ['S10 focused UI']);
});

test('S02 and S10 presentation changes run both focused lanes in parallel', () => {
  assert.deepEqual(names([
    'web/src/components/JourneyToday.tsx',
    'web/src/components/JourneyRecap.tsx',
  ]), ['S02 focused UI', 'S10 focused UI']);
});

test('shared scene runtime changes add both engine suites to the complete PR gate', () => {
  assert.deepEqual(names(['web/src/App.tsx']), [
    ...fullGate,
    'saved-scene migration parity',
    'S02 and S10 review scenes',
  ]);
});

test('saved-scene runtime changes add only the saved-scene engine suite', () => {
  assert.deepEqual(names(['web/src/components/SavedSceneBoundary.tsx']), [
    ...fullGate,
    'saved-scene migration parity',
  ]);
});

test('review-scene runtime changes add only the S02/S10 scene engine suite', () => {
  assert.deepEqual(names(['web/src/components/VisualStage.tsx']), [
    ...fullGate,
    'S02 and S10 review scenes',
  ]);
});

test('shared journey CSS is treated as a shared scene runtime boundary', () => {
  assert.deepEqual(names(['web/src/components/journey-candidate.css']), [
    ...fullGate,
    'saved-scene migration parity',
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
