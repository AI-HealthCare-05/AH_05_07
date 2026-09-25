# ADR 0009 — W1 Rapier dependency isolation spike

Status: **PROPOSED / W1 protected dependency decision**  
Scope: `web/transcend-lab/` only.

## Decision

The first spike attempted the normal browser/Vite package `@dimforge/rapier3d@0.20.0`.
A disposable Vite **7.3.6** reproduction outside the repository confirmed that
the normal package fails at build time in `vite:wasm-fallback` because the
`"ESM integration proposal for Wasm" is not supported currently`. Adding a
community WASM plugin would introduce another dependency before the physics
candidate itself is proven, so this spike instead selects Dimforge's official
`@dimforge/rapier3d-compat@0.20.0` package. Admit the compat package only through
the isolated Transcend Lab module graph.

This ADR does **not** approve production integration. Task 7 may use this
candidate only after this protected spike is reviewed and merged.

## Why this candidate

W1 already uses Three.js for rendering and needs a bounded kinematic character
controller, not a second rendering/application framework. Rapier exposes a
position-based kinematic body, capsule collider, character controller,
autostep, slope limits, ground queries, shape/query APIs, and explicit world
cleanup while remaining separable from the normal product bundle.

The spike deliberately uses a dynamic Lab-only import. A generation fence is
checked after the import resolves and before a World can become live. Stop/reset
invalidates the generation, removes the character controller, and frees the
Rapier World/WASM allocations.
## Bounded fixture

The executable browser probe creates only synthetic geometry:

- flat ground;
- one wall;
- one low step;
- one rotated slope;
- one position-based kinematic capsule.

It computes bounded candidate movement toward the wall, step, slope and ground.
These values are evidence that the package/controller executes; they are **not**
final W1 tuning gates and do not authorize Task 7 collision semantics.

## Isolation

- Only `@dimforge/rapier3d-compat@0.20.0` is declared in `web/transcend-lab/package.json`; the failed normal package is not retained.
- The Lab transitive-module verifier explicitly allowlists
  `@dimforge/rapier3d-compat` and continues to reject every other unapproved package.
- The normal product build remains independent.
- The product-isolation scan rejects Rapier package/runtime markers in
  `web/dist`; no Lab/WASM dependency is accepted as product output evidence.

The compatibility package is larger: npm metadata reports **10,170,768 bytes**
unpacked versus **3,487,655 bytes** for the normal package. The measured Lab
build emits a separate Rapier chunk of about **2.86 MB minified / 1.08 MB gzip**.
Those measurements are evidence for keeping the spike Lab-only, not production
performance or release budgets.

### Correction after PR #739 — exact package resolution

The initial hosted run reporting `0.12.0` did **not** execute the approved
0.20.0 package. The hosted entry installed only `web/package-lock.json`, so an
uninstalled Lab dependency resolved the ancestor copy brought by `@types/three`.
A clean before/after reproduction confirmed `RAPIER.version()` is `0.12.0`
for that ancestor copy and `0.20.0` after installing the unchanged Lab lock.
The earlier interpretation as merely an engine diagnostic was incorrect.

The Lab test entry now installs its own lock, build/typecheck rejects missing,
wrong-version or symlinked Lab installs, and the browser requires runtime
`0.20.0` again. The approved package/version and production dependency graph
are unchanged. The earlier green run is not evidence of 0.20.0 execution.

## Cleanup and stale work

A live spike owns exactly one World and one character controller. Explicit stop
removes the controller before freeing the World. Repeated run/stop is bounded.

If stop/reset occurs while the dynamic import is pending, its generation becomes
stale. That completion may not publish a World or controller.
## Escalation trigger

Do **not** start a Babylon/Havok bake-off for ordinary setup friction. Escalate
only if the reviewed Task 6/7 evidence demonstrates a structural correctness,
bundling, cleanup, controller, or target-platform problem that cannot reasonably
be fixed inside the current Three.js + Rapier approach.

## Non-decisions

This ADR does not choose final capsule dimensions, speed, slope/step limits,
camera budgets, WebGPU, native/XR, production routing, or any API/data/model
behavior.
