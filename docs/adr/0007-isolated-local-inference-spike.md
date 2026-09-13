# ADR-0007: isolated frozen Model V2 browser execution experiment

Status: accepted for the local synthetic feasibility experiment in
[Issue #488](https://github.com/AI-HealthCare-05/AH_05_07/issues/488).
Production adoption, product integration and model disclosure remain undecided.

The current product sends 19 adapter fields to the authenticated API. Its
successful response contains two constants after actual inference. Eliminating
that feature-bearing request is a measurable privacy-boundary change; comparing
only those constants would not establish model parity.

The verified 6,923-byte frozen artifact contains six numeric transforms, five
categorical encodings and a binary 35-coefficient logistic regression. The
experiment exports only those fitted parameters, without fitting or participant
data access. The deterministic representation is 2,279 bytes. A bounded scalar
TypeScript evaluator preserves numeric float64 operations and the mixed feature
semantics, with canonical Python differential tests for adapter, preprocessing,
internal score and the public projection. It is not a general inference engine.

The chosen runtime adds no dependency. As a comparison tool only, an external uv
environment uses ONNX 1.22.0/NumPy 2.4.1 to serialize the fitted linear core;
ONNX Runtime Web 1.29.0 is downloaded with pinned SHA-512 and no install scripts.
This experiment does not adopt those packages into the AI toolchain, web
package, lockfiles, CI or production. This limited exception follows the local
tool pattern of ADR-0006; ADR-0002 still governs production/toolchain adoption.
ONNX and ONNX Runtime use Apache-2.0 and MIT licenses respectively; third-party
binaries are not redistributed in Git.

Alternatives:

- Full ONNX pipeline: mixed/string missing handling and tensor output options
  require explicit conversion work. The measured default CPU runtime alone is
  14,034,739 raw / 3,594,551 gzip bytes. Its isolated float64 linear-core baseline
  is retained as a reproducible comparison, not a full adapter implementation.
- WebGPU: no demonstrated need for this small scalar model; adds runtime and
  compatibility work. No WebGPU speed claim or benchmark result is made.
- New cross-origin embed: feasible, but no measured partner integration need.
- Keep server-only inference: retains model confidentiality and the current
  authentication boundary. It remains the unchanged production architecture.

Browser model bytes must match a digest pinned into the local build before
parsing. Loading is bounded to 32 KiB and eight seconds, then fails closed.
No server fallback, runtime model input/result persistence or telemetry exists
in the spike. Generated model files stay outside Git and the product web build.
The loopback test server ends when verification ends; it is not a deployment
topology or service addition. Stopping the local server/removing the experiment
reverts its availability without a runtime rollback.

This verifies loaded-byte identity, not attestation, confidentiality or protection
from compromised same-origin JavaScript. Browser users can inspect parameters
and recover numeric outputs; keeping the UI nonnumeric does not hide them. The
experiment cannot bypass or replace product authentication. Any integration
decision must address that disclosure and authentication separately, preserve
the frozen contract and retain a nonnumeric UI. Physical mobile performance,
real-user privacy and production readiness are not established by desktop tests.

Acceptance and measured scope are in the [spike report](../../spikes/model-v2-local/README.md).
