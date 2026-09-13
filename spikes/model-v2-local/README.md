# Verifiable Local Inference Boundary — isolated feasibility spike

Issue [#488](https://github.com/AI-HealthCare-05/AH_05_07/issues/488),
[ADR-0007](../../docs/adr/0007-isolated-local-inference-spike.md).
Baseline: `6fee72f9d011e458cbf771a107b62ffc9dd754db` from live canonical main.
P0 tactile and P1 Living Replay are completed baseline features, not candidates.

The frozen Model V2 can be evaluated locally, with its mixed input semantics,
Python numerical parity, browser request/storage behavior and artifact identity
checked together. This directory has no import, route, dependency or configuration
connection to `web/src`, the production API, Cloudflare or the database.

## Reproduce

Use the existing locked Python AI/app environment and `web/node_modules`.
Playwright Chromium, Firefox and WebKit must be installed (`node
web/node_modules/playwright/cli.js install chromium firefox webkit`). The actual
canonical artifact is required; a missing or mismatched artifact aborts without
rebuilding or replacing it.

```sh
node spikes/model-v2-local/verify.mjs /absolute/path/to/model-v2-r1-a.joblib
SK7_CANONICAL_ARTIFACT_PATH=/absolute/path/to/model-v2-r1-a.joblib .venv/bin/python -m pytest spikes/model-v2-local/test_export.py -q
.venv/bin/python spikes/model-v2-local/wasm-baseline/run.py --artifact /absolute/path/to/model-v2-r1-a.joblib
```

The first command checks strict TypeScript, exports twice, builds the isolated
entries, reads synthetic cases and canonical oracle results through local pipes,
runs the browser proof, then prints an aggregate summary and its external path.
It writes no prediction/input arrays, traces or screenshots. The generated
model/manifest/build stay in unique external temporary directories. Do not
redirect `oracle.py` output to files or publish those directories.

To inspect the synthetic demo, use the output directory printed by verification:

```sh
SK7_SPIKE_OUTPUT=/absolute/export/directory node web/node_modules/vite/bin/vite.js preview --config spikes/model-v2-local/vite.config.mjs --host 127.0.0.1
```

This serves only a local experiment. Stop it with Ctrl-C. No sign-in or real
clinical data belongs in this harness.

## Frozen behavior and falsifiable acceptance

- Verify canonical SHA `d0f3bc407edae83db0852e9b393831b02cc5420a49fbc447d8d108f99c69ed84`
  before deserialization. Export fitted values only; never call `fit`.
- Preserve `model-v2-r1-schema-v1`, 11-feature order, six numeric and five
  categorical features. Median/scale and 29 one-hot columns yield 35 values.
  Sex remains numeric 1/2; its null becomes an all-zero encoded block. The other
  four category groups have fitted `__missing__` categories.
- Mirror the complete 19-field product adapter, structural no-walk/non-drinking
  rules, BMI without new rounding, G3 sleep clock adjustment and bedtime-only
  `00` → `24` normalization. Product nulls are rejected. Nullable semantic test
  cases do not authorize incomplete S11 input.
- Compare actual canonical adapter, fitted preprocessing and internal numeric
  score; absolute score tolerance `1e-12`, intermediate relative/absolute
  tolerance `1e-12 * max(1, abs(expected))`. Compare exact API projection from the
  canonical router helper: only `schema_version` and `product_wording`.
- Deliberately alter a coefficient, replace scores with a constant and truncate
  results: the parity checker must reject all three. Poison computation before
  the public call: it must fail rather than return the constant projection.
- After readiness, run all cases and warm inference without any new request.
  Inspect startup methods, exact asset URLs, query, headers and body; observe
  Web Storage, IndexedDB, CacheStorage, cookies, beacons, sockets, EventSource
  and service-worker registration. Use deliberate synthetic POST/storage writes
  as positive controls. Verify empty persisted state and offline warm execution.
- Pin exported SHA into the build, not a fetched manifest. Hash before parsing;
  fail closed for missing/malformed/tampered/oversized artifacts, unavailable
  WebCrypto and stalled loading. Size bound 32 KiB, deadline eight seconds;
  oversized streaming must cancel. No fallback API request or automatic retry.
- Keep canonical model bytes and individual inference results out of Git and
  all spike code out of the product build. Synthetic fixture input source is
  retained; verification evidence contains only sanitized aggregates.

`verification.html` is a separate test entry exposing internal synthetic
diagnostics to Playwright's local automation pipe. It is not the demo's public
projection or an application telemetry channel. The demo exposes only the two
product fields. Numeric outputs and model parameters remain inspectable by a
browser owner; this is an explicit disclosure tradeoff.

## Candidate decision

Weights: contract fit 25, technical validity 20, verifiable proof 15, demo impact
15, distinctiveness 10, simplicity 10, efficiency 5. Scores are engineering
judgments, not measurements or a claim of a global percentile.

| Candidate | Score | Evidence / upside | Main risk | Decision |
| --- | ---: | --- | --- | --- |
| A — verified local inference | 89 (22/20/15/13/8/7/4) | Actual frozen computation with executable parity/privacy/integrity boundary | Browser model disclosure; duplicated adapter maintenance | Selected isolated spike |
| C — stronger health-fact noninterference harness | 78 | Existing event type and browser tests provide much of it already | Limited incremental differentiation | Reject expansion |
| B — secure embed | 68 | Real cross-origin iframe/message boundary is feasible | No established partner requirement; auth/session/embed support | Defer |
| Experiential spatial comparison lens | 61 | Could make comparison visible | Mostly repackages existing day selection/report experience | Reject |
| Stop expansion → release polish | — | Preserves stable product | No new engineering capability | Fallback if A fails its proof |

LoRA/retraining, BP/challenge-derived training labels, WebGPU for prestige,
ZK-as-measurement-truth, Shadow-DOM-as-security and an LLM advisor were rejected.
Public-response parity alone was also rejected: successful current responses
are constant and cannot prove the model executed. Generic artifact hashing or
companion look/tactile behavior would repeat existing work.

## Measurements

Final source-identified measurements are recorded below after verification of
the committed candidate. They are synthetic, local desktop evidence, not current
production or physical-device evidence.

## Limits and next decision

The experiment preserves the nonnumeric display contract; it does not preserve
server-only model confidentiality. Hash checking does not attest remote
execution, resist a compromised bundle/origin or establish self-report truth.
Network/storage assertions establish the tested application behavior, not a
universal guarantee against browser extensions or future code. They do not make
the existing production S11 local, offline or free of inference requests.

No retraining, recalibration, health-semantic changes, auth changes, persistence,
Cloud Run removal, new service, production activation, deployment or main merge
is part of this work. Memory, real-network latency, physical iOS/Android,
production server latency/cost and WebGPU performance are `NOT_MEASURED`.
Headless WebKit is not a physical Safari-device qualification.

The WASM comparison is explicitly **linear-core only**; its warm timings exclude
browser preprocessing and adapter work, unlike the small runtime's complete
product call. It is not a fair universal engine-speed comparison. Its exact
published dependency cost is sufficient to reject that runtime for this spike.

Next: review whether the measured privacy gain justifies browser disclosure of
the frozen model before deciding on any S11 integration.

Official research: [sklearn mixed pipeline conversion](https://onnx.ai/sklearn-onnx/auto_examples/plot_complex_pipeline.html)
documents the string-imputation complication;
[ORT deployment](https://onnxruntime.ai/docs/tutorials/web/deploy.html) describes
WASM-specific delivery; [ORT WebGPU guidance](https://onnxruntime.ai/docs/tutorials/web/ep-webgpu.html)
explicitly allows lightweight models to retain WASM;
[WebCrypto digest](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/digest)
defines byte hashing rather than attestation. B requires actual origin separation
and checked messages, per [postMessage](https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage).
