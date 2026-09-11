import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e', testMatch: 'ui-normal.cases.ts', workers: 1,
  outputDir: './test-results/ui-release/normal-results',
  reporter: [['list'], ['json', { outputFile: 'test-results/ui-release/normal.json' }]],
  use: { baseURL: 'http://127.0.0.1:4182', screenshot: 'only-on-failure' },
  webServer: { command: 'node scripts/preview-ui-candidate.mjs', port: 4182, reuseExistingServer: false },
});
