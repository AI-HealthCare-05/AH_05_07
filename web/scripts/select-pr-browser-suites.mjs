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

export function selectPrBrowserSuites(files) {
  const unique = [...new Set(files.filter(Boolean))];

  // Fast lane is intentionally narrow. Any shared/global/unknown web change
  // falls back to the complete PR browser gate.
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
    }
    if (suites.length > 0) return suites;
  }

  return fullSuites.map(suite => ({ ...suite }));
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
