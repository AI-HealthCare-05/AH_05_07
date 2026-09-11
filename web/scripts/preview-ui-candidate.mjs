import { execFileSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Normal local build: no harness, evidence fixture, injection or test authentication.
// Explicit public test config exercises the real login boundary without an account.
const web = fileURLToPath(new URL('../', import.meta.url));
const outDir = 'test-results/ui-release/normal';
const env = { ...process.env,
  VITE_SK7_UI_MODE: 'journey', VITE_SK7_SCENE_MODE: 'off', VITE_SK7_COMPANION_MODE: 'production',
  VITE_SK7_E2E_MODE: '', VITE_SK7_EVIDENCE_MODE: '', VITE_SK7_EVIDENCE_FIXTURE: '',
  VITE_API_BASE_URL: 'http://api.ui-candidate.invalid',
  VITE_SUPABASE_URL: 'https://auth.ui-candidate.invalid',
  VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_local_candidate_not_a_real_key',
};
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
execFileSync(npm, ['run', 'build', '--', '--outDir', outDir], { cwd: web, env, stdio: 'inherit' });
if (!process.argv.includes('--build-only')) {
  const server = spawn(npm, ['run', 'preview', '--', '--outDir', outDir, '--host', '127.0.0.1', '--port', '4182', '--strictPort'], { cwd: web, env, stdio: 'inherit' });
  for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => server.kill(signal));
  server.on('exit', code => process.exit(code ?? 0));
}
