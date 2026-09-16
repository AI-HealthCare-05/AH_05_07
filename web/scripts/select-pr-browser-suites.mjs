import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const todayFiles = new Set([
  'web/src/components/JourneyToday.tsx',
  'web/src/components/journey-today.css',
  'web/e2e/ui-candidate.cases.ts',
]);

const recapFiles = new Set([
  'web/src/components/JourneyRecap.tsx',
  'web/src/components/journey-recap.css',
  'web/e2e/recap-candidate.cases.ts',
]);

const focusedFiles = new Set([...todayFiles, ...recapFiles]);

const savedSceneRuntimeFiles = new Set([
  'web/src/components/SavedSceneBoundary.tsx',
  'web/src/components/scene/SavedSceneRenderer.tsx',
  'web/src/lib/useSavedSceneEvent.ts',
  'web/src/ui/savedScene.ts',
]);

const reviewSceneRuntimeFiles = new Set([
  'web/src/components/journey-recap.css',
  'web/src/components/VisualStage.tsx',
  'web/src/components/scene/ThreeSceneRenderer.tsx',
  'web/src/components/scene/diorama.ts',
  'web/src/components/scene/environment.ts',
  'web/src/lib/seoulDate.ts',
  'web/src/lib/useSeoulDate.ts',
  'web/src/ui/sceneManifest.generated.ts',
  'web/src/ui/scenePolicy.ts',
  'web/src/ui/sceneRecipes.ts',
]);

const sharedSceneRuntimeFiles = new Set([
  'web/src/App.tsx',
  'web/src/main.tsx',
  'web/src/components/SceneShell.tsx',
  'web/src/components/journey-candidate.css',
  'web/src/components/scene/disposeScene.ts',
]);

const savedSceneTestFiles = new Set([
  'web/e2e/saved-scene-review.spec.ts',
]);

const reviewSceneTestFiles = new Set([
  'web/e2e/diorama-scene-review.spec.ts',
  'web/e2e/living-scene-review.spec.ts',
  'web/e2e/seoul-date-rollover.spec.ts',
]);

const sceneEngineTestFiles = new Set([
  ...savedSceneTestFiles,
  ...reviewSceneTestFiles,
]);

const savedSceneSuite = Object.freeze({
  name: 'saved-scene migration parity',
  command: 'npm run test:e2e:saved-scene',
});

const reviewSceneSuite = Object.freeze({
  name: 'S02 and S10 review scenes',
  command: 'npm run test:e2e:scene',
});

const fullSuites = Object.freeze([
  {
    name: 'browser regression',
    command: [
      'npm run test:e2e',
      'node --check ../tools/mvp1-capture.cjs',
      'node --check ../tools/submission-record.cjs',
      'node --check ../tools/submission-video-check.cjs',
      'node --check ../tools/submission-slides.mjs',
    ].join(' && '),
  },
  {
    name: 'model-v2 firefox and webkit',
    command: 'npm run test:e2e:model-v2 -- --project=firefox --project=webkit',
  },
  {
    name: 'journey UI',
    command: 'npm run test:e2e:ui:pr',
  },
]);

function touches(files, set) {
  return files.some(file => set.has(file));
}

function cloneSuites(suites) {
  return suites.map(suite => ({ ...suite }));
}

export function selectPrBrowserSuites(files) {
  const unique = [...new Set(files.filter(Boolean))];

  if (unique.length > 0 && unique.every(file => focusedFiles.has(file))) {
    const suites = [];
    if (touches(unique, todayFiles)) {
      suites.push({
        name: 'S02 focused UI',
        command: 'npx playwright test --config=playwright.ui-candidate.config.ts e2e/ui-candidate.cases.ts',
      });
    }
    if (touches(unique, recapFiles)) {
      suites.push({
        name: 'S10 focused UI',
        command: 'npx playwright test --config=playwright.ui-candidate.config.ts e2e/recap-candidate.cases.ts',
      });
      if (unique.includes('web/src/components/journey-recap.css')) suites.push(reviewSceneSuite);
    }
    if (suites.length > 0) return suites;
  }

  if (unique.length > 0 && unique.every(file => sceneEngineTestFiles.has(file))) {
    const suites = [];
    if (touches(unique, savedSceneTestFiles)) suites.push(savedSceneSuite);
    if (touches(unique, reviewSceneTestFiles)) suites.push(reviewSceneSuite);
    return cloneSuites(suites);
  }

  const touchesSharedSceneRuntime = touches(unique, sharedSceneRuntimeFiles);
  const touchesSavedSceneRuntime = touchesSharedSceneRuntime || touches(unique, savedSceneRuntimeFiles);
  const touchesReviewSceneRuntime = touchesSharedSceneRuntime || touches(unique, reviewSceneRuntimeFiles);

  if (touchesSavedSceneRuntime || touchesReviewSceneRuntime) {
    const suites = [...fullSuites];
    if (touchesSavedSceneRuntime) suites.push(savedSceneSuite);
    if (touchesReviewSceneRuntime) suites.push(reviewSceneSuite);
    return cloneSuites(suites);
  }

  return cloneSuites(fullSuites);
}

function changedFiles(base, head) {
  return execFileSync('git', ['diff', '--name-only', `${base}...${head}`], {
    encoding: 'utf8',
  }).split(/\r?\n/).filter(Boolean);
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (invokedDirectly) {
  const [base, head] = process.argv.slice(2);
  if (!base || !head) {
    console.error('usage: node scripts/select-pr-browser-suites.mjs <base-sha> <head-sha>');
    process.exit(2);
  }
  const files = changedFiles(base, head);
  const suites = selectPrBrowserSuites(files);
  console.error(`browser-e2e selector: ${suites.map(suite => suite.name).join(', ')}`);
  console.error(`changed files: ${files.join(', ') || '(none)'}`);
  process.stdout.write(`matrix=${JSON.stringify(suites)}\n`);
}
