import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export const browserModuleCommands = Object.freeze({
  policy: ['node --test scripts/select-pr-browser-suites.test.mjs'],
  core: [
    'npm run test:e2e',
    'npx playwright test --config=playwright.ui-normal.config.ts',
    'node --check ../tools/mvp1-capture.cjs && node --check ../tools/submission-record.cjs && node --check ../tools/submission-video-check.cjs && node --check ../tools/submission-slides.mjs',
  ],
  journey: [
    'npx playwright test --config=playwright.journey.config.ts',
    'npx playwright test --config=playwright.scene.config.ts --workers=1 --grep "review renders at 390x844|S10 renders and measures its scene at 390x844|S10 responsive environment rebuild keeps one character load and bounded framing"',
  ],
  'journey-full': [
    'npm run test:e2e:ui:pr',
    'SK7_UI_TEST_COMPANION=off npm run test:e2e:ui:pr',
    'node scripts/verify-ui-build-matrix.mjs',
  ],
  scene: [
    'node scripts/diagnose-companion-r2.mjs',
    'npm run test:e2e:review',
    'npm run test:e2e:production:on',
    'npm run test:e2e:saved-scene',
    'npm run test:e2e:scene',
    'SK7_SCENE_TEST_COMPANION=off npx playwright test --config=playwright.scene.config.ts --workers=1 --grep "S02 companion-off stays poster-only and requests no character GLB"',
    'npx playwright test e2e/s10-production-scene.spec.ts --config=playwright.s10-production.config.ts --workers=1',
  ],
  guest: [
    'node scripts/verify-guest-model-v2-isolation.mjs',
    'node --test scripts/verify-guest-model-v2-isolation.test.mjs',
    'npx playwright test --config=playwright.guest.config.ts',
  ],
  model: [
    'npm run test:e2e:model-v2',
    'node ../tools/question-review/verify.cjs',
  ],
  assets: [
    'node --test scripts/frontend-assets.test.mjs',
    'node --test scripts/import-companion-r2-inventory.test.mjs',
    'node scripts/import-companion-r2-inventory.mjs --inventory ../docs/evidence/companion-r2-v1.json --audit ../docs/evidence/scene-glb-forensics.json --output asset-candidates/companion-review-catalog.v1.json --check',
    'SK7_UI_TEST_COMPANION=off npx playwright test --config=playwright.frontend-assets.config.ts --workers=1',
    'npx playwright test --config=playwright.frontend-assets.config.ts --workers=1',
    'npx playwright test --config=playwright.companion-asset.config.ts',
    'npm run build',
    'node ../tools/character-preview/verify.cjs --synthetic --record-smoke',
  ],
  'transcend-lab': [
    'npm --prefix transcend-lab test',
  ],
});

export function runBrowserModules(modules) {
  for (const module of modules) {
    const commands = browserModuleCommands[module];
    if (!commands) throw new Error(`unknown browser CI module: ${module}`);
    for (const command of commands) {
      console.log(`browser module ${module}: ${command}`);
      const result = spawnSync(command, {
        cwd: webRoot,
        env: process.env,
        shell: true,
        stdio: 'inherit',
      });
      if (result.error) throw result.error;
      if (result.status !== 0) process.exit(result.status ?? 1);
    }
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const modules = process.argv.slice(2);
  if (modules.length === 0) {
    console.error(`usage: node scripts/browser-ci-modules.mjs <${Object.keys(browserModuleCommands).join('|')}> [...]`);
    process.exit(2);
  }
  runBrowserModules(modules);
}
