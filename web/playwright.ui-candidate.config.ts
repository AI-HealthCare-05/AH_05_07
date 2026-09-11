import { defineConfig } from '@playwright/test';
const companionOff = process.env.SK7_UI_TEST_COMPANION === 'off';
export default defineConfig({
  testDir: './e2e',
  testMatch: companionOff ? ['ui-candidate.cases.ts', 'challenge-daily.cases.ts'] : ['ui-candidate.cases.ts', 'challenge-daily.cases.ts', 'recap-candidate.cases.ts', 'companion-production.spec.ts', 'session-privacy-boundary.spec.ts', 'model-v2-user-input-flow.spec.ts', 'model-v2-result-state.spec.ts'],
  outputDir: './test-results/ui-release/synthetic', workers: 1,
  reporter: [['list'], ['json', { outputFile: `test-results/ui-release/synthetic-${companionOff ? 'off' : 'production'}.json` }]],
  use: { baseURL: 'http://127.0.0.1:4173', screenshot: 'only-on-failure',
    launchOptions: { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] } },
  webServer: {
    command: 'npm run build -- --outDir test-results/ui-release/synthetic-build && npm run preview -- --outDir test-results/ui-release/synthetic-build --host 127.0.0.1 --port 4173 --strictPort',
    env: { VITE_SK7_UI_MODE: 'journey', VITE_SK7_SCENE_MODE: 'off', VITE_SK7_COMPANION_MODE: companionOff ? 'off' : 'production',
      VITE_SK7_E2E_MODE: '1', VITE_SK7_EVIDENCE_MODE: '', VITE_SK7_EVIDENCE_FIXTURE: '',
      VITE_API_BASE_URL: 'http://e2e.invalid', VITE_SUPABASE_URL: 'https://e2e.invalid', VITE_SUPABASE_PUBLISHABLE_KEY: 'e2e-test-publishable-key' },
    port: 4173, reuseExistingServer: false,
  },
});
