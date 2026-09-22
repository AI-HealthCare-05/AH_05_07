import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { browserModuleCommands } from './browser-ci-modules.mjs';
import {
  describePrBrowserProfile,
  fastJourneyCoverage,
  selectPrBrowserModules,
  selectPrEvidenceModules,
} from './select-pr-browser-suites.mjs';

const browser = files => selectPrBrowserModules(files);
const evidence = files => selectPrEvidenceModules(files);

test('documentation-only changes use only the tiny policy lane', () => {
  assert.deepEqual(browser(['docs/project-handoff.md']), ['policy']);
});

test('every fast-routed Journey path names focused protection selected by the fast config', () => {
  const config = source('../playwright.journey.config.ts');
  for (const [file, coverage] of Object.entries(fastJourneyCoverage)) {
    assert.deepEqual(browser([file]), ['journey'], file);
    assert.ok(config.includes(coverage.spec), `${file}: ${coverage.spec}`);
    for (const contract of coverage.tests) assert.ok(config.includes(contract), `${file}: ${contract}`);
  }
});

test('broad Journey owners and unfocused record/report paths use journey-full', () => {
  for (const file of [
    'web/src/components/journey-candidate.css',
    'web/src/components/record-explorer.css',
    'web/src/components/living-week-report.css',
    'web/src/components/JourneySkeleton.tsx',
    'web/e2e/ui-candidate.cases.ts',
    'web/e2e/recap-candidate.cases.ts',
    'web/e2e/journey-candidate.cases.ts',
  ]) assert.deepEqual(browser([file]), ['journey-full'], file);
});

test('shared app shell and global styles fail safe to broad Journey confidence', () => {
  assert.deepEqual(browser(['web/src/App.tsx']), ['core', 'journey-full']);
  assert.deepEqual(browser(['web/src/main.tsx']), ['core', 'journey-full']);
  assert.deepEqual(browser(['web/src/styles.css']), ['journey-full']);
  assert.deepEqual(browser(['web/src/components/SceneShell.tsx']), ['journey-full', 'scene']);
  assert.deepEqual(browser(['web/playwright.ui-candidate.config.ts']), ['journey-full']);
  assert.deepEqual(browser(['web/playwright.journey.config.ts']), ['journey-full']);
});

test('guest entry, store, presentation and firewall route to core, full Journey, scene, and dedicated guest CI', () => {
  for (const file of [
    'web/src/GuestJourneySandbox.tsx',
    'web/src/guest/guestStore.ts',
    'web/src/components/guest-journey.css',
    'web/e2e/guest-journey.spec.ts',
    'web/playwright.guest.config.ts',
  ]) assert.deepEqual(browser([file]), ['core', 'journey-full', 'scene', 'guest'], file);
});

test('Showcase portal source and its journey-mode browser contract stay together', () => {
  for (const file of [
    'web/public/showcase-cinema.js',
    'web/public/showcase-cinema.css',
    'web/e2e/showcase-cinema.spec.ts',
  ]) assert.deepEqual(browser([file]), ['journey-full'], file);
});

test('scene-owned CSS and runtime select only scene', () => {
  assert.deepEqual(browser(['web/src/components/scene/scene-stage.css']), ['scene']);
  assert.deepEqual(browser(['web/src/components/VisualStage.tsx']), ['scene']);
});

test('saved-scene and character-preview runtime changes compose scene and assets', () => {
  assert.deepEqual(browser([
    'web/src/components/SavedSceneBoundary.tsx',
    'web/src/components/CompanionReviewRenderer.tsx',
  ]), ['scene', 'assets']);
});

test('Model V2 runtime and test-only changes select model', () => {
  assert.deepEqual(browser(['web/src/lib/model-v2/runtime.ts']), ['model']);
  assert.deepEqual(browser([
    'web/e2e/model-v2-user-input-flow.spec.ts',
    'web/playwright.model-v2.config.ts',
  ]), ['model']);
});

test('question review stays with the focused model browser concern', () => {
  assert.deepEqual(browser(['tools/question-review/verify.cjs']), ['model']);
  assert.deepEqual(browser(['docs/input-question-review.md']), ['model']);
});

test('auth and API browser paths select core without model', () => {
  assert.deepEqual(browser([
    'web/src/lib/authEmailConfirm.ts',
    'web/src/lib/api.ts',
  ]), ['core']);
});

test('dependency graph changes retain broad browser confidence', () => {
  assert.deepEqual(browser(['web/package-lock.json']), [
    'core',
    'journey-full',
    'scene',
    'guest',
    'model',
    'assets',
    'transcend-lab',
  ]);
});

test('Transcend Lab paths select the dedicated hosted module instead of generic core', () => {
  for (const file of [
    'web/transcend-lab/src/labRuntime.ts',
    'web/transcend-lab/package.json',
    'web/playwright.transcend-lab.config.ts',
    'web/e2e/transcend-presence-contract.spec.ts',
    'web/e2e/transcend-interaction-lab.spec.ts',
  ]) assert.deepEqual(browser([file]), ['transcend-lab'], file);
});

test('Transcend Lab reruns when its frozen membership seam changes', () => {
  assert.deepEqual(browser(['web/src/ui/companionRuntimeMembership.ts']), ['scene', 'transcend-lab']);
  assert.deepEqual(browser(['web/src/ui/companionAssets.generated.ts']), ['scene', 'assets', 'transcend-lab']);
  assert.deepEqual(browser(['web/src/ui/journey.ts']), ['journey-full', 'transcend-lab']);
});

test('review catalog generation is hosted by assets and the isolated Transcend Lab', () => {
  for (const file of [
    'web/asset-candidates/companion-review-catalog.v1.json',
    'web/scripts/import-companion-r2-inventory.mjs',
    'web/scripts/import-companion-r2-inventory.test.mjs',
  ]) assert.deepEqual(browser([file]), ['assets', 'transcend-lab'], file);
  assert.deepEqual(
    browser(['web/src/ui/companionReviewCatalog.ts']),
    ['scene', 'assets', 'transcend-lab'],
  );
});

test('Presence Host product paths compose Journey and scene coverage', () => {
  for (const file of [
    'web/src/platform/presence/companionPresenceKernel.ts',
    'web/src/platform/presence/s02PresenceArena.ts',
    'web/src/components/CompanionPresenceHostBridge.tsx',
    'web/src/components/PresenceSceneActorInteraction.tsx',
    'web/e2e/presence-host-foundation.spec.ts',
    'web/e2e/s02-spatial-presence.spec.ts',
  ]) assert.deepEqual(browser([file]), ['journey-full', 'scene'], file);
});

test('selector and browser workflow changes use policy only', () => {
  assert.deepEqual(browser([
    'web/scripts/select-pr-browser-suites.mjs',
    'web/scripts/select-pr-browser-suites.test.mjs',
    'web/scripts/browser-ci-modules.mjs',
    '.github/workflows/browser-e2e.yml',
  ]), ['policy']);
});

test('unknown web components fail safe to core rather than full browser coverage', () => {
  assert.deepEqual(browser(['web/src/components/NewRuntime.tsx']), ['core']);
});

test('scene and model changes compose only their relevant concerns', () => {
  assert.deepEqual(browser([
    'web/src/components/VisualStage.tsx',
    'web/src/ui/model/ModelScore.tsx',
  ]), ['scene', 'model']);
});

test('frontend and character assets select the assets module', () => {
  assert.deepEqual(browser([
    'web/src/components/UiIcon.tsx',
    'web/public/assets/ui/v1/icons/today.svg',
    'tools/character-preview/verify.cjs',
  ]), ['assets']);
});

test('empty diff remains fail-safe at core browser confidence', () => {
  assert.deepEqual(browser([]), ['core']);
});

test('browser profile describes policy, focused, fast and broad selections', () => {
  assert.equal(describePrBrowserProfile(['policy']), 'policy');
  assert.equal(describePrBrowserProfile(['model']), 'focused');
  assert.equal(describePrBrowserProfile(['journey']), 'fast');
  assert.equal(describePrBrowserProfile(['core', 'journey-full']), 'broad');
});

test('model and data evidence paths select model-data', () => {
  assert.deepEqual(evidence([
    'scripts/data/prepare.py',
    'tests/model/test_comparison.py',
    'docs/evidence/model-uncertainty.json',
  ]), ['model-data']);
});

test('local reliability paths select local-reliability', () => {
  assert.deepEqual(evidence([
    'tools/local-reliability/test_controls.py',
    'scripts/ops/measure_api_p95.py',
  ]), ['local-reliability']);
});

test('companion asset and character boundary paths select companion-assets', () => {
  assert.deepEqual(evidence([
    'tools/companions/test_glb_audit.py',
    'tools/character-preview/test_production_isolation.cjs',
    'web/src/ui/companionAssets.generated.ts',
  ]), ['companion-assets']);
});

test('shared Python version changes compose all affected evidence concerns', () => {
  assert.deepEqual(evidence(['.python-version']), ['model-data', 'local-reliability']);
});

test('evidence selector and workflow changes use policy only', () => {
  assert.deepEqual(evidence([
    'web/scripts/select-pr-browser-suites.mjs',
    '.github/workflows/evidence-controls.yml',
  ]), ['policy']);
});

test('browser module commands are owned outside the path selector', () => {
  assert.deepEqual(Object.keys(browserModuleCommands), [
    'policy',
    'core',
    'journey',
    'journey-full',
    'scene',
    'guest',
    'model',
    'assets',
    'transcend-lab',
  ]);
  assert.ok(browserModuleCommands.core.includes('npm run test:e2e'));
  assert.deepEqual(browserModuleCommands.journey, [
    'npx playwright test --config=playwright.journey.config.ts',
    'npx playwright test --config=playwright.scene.config.ts --workers=1 --grep "review renders at 390x844|S10 renders and measures its scene at 390x844|S10 responsive environment rebuild keeps one character load and bounded framing"',
  ]);
  assert.ok(browserModuleCommands['journey-full'].includes('SK7_UI_TEST_COMPANION=off npm run test:e2e:ui:pr'));
  assert.ok(browserModuleCommands['journey-full'].includes('node scripts/verify-ui-build-matrix.mjs'));
  assert.ok(browserModuleCommands.model.includes('npm run test:e2e:model-v2'));
  assert.ok(browserModuleCommands.scene.includes('npm run test:e2e:saved-scene'));
  assert.deepEqual(browserModuleCommands.guest, ['npx playwright test --config=playwright.guest.config.ts']);
  assert.ok(browserModuleCommands.assets.includes('npx playwright test --config=playwright.companion-asset.config.ts'));
  assert.ok(browserModuleCommands.assets.includes('node --test scripts/import-companion-r2-inventory.test.mjs'));
  assert.ok(browserModuleCommands.assets.some(command => command.includes('import-companion-r2-inventory.mjs') && command.includes('--check')));
  assert.deepEqual(browserModuleCommands['transcend-lab'], ['npm --prefix transcend-lab test']);
});

test('dedicated guest config owns the guest firewall and exact scene-enabled build', () => {
  const config = source('../playwright.guest.config.ts');
  const spec = source('../e2e/guest-journey.spec.ts');
  assert.match(config, /testMatch:\s*"guest-journey\.spec\.ts"/);
  assert.match(config, /VITE_SK7_SCENE_MODE:\s*"review"/);
  assert.match(config, /VITE_SK7_COMPANION_MODE:\s*"review"/);
  for (const contract of [
    '/api/v1 request',
    'Supabase request',
    'account/session refresh',
    'structured feedback',
    'indexedDatabases',
    'cacheNames',
    'reload resets it',
  ]) assert.ok(spec.includes(contract), contract);
});

test('fast Journey config reuses focused Journey, B9 and S11 assertions in one build', () => {
  const config = source('../playwright.journey.config.ts');
  for (const contract of [
    'journey candidate primary action, input identity and navigation at 390x844',
    'recap week reflection map order at 390x844',
    'route enter reuses the viewport and does not repeat for typing, theme, or refresh',
    'reduced motion, hidden documents, reports, and dialogs cancel only B9-owned motion',
    'S11 retained synthetic fixture defaults to not_ready and exposes no result value',
    'S11 remains usable at 390px',
  ]) assert.ok(config.includes(contract), contract);
  assert.match(config, /VITE_SK7_SCENE_MODE:\s*'off'/);
  assert.match(config, /VITE_SK7_COMPANION_MODE:\s*'production'/);
});

test('fast Journey scene invocation keeps the three representative real-scene regressions', () => {
  const [sceneCommand] = browserModuleCommands.journey.filter(command => command.includes('playwright.scene.config.ts'));
  assert.ok(sceneCommand);
  for (const contract of [
    'review renders at 390x844',
    'S10 renders and measures its scene at 390x844',
    'S10 responsive environment rebuild keeps one character load and bounded framing',
  ]) assert.ok(sceneCommand.includes(contract), contract);
  assert.equal(browserModuleCommands.journey.filter(command => command.includes('playwright.scene.config.ts')).length, 1);
});

const source = path => readFileSync(new URL(path, import.meta.url), 'utf8');

test('production S10 remains isolated from the generic browser build', () => {
  const config = source('../playwright.config.ts');
  const ignoreList = config.match(/testIgnore:\s*(\[[^\]]*\])/);
  assert.ok(ignoreList, 'the generic configuration must declare isolated suites');
  assert.ok(JSON.parse(ignoreList[1]).includes('**/s10-production-scene.spec.ts'));
  assert.ok(browserModuleCommands.scene.some(command => command.includes('playwright.s10-production.config.ts')));
});

test('the dedicated production S10 suite keeps exact synthetic build modes', () => {
  const config = source('../playwright.s10-production.config.ts');
  assert.match(config, /testMatch:\s*"s10-production-scene\.spec\.ts"/);
  for (const [key, value] of [
    ['VITE_SK7_E2E_MODE', '1'],
    ['VITE_SK7_UI_MODE', 'journey'],
    ['VITE_SK7_SCENE_MODE', 'production'],
    ['VITE_SK7_COMPANION_MODE', 'production'],
  ]) assert.match(config, new RegExp(`${key}:\\s*"${value}"`));
});

test('S05 Android retains fill, motion, clipping and pixel-ratio guards', () => {
  const ui = source('../e2e/ui-candidate.cases.ts');
  const threshold = 'expect(bounds.paintedHeight).toBeGreaterThanOrEqual(Math.floor(bounds.height * .74));';
  assert.equal(ui.split(threshold).length - 1, 2);
  const begin = ui.indexOf("test('journey S05 Android profile keeps the canvas outside the rounded landscape clip'");
  const end = ui.indexOf('\nfor (const outcome', begin);
  const android = ui.slice(begin, end);
  for (const contract of [
    threshold,
    'expect(report.counts.celebrate).toBeGreaterThanOrEqual(235)',
    'expect(bounds.cssClippedPixels).toBe(0)',
    'expect(geometry.devicePixelRatio).toBe(2.8125)',
  ]) assert.ok(android.includes(contract), contract);
});
