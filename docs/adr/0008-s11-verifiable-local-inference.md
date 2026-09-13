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

### Numerical boundary correction

Python's canonical BMI formula remains `weight / ((height / 100) ** 2)`.
Browser exponentiation is replaced by binary64 multiplication for the square.
The reported overflow case and adjacent height/weight operands are independent
oracle inputs. Normal product inputs retain the same formula and tolerance;
there are no new height/weight or health eligibility bounds.

Platform `pow` and multiplication can round the square differently. Exact
classification parity at every arbitrary IEEE-754 extreme is **not** claimed.
The browser examines the immediately adjacent representable divisors around its
rounded square. Only when that interval touches zero/infinity does it return the
existing `inference_unavailable` arithmetic failure. Only when division by an
interval endpoint rounds to zero/infinity does it return `input_invalid`, as
canonical semantic validation does for a nonpositive/nonfinite derived BMI.
These are narrowly defined numerical ambiguity regions around the existing
failure boundaries, not a new population eligibility policy. Python is unchanged.
A canonical input inside such a region may be conservatively rejected by the
browser; this is explicitly not exact success-class equivalence there. For
example, a maximum-finite BMI at height 100 is an intentional fail-closed control,
reported separately from exact differential parity. The adjacent-value interval
is not a proof of an error bound for every platform's `pow` implementation.
Divisor underflow/overflow and quotient underflow/overflow have separate tests.

### Evidence identity, resolution and trust

The evidence runner first captures the closed source scope, SHA-256 hashes and
local file versions (inode/ctime/mtime/size/mode), then checks those hashes against
a committed source identity. It verifies a separate Git archive of that commit,
using the same Vite configuration and Model V2 build plugin as production. Live
working-tree edits cannot change the tested archive. Immediately before atomic
evidence publication, both the archive and live scope must still match their
initial hashes and file versions. Even editing and restoring a guarded file
expires that run. Evidence always uses the **initial** hashes. No source or scope
change discovered during verification is accepted into a refreshed seal.

`guardedSources` in `verify-model-v2-assets.mjs` is the executable scope: canonical
adapter/inference/API projection, exporter/oracle/corpus, browser adapter/runtime/
errors/manifest/draft adapter, public model asset, verification entry and tooling,
Vite/TypeScript configuration, package and Python locks, LF rules and CI routing.
The full verification commit/tree identifies the archived source snapshot; the
hash map identifies the subset which must remain unchanged for evidence reuse.
Installed dependencies and Python/browser binaries remain trusted toolchain
inputs, not attested binaries.

The production Model V2 directory has a closed regular-file inventory, rejecting
all unexpected extensions, nested package/index directories, case variants and
symlinks. Draft-module, root and ancestor resolution-configuration competitors are also
rejected, including nearer TypeScript configurations. The shared Vite plugin requires all four expected production modules
to be resolved and rejects runtime imports outside that closed graph. Regression
tests build a real Vite alias replacement outside the directory as well as
creating temporary shadow candidates. No scene policy or application resolution
default outside this boundary changes.

After all three engines pass, `--seal` records the immutable source commit/tree,
canonical artifact digest, original source hashes and aggregate results. A
separate evidence commit follows the tested source commit. Prebuild verifies
current scope, hashes, pinned asset and evidence schema. The required `web` CI
job additionally reads the recorded commit's Git objects and compares its tree
and guarded blobs. Merely editing both a source hash and the seal while retaining
the verification commit fails that check. Full-history checkout supplies those
objects for this PR; if later history rewriting removes them, they must remain
fetchable by their immutable SHA (CI fetches the recorded SHA if absent) or a new
canonical run is required. Missing history fails closed. Ancestry is not required, so squash merge does not itself
invalidate an otherwise available verification source object.

**This proves source identity and consistency with a reviewed local-run report;
it does not independently authenticate successful execution.** A repository
writer can still fabricate a new source commit and aggregate report or alter the
verifier. A regression test explicitly demonstrates that limit. Git hashes are
not signatures from an independent runner, and ordinary CI without the private
artifact does not rerun canonical parity. Review of the artifact-present run
remains the trust anchor. No secret, self-signed seal, private artifact or
individual prediction is committed. Enforced independent execution attestation
would require a separately trusted artifact-present verifier, which this public
repository currently lacks. The seal's machine-readable claim states this limit;
manually relabeled PASS is not an authorized evidence-refresh procedure.

## Verification and rollback

Run from the repository root with the existing locked Python AI/app environment
and installed Playwright Chromium, Firefox and WebKit:

```sh
# Commit all guarded changes first; the runner rejects uncommitted source.
node web/scripts/verify-model-v2-parity.mjs /absolute/model-v2-r1-a.joblib --seal
node --test web/scripts/verify-model-v2-assets.test.mjs
node web/scripts/verify-model-v2-assets.mjs --history
# Commit the generated parity-seal.json separately after these pass.
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
