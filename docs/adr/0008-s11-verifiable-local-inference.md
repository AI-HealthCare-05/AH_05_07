# ADR-0008: verified frozen Model V2 inference in S11

Status: accepted for source integration by the user's explicit 2026-09-13
human decision; [Issue #490](https://github.com/AI-HealthCare-05/AH_05_07/issues/490).
Production deployment requires separate approval. This is not G10 displayability PASS.

## Decision and scope

S11 validates its existing 19-field transient input and runs the canonical
11-feature adapter, fitted preprocessing and frozen computation in the browser.
The product facade returns exactly `schema_version` and `product_wording` after
computation; the UI keeps `입력 기반 위험군 선별 신호` and the existing completion
and safe error states. No score, probability, percentile, band, BP/challenge join,
input/result persistence, telemetry, new dependency or server fallback is added.

The user accepts that browser owners can inspect fitted parameters and reconstruct
internal continuous outputs. This is a disclosure tradeoff, not permission for the
application to show numeric results. Hash verification establishes loaded-byte
identity; it does not establish confidentiality, attestation or safety against
modified same-origin code. This decision does not authorize real-user data expansion.

The deterministic JSON is exported from the existing SHA-verified joblib artifact,
without training, recalibration, reconstruction or participant data access.
Canonical identity stays `d0f3bc407edae83db0852e9b393831b02cc5420a49fbc447d8d108f99c69ed84`.
The browser representation is 2,279 bytes with SHA-256
`67c6a2d24ab6f4f54d6199bc3fd4cb4215c571dba80e71dbe08b32a7c979ac0c`.
The checked-in manifest pins that digest into the JS build, never through a
fetched manifest. The public JSON is an approved parameter export, not a change
to the frozen canonical artifact.

Each explicit submission validates before fetching the asset with no-store,
omitted credentials, no referrer and rejected redirects. Streaming is bounded
to 32 KiB; an eight-second deadline covers response, body and digest. Hashing
precedes parsing/use. Missing, tampered, malformed or oversized assets, unavailable
WebCrypto, stalled loading, invalid inputs/categories and arithmetic failures
fail closed. Only a deliberate user retry starts another load. No input or result
is cached for later interactions; fitted parameters are loaded per submission. S11 still requires the existing signed-in shell, locks
pending submissions and ignores completion after session identity changes or
unmount. Auth events and authenticated server/data operations retain their guards;
local inference no longer uses an inference-endpoint 401 to discover session expiry.

## Alternatives and drift control

The isolated [PR #489](https://github.com/AI-HealthCare-05/AH_05_07/pull/489),
head `ad2b07d643cde2078e7bf1d1622af7f57f75a14e`, establishes feasibility only.
Its measured 3,594,551 gzip-byte ONNX WASM runtime cost does not justify a new
runtime for this frozen scalar model. No ONNX, WebGPU or ML framework is adopted.
Keeping server-only inference would retain the feature-bearing request. A shared
cross-language framework would add scope without a demonstrated need.

Production modules and tests are promoted into normal source/test locations;
they import no spike code. Python remains canonical. The differential runner
compares adapter values, all 35 preprocessed columns, internal numeric output,
invalid/error classes and the actual API projection on a deterministic synthetic
corpus. Coefficient, preprocessing, constant-output and truncated-result mutants
must fail; a poisoned calculation must block the public projection. S11 draft-to-DTO
checks cover the exact 19 fields and review edits.

After all three browser engines pass against the actual frozen artifact, `--seal`
records hashes of the exact canonical and browser sources. Prebuild/CI rejects
changed bytes, changed scope or a changed model digest. LF attributes keep those
hashes portable. CI validates this evidence's source scope and failure controls;
it does not claim to rerun the real-artifact numeric oracle when the private
canonical artifact is unavailable. A source change requires the canonical parity
runner and review again, never a manually relabeled PASS or manually edited seal.

## Verification and rollback

Run from the repository root with the existing locked Python AI/app environment
and installed Playwright Chromium, Firefox and WebKit:

```sh
node web/scripts/verify-model-v2-parity.mjs /absolute/model-v2-r1-a.joblib --seal
SK7_CANONICAL_ARTIFACT_PATH=/absolute/model-v2-r1-a.joblib .venv/bin/python -m pytest tests/model/test_model_v2_browser_export.py -q
npm --prefix web run test:e2e:model-v2
npm --prefix web run build
```

The differential runner keeps individual synthetic inputs/diagnostics in process
pipes. It prints only aggregate counts/errors/timings and writes temporary model
exports/test bundles outside Git. The numeric test entry is outside the product
entry graph. S11 tests observe actual built application requests and Web Storage,
IndexedDB, CacheStorage and cookies, with unrelated synthetic auth state retained
and deliberate leak controls. They also cover pending locks, manual retry, timeout,
logout/account switch, midnight, fractional values, small viewports and reduced motion.
Desktop/headless tests do not establish physical mobile or production latency.

The authenticated server endpoint and client helper remain for compatibility and
separate retirement review. A rollback is an explicitly reviewed prior web release;
there is no automatic fallback or backend/data/schema change in this integration.
No runtime was deployed. Retain #489 unmerged as immutable feasibility evidence
while this integration is reviewed; after integration merge, close it as superseded
without merging its duplicate implementation. Main then has one browser runtime.
