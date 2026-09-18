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
  'web/src/ui/scene-manifest.v2.json',
  'web/src/ui/sceneManifest.generated.ts',
  'web/src/ui/scenePolicy.ts',
  'web/src/ui/sceneRecipes.ts',
  'web/src/ui/companionSceneRegistry.ts',
  'web/src/ui/companionPresentationProfiles.ts',
  'web/scripts/scene-asset-inputs.mjs',
  'web/scripts/register-scene-posters.mjs',
  'web/scripts/verify-scene-manifest.mjs',
  'web/scripts/scene-manifest.test.mjs',
]);

const companionReviewRuntimeFiles = new Set([
  'web/src/components/CompanionReviewRenderer.tsx',
  'web/src/components/CompanionRuntimeBoundary.tsx',
  'web/src/components/companionInteraction.ts',
  'web/src/components/companionLook.ts',
  'web/src/ui/companion.ts',
]);

const broadBrowserRuntimeFiles = new Set([
  'web/src/App.tsx',
  'web/src/main.tsx',
]);

const selectorFiles = new Set([
  'web/scripts/select-pr-browser-suites.mjs',
  'web/scripts/select-pr-browser-suites.test.mjs',
]);

const browserScopeIgnoredFiles = new Set([
  'web/README.md',
]);

const protectedBrowserFiles = new Set([
  'web/src/lib/api.ts',
  'web/src/lib/api-contract.ts',
  'web/src/lib/authEmailConfirm.ts',
  'web/src/lib/supabase.ts',
  'web/package.json',
  'web/package-lock.json',
  'web/wrangler.jsonc',
]);

const protectedBrowserPrefixes = [
  'web/src/lib/auth',
  'web/src/lib/model',
  'web/src/ui/model',
  'web/public/model',
  'web/e2e/model-v2',
  'web/scripts/verify-model-v2-assets',
];

const sharedSceneRuntimeFiles = new Set([
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

const companionReviewTestFiles = new Set([
  'web/e2e/companion-review.spec.ts',
]);

const productionCompanionTestFiles = new Set([
  'web/e2e/companion-production.spec.ts',
]);

const productionS10SceneTestFiles = new Set([
  'web/e2e/s10-production-scene.spec.ts',
  'web/playwright.s10-production.config.ts',
]);

const companionAssetPlatformFiles = new Set([
  'web/asset-candidates/companion-candidates.v1.json',
  'web/scripts/generate-companion-manifest.mjs',
  'web/scripts/verify-companion-candidates.mjs',
  'web/scripts/verify-companion-candidates.test.mjs',
]);

const scenePolicyContractTestFiles = new Set([
  'web/e2e/scene-policy.spec.ts',
  'web/e2e/presentation-policy.spec.ts',
]);

const uiBuildMatrixFiles = new Set([
  'web/scripts/verify-ui-build-matrix.mjs',
]);

const directlyRoutedTestFiles = new Set([
  ...savedSceneTestFiles,
  ...reviewSceneTestFiles,
  ...companionReviewTestFiles,
  ...productionCompanionTestFiles,
  ...productionS10SceneTestFiles,
  ...companionAssetPlatformFiles,
  ...scenePolicyContractTestFiles,
  ...uiBuildMatrixFiles,
]);

const savedSceneSuite = Object.freeze({
  name: 'saved-scene migration parity',
  command: 'npm run test:e2e:saved-scene',
});

const reviewSceneSuite = Object.freeze({
  name: 'S02 and S10 review scenes',
  command: 'npm run test:e2e:scene && SK7_SCENE_TEST_COMPANION=off npx playwright test --config=playwright.scene.config.ts --workers=1 --grep "S02 companion-off stays poster-only and requests no character GLB"',
});

const companionReviewSuite = Object.freeze({
  name: 'review companion runtime',
  command: 'npm run test:e2e:review',
});

const productionCompanionSuite = Object.freeze({
  name: 'production-on companion',
  command: 'npm run test:e2e:production:on',
});

const productionS10SceneSuite = Object.freeze({
  name: 'production S10 scene',
  command: 'npx playwright test e2e/s10-production-scene.spec.ts --config=playwright.s10-production.config.ts --workers=1',
});

const companionAssetPlatformSuite = Object.freeze({
  name: 'companion asset platform',
  command: 'node scripts/verify-companion-candidates.mjs && node --test scripts/verify-companion-candidates.test.mjs && npm run verify:companion-manifest',
});

const scenePolicyContractSuite = Object.freeze({
  name: 'scene policy contracts',
  command: 'npx playwright test e2e/scene-policy.spec.ts e2e/presentation-policy.spec.ts --config=playwright.config.ts --workers=1',
});

const uiBuildMatrixSuite = Object.freeze({
  name: 'UI build matrix',
  command: 'node scripts/verify-ui-build-matrix.mjs',
});

const normalAuthSuite = Object.freeze({
  name: 'normal auth boundaries',
  command: 'npx playwright test --config=playwright.ui-normal.config.ts',
});

const journeyUISuite = Object.freeze({
  name: 'journey UI',
  command: 'npm run test:e2e:ui:pr',
});

const selectorPolicySuite = Object.freeze({
  name: 'selector policy unit test',
  command: 'node --test scripts/select-pr-browser-suites.test.mjs',
});

// Current complete PR browser gate; nightly/manual/release still owns the full matrix.
const completePrBrowserGate = Object.freeze([
  {
    name: 'browser regression',
    command: [
      'npm run test:e2e',
      'npx playwright test e2e/s10-production-scene.spec.ts --config=playwright.s10-production.config.ts --workers=1',
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
  journeyUISuite,
]);

const knownWebFiles = new Set([
  ...broadBrowserRuntimeFiles,
  ...focusedFiles,
  ...savedSceneRuntimeFiles,
  ...reviewSceneRuntimeFiles,
  ...companionReviewRuntimeFiles,
  ...sharedSceneRuntimeFiles,
  ...savedSceneTestFiles,
  ...reviewSceneTestFiles,
  ...companionReviewTestFiles,
  ...productionCompanionTestFiles,
  ...productionS10SceneTestFiles,
  ...companionAssetPlatformFiles,
  ...scenePolicyContractTestFiles,
  ...uiBuildMatrixFiles,
  ...selectorFiles,
]);

function touches(files, set) {
  return files.some(file => set.has(file));
}

function cloneSuites(suites) {
  return suites.map(suite => ({ ...suite }));
}

function isProtectedBrowserPath(file) {
  if (protectedBrowserFiles.has(file)) return true;
  return protectedBrowserPrefixes.some(prefix => file.startsWith(prefix));
}

function isUnknownWebRuntime(file) {
  return file.startsWith('web/') && !knownWebFiles.has(file);
}

export function selectPrBrowserSuites(files) {
  const unique = [...new Set(files.filter(Boolean))];

  // Documentation and browser-neutral web docs do not widen browser scope.
  const relevant = unique.filter(
    file => !file.startsWith('docs/') && !browserScopeIgnoredFiles.has(file),
  );
  if (relevant.length === 0) {
    // Keep a tiny valid matrix for web-doc-only PRs; an actually empty diff
    // remains fail-safe and exercises the complete gate.
    return cloneSuites(unique.length === 0 ? completePrBrowserGate : [selectorPolicySuite]);
  }

  // Selector implementation/test-only changes run a tiny policy unit-test lane.
  if (relevant.every(file => selectorFiles.has(file))) {
    return cloneSuites([selectorPolicySuite]);
  }

  // Protected auth/API/model/dependency/deployment paths fall back to the full PR gate.
  if (relevant.some(file => isProtectedBrowserPath(file))) {
    return cloneSuites(completePrBrowserGate);
  }

  // Unknown/unclassified web runtime paths and non-web paths fall back to the full PR gate.
  if (relevant.some(file => isUnknownWebRuntime(file) || !file.startsWith('web/'))) {
    return cloneSuites(completePrBrowserGate);
  }

  // Focused presentation-only lanes.
  if (relevant.length > 0 && relevant.every(file => focusedFiles.has(file))) {
    const suites = [];
    if (touches(relevant, todayFiles)) {
      suites.push({
        name: 'S02 focused UI',
        command: 'npx playwright test --config=playwright.ui-candidate.config.ts e2e/ui-candidate.cases.ts',
      });
    }
    if (touches(relevant, recapFiles)) {
      suites.push({
        name: 'S10 focused UI',
        command: 'npx playwright test --config=playwright.ui-candidate.config.ts e2e/recap-candidate.cases.ts',
      });
      if (relevant.includes('web/src/components/journey-recap.css')) suites.push(reviewSceneSuite);
    }
    if (suites.length > 0) return cloneSuites(suites);
  }

  // Direct test-only lanes compose without escalating to unrelated browser families.
  if (relevant.length > 0 && relevant.every(file => directlyRoutedTestFiles.has(file))) {
    const suites = [];
    if (touches(relevant, savedSceneTestFiles)) suites.push(savedSceneSuite);
    if (touches(relevant, reviewSceneTestFiles)) suites.push(reviewSceneSuite);
    if (touches(relevant, companionReviewTestFiles)) suites.push(companionReviewSuite);
    if (touches(relevant, productionCompanionTestFiles)) suites.push(productionCompanionSuite);
    if (touches(relevant, productionS10SceneTestFiles)) suites.push(productionS10SceneSuite);
    if (touches(relevant, companionAssetPlatformFiles)) suites.push(companionAssetPlatformSuite);
    if (touches(relevant, scenePolicyContractTestFiles)) suites.push(scenePolicyContractSuite);
    if (touches(relevant, uiBuildMatrixFiles)) suites.push(uiBuildMatrixSuite);
    return cloneSuites(suites);
  }

  const touchesBroadBrowserRuntime = touches(relevant, broadBrowserRuntimeFiles);
  const touchesSharedSceneRuntime = touches(relevant, sharedSceneRuntimeFiles);
  const touchesSavedSceneRuntime = touchesSharedSceneRuntime || touches(relevant, savedSceneRuntimeFiles);
  const touchesReviewSceneRuntime = touchesSharedSceneRuntime || touches(relevant, reviewSceneRuntimeFiles);
  const touchesCompanionReviewRuntime = touches(relevant, companionReviewRuntimeFiles)
    || touches(relevant, companionReviewTestFiles);
  const touchesProductionCompanionTests = touches(relevant, productionCompanionTestFiles);
  const touchesProductionS10SceneTests = touches(relevant, productionS10SceneTestFiles);
  const touchesCompanionAssetPlatform = touches(relevant, companionAssetPlatformFiles);
  const touchesScenePolicyContracts = touches(relevant, scenePolicyContractTestFiles);
  const touchesUiBuildMatrix = touches(relevant, uiBuildMatrixFiles);

  // App/main shell wiring selects auth + journey UI, then adds scene/companion
  // coverage only when the same diff touches those runtimes. It never pulls in
  // Model V2 cross-browser coverage merely because the shell changed.
  if (touchesBroadBrowserRuntime) {
    const suites = [normalAuthSuite, journeyUISuite];
    if (touchesSavedSceneRuntime) suites.push(savedSceneSuite);
    if (touchesReviewSceneRuntime) suites.push(reviewSceneSuite);
    if (touchesCompanionReviewRuntime) {
      suites.push(companionReviewSuite, productionCompanionSuite);
    } else if (touchesProductionCompanionTests) {
      suites.push(productionCompanionSuite);
    }
    if (touchesProductionS10SceneTests) suites.push(productionS10SceneSuite);
    if (touchesCompanionAssetPlatform) suites.push(companionAssetPlatformSuite);
    if (touchesScenePolicyContracts) suites.push(scenePolicyContractSuite);
    if (touchesUiBuildMatrix) suites.push(uiBuildMatrixSuite);
    return cloneSuites(suites);
  }

  if (
    touchesSavedSceneRuntime
    || touchesReviewSceneRuntime
    || touchesCompanionReviewRuntime
    || touchesProductionCompanionTests
    || touchesProductionS10SceneTests
    || touchesCompanionAssetPlatform
    || touchesScenePolicyContracts
    || touchesUiBuildMatrix
  ) {
    const suites = [];
    if (touchesSavedSceneRuntime) suites.push(savedSceneSuite);
    if (touchesReviewSceneRuntime) suites.push(reviewSceneSuite);
    if (touchesCompanionReviewRuntime) {
      suites.push(companionReviewSuite, productionCompanionSuite);
    } else if (touchesProductionCompanionTests) {
      suites.push(productionCompanionSuite);
    }
    if (touchesProductionS10SceneTests) suites.push(productionS10SceneSuite);
    if (touchesCompanionAssetPlatform) suites.push(companionAssetPlatformSuite);
    if (touchesScenePolicyContracts) suites.push(scenePolicyContractSuite);
    if (touchesUiBuildMatrix) suites.push(uiBuildMatrixSuite);
    return cloneSuites(suites);
  }

  return cloneSuites(completePrBrowserGate);
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
