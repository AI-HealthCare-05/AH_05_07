import { defineConfig } from '@playwright/test';
import base from './playwright.ui-candidate.config';

const mode = process.env.SK7_UI_TEST_COMPANION === 'off' ? 'off' : 'production';

// Reuse the existing synthetic server, build, auth boundary and GL flags.
// This config neither changes CI nor disables any existing check.
export default defineConfig({
  ...base,
  testMatch: ['frontend-assets.cases.ts'],
  outputDir: `./test-results/frontend-assets/${mode}`,
  reporter: [['list'], ['json', { outputFile: `test-results/frontend-assets/${mode}.json` }]],
});
