import test from 'node:test';
import assert from 'node:assert/strict';
import { selectPrBrowserSuites } from './select-pr-browser-suites.mjs';

const names = files => selectPrBrowserSuites(files).map(suite => suite.name);

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

test('shared runtime changes fall back to the complete PR browser gate', () => {
  assert.deepEqual(names(['web/src/App.tsx']), [
    'browser regression',
    'model-v2 firefox and webkit',
    'journey UI',
  ]);
});

test('unknown or workflow changes fall back to the complete PR browser gate', () => {
  assert.deepEqual(names(['.github/workflows/browser-e2e.yml']), [
    'browser regression',
    'model-v2 firefox and webkit',
    'journey UI',
  ]);
});

test('empty diff fails safe to the complete PR browser gate', () => {
  assert.deepEqual(names([]), [
    'browser regression',
    'model-v2 firefox and webkit',
    'journey UI',
  ]);
});
