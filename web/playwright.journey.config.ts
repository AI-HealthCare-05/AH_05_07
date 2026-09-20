import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: [
    'journey-candidate.cases.ts',
    'recap-candidate.cases.ts',
    'ui-candidate.cases.ts',
    'model-v2-result-state.spec.ts',
  ],
  grep: /(journey candidate primary action, input identity and navigation at 390x844|recap week reflection map order at 390x844|route enter reuses the viewport and does not repeat for typing, theme, or refresh|reduced motion, hidden documents, reports, and dialogs cancel only B9-owned motion|S11 retained synthetic fixture defaults to not_ready and exposes no result value|S11 remains usable at 390px)/,
  outputDir: './test-results/living-scene-review/journey-pr',
  workers: 1,
  reporter: [['list'], ['json', { outputFile: 'test-results/living-scene-review/journey-pr-report.json' }]],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    screenshot: 'only-on-failure',
    launchOptions: {
      args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    },
  },
  webServer: {
    command: 'npm run build && npm run preview -- --host 127.0.0.1 --port 4173 --strictPort',
    env: {
      VITE_SK7_UI_MODE: 'journey',
      VITE_SK7_SCENE_MODE: 'off',
      VITE_SK7_COMPANION_MODE: 'production',
      VITE_SK7_E2E_MODE: '1',
      VITE_SK7_EVIDENCE_MODE: '',
      VITE_SK7_EVIDENCE_FIXTURE: '',
      VITE_API_BASE_URL: 'http://e2e.invalid',
      VITE_SUPABASE_URL: 'https://e2e.invalid',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'e2e-test-publishable-key',
    },
    port: 4173,
    reuseExistingServer: false,
  },
});
