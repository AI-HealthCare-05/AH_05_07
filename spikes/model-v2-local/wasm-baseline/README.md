# Isolated ONNX/WASM linear-core baseline

Issue #488 experiment only. This measures the frozen fitted logistic core with
35 **already canonical-preprocessed float64** columns. It does not implement
the browser's 11-feature preprocessing, product adapter, or API result contract.
No production dependency, route, worker, environment or lockfile is changed.

From the repository root, with the existing verified `.venv`, `uv`, Node and
`web/node_modules` Playwright Chromium available:

```sh
.venv/bin/python spikes/model-v2-local/wasm-baseline/run.py --artifact /absolute/path/to/model-v2-r1-a.joblib
```

The command checks the canonical artifact SHA **before deserialization**, uses
the shared synthetic fixtures and Python oracle through memory-only pipes,
exports MatMul/Add/Sigmoid with fitted coefficients, and runs headless Chromium.
It never calls `fit`. ONNX 1.22.0 and NumPy 2.4.1 are resolved in an external uv
environment. ONNX Runtime Web 1.29.0 is downloaded as a public npm tarball with
pinned SHA-512 integrity, and only the WASM bundle and CPU binary are copied.
No npm installation script runs. A matching cache can be supplied with
`--runtime-tarball /absolute/path/to/package.tgz`.

All generated model/runtime files and aggregate evidence go into a unique
`/tmp/model-v2-wasm-baseline-*` directory. Do not commit generated model assets
or redirect the shared oracle's raw stdout to a file. No individual prediction
arrays are persisted. `aggregate.json` records only counts, errors, timing
distributions, versions, identities and byte costs.

Default measurement: five fresh browser processes with uncompressed no-store
loopback assets, CPU WASM, `numThreads=1`, proxy disabled; then 20 warm-up calls
and 200 timed single-row calls per process. Warm inference and fixture comparison
run with browser networking offline after initialization. Tensor construction
and canonical preprocessing are excluded from warm timing. Cold session time
includes local model/WASM load and compilation, but not browser launch.
Zero single-call readings mean below browser timer resolution. Ten additional
timing windows of 100 sequential calls report a separate amortized distribution.

Published-file gzip estimates are not measured internet transfer or installed
package size. Fresh-process headless desktop results establish neither mobile
performance nor full product parity. The exported model has tensor outputs;
ONNX-ML/ZipMap compatibility is outside this three-operator baseline.
