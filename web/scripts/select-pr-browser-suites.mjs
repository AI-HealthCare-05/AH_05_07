import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const selectorFiles = new Set([
  'web/scripts/select-pr-browser-suites.mjs',
  'web/scripts/select-pr-browser-suites.test.mjs',
  'web/scripts/browser-ci-modules.mjs',
]);

const dependencyFiles = new Set(['web/package.json', 'web/package-lock.json']);
const appShellFiles = new Set(['web/src/App.tsx', 'web/src/main.tsx']);

const broadJourneyFiles = new Set([
  'web/src/styles.css',
  'web/src/components/SceneShell.tsx',
  'web/src/components/JourneySkeleton.tsx',
  'web/src/components/journey-candidate.css',
  'web/src/components/living-week-report.css',
  'web/src/components/record-explorer.css',
  'web/src/ui/journey.ts',
  'web/e2e/ui-candidate.cases.ts',
  'web/e2e/recap-candidate.cases.ts',
  'web/e2e/journey-candidate.cases.ts',
  'web/playwright.journey.config.ts',
  'web/playwright.ui-candidate.config.ts',
  'web/scripts/verify-ui-build-matrix.mjs',
]);

export const fastJourneyCoverage = Object.freeze({
  'web/src/components/JourneyToday.tsx': {
    spec: 'journey-candidate.cases.ts',
    tests: ['journey candidate primary action, input identity and navigation at 390x844'],
  },
  'web/src/components/journey-today.css': {
    spec: 'journey-candidate.cases.ts',
    tests: ['journey candidate primary action, input identity and navigation at 390x844'],
  },
  'web/src/components/HomeJourneyTrail.tsx': {
    spec: 'journey-candidate.cases.ts',
    tests: ['journey candidate primary action, input identity and navigation at 390x844'],
  },
  'web/src/components/home-journey-trail.css': {
    spec: 'journey-candidate.cases.ts',
    tests: ['journey candidate primary action, input identity and navigation at 390x844'],
  },
  'web/src/components/JourneyRecap.tsx': {
    spec: 'recap-candidate.cases.ts',
    tests: ['recap week reflection map order at 390x844'],
  },
  'web/src/components/journey-recap.css': {
    spec: 'recap-candidate.cases.ts',
    tests: ['recap week reflection map order at 390x844'],
  },
  'web/src/components/seven-day-trail.css': {
    spec: 'recap-candidate.cases.ts',
    tests: ['recap week reflection map order at 390x844'],
  },
  'web/src/components/journey-feedback.css': {
    spec: 'ui-candidate.cases.ts',
    tests: [
      'route enter reuses the viewport and does not repeat for typing, theme, or refresh',
      'reduced motion, hidden documents, reports, and dialogs cancel only B9-owned motion',
    ],
  },
});

const journeyFiles = new Set(Object.keys(fastJourneyCoverage));

const sceneFiles = new Set([
  'web/src/components/VisualStage.tsx',
  'web/src/components/SavedSceneBoundary.tsx',
  'web/src/components/CompanionReviewRenderer.tsx',
  'web/src/components/CompanionRuntimeBoundary.tsx',
  'web/src/components/companionInteraction.ts',
  'web/src/components/companionLook.ts',
  'web/src/components/companionReactionRelease.ts',
  'web/src/components/SceneVisualAsset.tsx',
  'web/src/components/StaticSceneFallback.tsx',
  'web/src/lib/seoulDate.ts',
  'web/src/lib/useSeoulDate.ts',
  'web/src/lib/useSavedSceneEvent.ts',
  'web/src/ui/savedScene.ts',
  'web/src/ui/scene-manifest.v2.json',
  'web/src/ui/sceneManifest.generated.ts',
  'web/src/ui/scenePolicy.ts',
  'web/src/ui/sceneRecipes.ts',
  'web/src/ui/companionSceneRegistry.ts',
  'web/src/ui/companionPresentationProfiles.ts',
  'web/src/ui/companion.ts',
  'web/scripts/scene-asset-inputs.mjs',
  'web/scripts/register-scene-posters.mjs',
  'web/scripts/verify-scene-manifest.mjs',
  'web/scripts/scene-manifest.test.mjs',
  'web/scripts/diagnose-companion-r2.mjs',
  'web/playwright.scene.config.ts',
  'web/playwright.saved-scene.config.ts',
  'web/playwright.review.config.ts',
  'web/playwright.production-on.config.ts',
  'web/playwright.s10-production.config.ts',
]);

const scenePrefixes = [
  'web/src/components/scene/',
  'web/src/components/Scene',
  'web/src/components/StaticScene',
  'web/src/components/LoginCompanion',
  'web/src/ui/companion',
  'web/src/ui/scene',
  'web/e2e/companion-',
  'web/e2e/diorama-',
  'web/e2e/living-scene-',
  'web/e2e/saved-scene-',
  'web/e2e/scene-',
  'web/e2e/seoul-date-',
  'web/e2e/s10-production-scene',
  'web/public/scene-review/',
  'web/scripts/capture-scene-',
  'web/scripts/companion-',
  'web/scripts/inspect-scene-',
  'web/scripts/measure-scene-',
  'web/scripts/profile-scene-',
  'web/scripts/run-companion-',
  'web/scripts/serve-companion-',
  'web/scripts/serve-scene-',
  'web/scripts/summarize-scene-',
  'web/scripts/verify-scene-',
];

const modelFiles = new Set([
  'web/playwright.model-v2.config.ts',
  'docs/input-question-review.md',
]);

const modelPrefixes = [
  'web/src/components/ModelV2',
  'web/src/components/modelV2',
  'web/src/lib/model',
  'web/src/ui/model',
  'web/public/model',
  'web/e2e/model-v2-',
  'web/scripts/verify-model-v2-assets',
  'web/scripts/model-v2-',
  'tools/question-review/',
];

const authCoreFiles = new Set([
  'web/src/lib/api.ts',
  'web/src/lib/api-contract.ts',
  'web/src/lib/authEmailConfirm.ts',
  'web/src/lib/supabase.ts',
  'web/playwright.auth-confirm.config.ts',
  'web/playwright.ui-normal.config.ts',
  'web/wrangler.jsonc',
]);

const corePrefixes = [
  'web/src/lib/auth',
  'web/e2e/account-',
  'web/e2e/api-',
  'web/e2e/auth-',
  'web/e2e/bootstrap-',
  'web/e2e/bp-',
  'web/e2e/session-',
  'web/e2e/signed-in-',
  'web/e2e/ux-',
  'tools/submission-',
];

const assetFiles = new Set([
  'web/asset-candidates/companion-candidates.v1.json',
  'web/playwright.companion-asset.config.ts',
  'web/playwright.frontend-assets.config.ts',
  'web/scripts/frontend-assets.manifest.json',
  'web/scripts/frontend-assets.test.mjs',
  'web/scripts/generate-companion-manifest.mjs',
  'web/scripts/verify-companion-candidates.mjs',
  'web/scripts/verify-companion-candidates.test.mjs',
  'web/scripts/verify-companion-manifest.mjs',
  'web/src/components/UiIcon.tsx',
  'web/src/components/UiNotice.tsx',
  'web/src/components/UiObject.tsx',
  'web/src/components/frontend-assets.css',
  'web/src/ui/companionAssets.generated.ts',
  'web/src/ui/uiIconPaths.ts',
  'web/e2e/frontend-assets.cases.ts',
  'web/src/components/CompanionReviewRenderer.tsx',
  'web/src/components/CompanionRuntimeBoundary.tsx',
  'web/src/ui/companion.ts',
  'docs/adr/0006-local-character-preview.md',
  'docs/character-preview-verification.md',
]);

const assetPrefixes = ['web/public/assets/ui/v1/', 'tools/character-preview/'];

const modelDataEvidenceFiles = new Set([
  '.gitattributes',
  '.python-version',
  'pyproject.toml',
  'uv.lock',
  'docs/evidence/model-gate-1b.json',
  'docs/evidence/model-comparison.json',
  'docs/evidence/model-uncertainty.json',
  'docs/model-gate-1b-runbook.md',
  'docs/model-comparison-runbook.md',
  'docs/model-uncertainty-runbook.md',
  'scripts/ci/verify_model_gate_1b_contract.py',
  'scripts/ci/verify_model_comparison.py',
  'scripts/ci/verify_model_uncertainty.py',
]);

const modelDataEvidencePrefixes = [
  'scripts/data/',
  'scripts/model/',
  'data/manifest/',
  'tests/data/',
  'tests/model/',
];

const companionEvidenceFiles = new Set([
  'docs/asset-register.md',
  'docs/adr/0006-local-character-preview.md',
  'docs/character-preview-verification.md',
  'docs/evidence/companion-r2-v1.json',
  'web/playwright.companion-asset.config.ts',
  'web/scripts/generate-companion-manifest.mjs',
  'web/scripts/verify-companion-manifest.mjs',
  'web/src/ui/companionAssets.generated.ts',
]);

const companionEvidencePrefixes = ['tools/companions/', 'tools/character-preview/'];

const localReliabilityFiles = new Set([
  '.python-version',
  'scripts/ops/measure_api_p95.py',
  'scripts/ci/verify_api_p95_evidence.py',
  'docs/evidence/local-reliability.json',
  'docs/api-p95-verification-preflight.md',
  'docs/upgrade-local-reliability.md',
]);

const localReliabilityPrefixes = ['tools/local-reliability/'];

function matches(file, files, prefixes = []) {
  return files.has(file) || prefixes.some(prefix => file.startsWith(prefix));
}

function add(modules, module) {
  if (!modules.includes(module)) modules.push(module);
}

export function selectPrBrowserModules(files) {
  const unique = [...new Set(files.filter(Boolean))];
  if (unique.length === 0) return ['core'];
  if (unique.every(file => selectorFiles.has(file) || file === '.github/workflows/browser-e2e.yml')) {
    return ['policy'];
  }

  const relevant = unique.filter(file => !file.startsWith('docs/') || modelFiles.has(file) || assetFiles.has(file));
  if (relevant.length === 0) return ['policy'];
  if (relevant.some(file => dependencyFiles.has(file))) return ['core', 'journey-full', 'scene', 'model', 'assets'];

  const modules = [];
  for (const file of relevant) {
    if (selectorFiles.has(file)) continue;
    if (appShellFiles.has(file)) {
      add(modules, 'core');
      add(modules, 'journey-full');
      continue;
    }
    let matched = false;
    if (broadJourneyFiles.has(file)) { add(modules, 'journey-full'); matched = true; }
    if (matches(file, modelFiles, modelPrefixes)) { add(modules, 'model'); matched = true; }
    if (matches(file, assetFiles, assetPrefixes)) { add(modules, 'assets'); matched = true; }
    if (matches(file, sceneFiles, scenePrefixes)) { add(modules, 'scene'); matched = true; }
    if (matches(file, journeyFiles)) {
      add(modules, 'journey');
      matched = true;
    }
    if (matches(file, authCoreFiles, corePrefixes)) { add(modules, 'core'); matched = true; }
    if (!matched && (file.startsWith('web/') || file.startsWith('tools/'))) add(modules, 'core');
  }
  if (modules.includes('journey-full')) {
    const fastJourney = modules.indexOf('journey');
    if (fastJourney !== -1) modules.splice(fastJourney, 1);
  }
  return modules.length > 0
    ? ['core', 'journey', 'journey-full', 'scene', 'model', 'assets'].filter(module => modules.includes(module))
    : ['policy'];
}

export function describePrBrowserProfile(modules) {
  if (modules.includes('journey-full')) return 'broad';
  if (modules.includes('journey')) return 'fast';
  if (modules.length === 1 && modules[0] === 'policy') return 'policy';
  return 'focused';
}

export function selectPrEvidenceModules(files) {
  const unique = [...new Set(files.filter(Boolean))];
  if (unique.length === 0) return ['model-data', 'companion-assets', 'local-reliability'];
  if (unique.every(file => selectorFiles.has(file) || file === '.github/workflows/evidence-controls.yml')) {
    return ['policy'];
  }

  const modules = [];
  for (const file of unique) {
    if (matches(file, modelDataEvidenceFiles, modelDataEvidencePrefixes)) add(modules, 'model-data');
    if (matches(file, companionEvidenceFiles, companionEvidencePrefixes)) add(modules, 'companion-assets');
    if (matches(file, localReliabilityFiles, localReliabilityPrefixes)) add(modules, 'local-reliability');
  }
  return modules.length > 0
    ? ['model-data', 'companion-assets', 'local-reliability'].filter(module => modules.includes(module))
    : ['policy'];
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
  const browserModules = selectPrBrowserModules(files);
  const browserProfile = describePrBrowserProfile(browserModules);
  const evidenceModules = selectPrEvidenceModules(files);
  console.error(`browser modules: ${browserModules.join(', ')}`);
  console.error(`browser profile: ${browserProfile}`);
  console.error(`evidence modules: ${evidenceModules.join(', ')}`);
  console.error(`changed files: ${files.join(', ') || '(none)'}`);
  process.stdout.write(`browser_modules=${JSON.stringify(browserModules)}\n`);
  process.stdout.write(`browser_profile=${browserProfile}\n`);
  process.stdout.write(`evidence_modules=${JSON.stringify(evidenceModules)}\n`);
}
