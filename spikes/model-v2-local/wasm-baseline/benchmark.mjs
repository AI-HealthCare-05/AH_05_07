// Only aggregate timings/errors leave browser memory. No product integration.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const require = createRequire(path.join(root, 'web/package.json'));
const { chromium } = require('playwright');
let input = '';
for await (const chunk of process.stdin) input += chunk;
const config = JSON.parse(input);
input = '';
const publicFiles = {
  '/': { type: 'text/html', body: Buffer.from('<!doctype html><title>Isolated WASM core benchmark</title>') },
  '/ort.wasm.bundle.min.mjs': { type: 'text/javascript', body: await readFile(path.join(config.directory, 'ort.wasm.bundle.min.mjs')) },
  '/ort-wasm-simd-threaded.wasm': { type: 'application/wasm', body: await readFile(path.join(config.directory, 'ort-wasm-simd-threaded.wasm')) },
  '/core.onnx': { type: 'application/octet-stream', body: await readFile(path.join(config.directory, 'core.onnx')) },
};
const server = createServer((request, response) => {
  const file = publicFiles[request.url];
  if (!file) { response.writeHead(404); response.end(); return; }
  response.writeHead(200, { 'content-type': file.type, 'cache-control': 'no-store' });
  response.end(file.body);
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const runs = [];
let browser;
try {
  for (let trial = 0; trial < config.coldTrials; trial++) {
    // A fresh process avoids reusing a browser process's WASM compilation cache.
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ serviceWorkers: 'block' });
    const page = await context.newPage();
    await page.goto(origin);
    const cold = await page.evaluate(async ({ firstRow }) => {
      const start = performance.now();
      const ort = await import('/ort.wasm.bundle.min.mjs');
      const importMs = performance.now() - start;
      ort.env.wasm.numThreads = 1;
      ort.env.wasm.proxy = false;
      const sessionStart = performance.now();
      const session = await ort.InferenceSession.create('/core.onnx', { executionProviders: ['wasm'] });
      const sessionMs = performance.now() - sessionStart;
      const tensor = new ort.Tensor('float64', Float64Array.from(firstRow), [1, 35]);
      const runStart = performance.now();
      await session.run({ preprocessed: tensor });
      const firstInferenceMs = performance.now() - runStart;
      globalThis.baseline = { ort, session };
      return {
        importMs, sessionMs, firstInferenceMs,
        importThroughFirstInferenceMs: performance.now() - start,
        wasmThreads: ort.env.wasm.numThreads,
        crossOriginIsolated,
        resourceDecodedBytes: performance.getEntriesByType('resource').reduce((n, entry) => n + entry.decodedBodySize, 0),
      };
    }, { firstRow: config.rows[0] });
    await context.setOffline(true);
    const warm = await page.evaluate(async ({ rows, expected, warmIterations }) => {
      const { ort, session } = globalThis.baseline;
      const tensors = rows.map((row) => new ort.Tensor('float64', Float64Array.from(row), [1, 35]));
      let maxAbsError = 0;
      let mismatchCount = 0;
      // Compare every synthetic canonical-preprocessed row, keeping outputs in memory.
      for (let i = 0; i < tensors.length; i++) {
        const result = await session.run({ preprocessed: tensors[i] });
        const actual = result.probability.data[0];
        if (!Number.isFinite(actual)) throw new Error('Nonfinite core output');
        const difference = Math.abs(actual - expected[i]);
        maxAbsError = Math.max(maxAbsError, difference);
        if (difference > 1e-12) mismatchCount++;
      }
      // Warm-up and distribution exclude tensor construction and preprocessing.
      for (let i = 0; i < 20; i++) await session.run({ preprocessed: tensors[i % tensors.length] });
      const durations = [];
      for (let i = 0; i < warmIterations; i++) {
        const start = performance.now();
        await session.run({ preprocessed: tensors[i % tensors.length] });
        durations.push(performance.now() - start);
      }
      durations.sort((a, b) => a - b);
      const percentile = (p) => durations[Math.ceil(p * durations.length) - 1];
      // Single calls approach the browser's clock resolution. Repeated calls
      // per timing window provide a separately labelled amortized measurement.
      const batchMeans = [];
      for (let batch = 0; batch < 10; batch++) {
        const start = performance.now();
        for (let i = 0; i < 100; i++) await session.run({ preprocessed: tensors[i % tensors.length] });
        batchMeans.push((performance.now() - start) / 100);
      }
      batchMeans.sort((a, b) => a - b);
      await session.release();
      delete globalThis.baseline;
      return {
        maxAbsError, mismatchCount, comparedRows: rows.length,
        offlineAfterInitialization: !navigator.onLine,
        iterations: warmIterations,
        minMs: durations[0], p50Ms: percentile(0.5), p95Ms: percentile(0.95),
        maxMs: durations.at(-1), meanMs: durations.reduce((a, b) => a + b, 0) / durations.length,
        clockCaution: 'Zero single-call readings mean below observable timer resolution, not zero runtime.',
        amortized: {
          batches: 10, callsPerBatch: 100,
          minMsPerCall: batchMeans[0], p50MsPerCall: batchMeans[4],
          p95MsPerCall: batchMeans[9], maxMsPerCall: batchMeans[9],
        },
      };
    }, { rows: config.rows, expected: config.expected, warmIterations: config.warmIterations });
    runs.push({ cold, warm });
    const browserVersion = browser.version();
    await browser.close();
    browser = undefined;
    if (trial === config.coldTrials - 1) {
      process.stdout.write(JSON.stringify({
        browser: `Chromium ${browserVersion}`, playwright: require('playwright/package.json').version,
        coldDefinition: 'Fresh headless Chromium process; no-store loopback assets; import and session include uncompressed local fetch/compilation, excluding browser launch/navigation.',
        warmDefinition: 'Offline, after 20 warm-up calls; one preconstructed float64 [1,35] tensor per call; preprocessing and tensor allocation excluded.',
        fixtureCount: config.rows.length, absoluteTolerance: 1e-12, runs,
      }));
    }
  }
} finally {
  if (browser) await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
