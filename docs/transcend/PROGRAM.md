# SK7 Transcend long-term program

Status: **CURRENT experimental-program authority**. This document owns long-term
Transcend direction only. It does **not** activate production behavior, assets,
API/DB/Auth/Model V2 changes, deployment, or release state.

The canonical source is `AI-HealthCare-05/AH_05_07`. At the start of every
task, resolve actual `origin/main`; a SHA recorded in this document or a prior
PR is historical context, not startup authority.

## Purpose

SK7 Transcend extends the current Living Journey toward an optional 3D living
world in which one companion can be controlled from a conventional third-person
camera and move through a connected spatial journey. The long-term world may
host locations for observation, challenge and recap, but important product work
continues to use semantic HTML/DOM surfaces and the existing product contracts.

The target is therefore not "move all UI into WebGL." The target is:

```text
3D world / movement / companion / spatial discovery
                      |
               Product bridge
                      |
semantic HTML / forms / navigation / accessibility
                      |
existing SK7 API / Auth / Data / Model boundaries
```

## Durable invariants

- Existing API, database, authentication, RLS, retention, account-deletion and
  Model V2 semantics remain outside world-renderer authority unless separately
  versioned and reviewed.
- Health values, risk/model output and challenge participation do not become
  implicit reward, emotion, scenery or medical animation inputs.
- Core tasks remain usable when 3D, WebGL/WebGPU, physics, sensors, camera,
  perception or dialogue are unavailable.
- A renderer or physics system may fail without changing product data or
  navigating to a domain-error route.
- Camera, microphone and motion sensing are future explicit opt-in capabilities,
  never prerequisites for the first world milestones.
- No world transform or product action has multiple unfenced authoritative
  writers.
- Human merge remains the final gate. Research and Lab success do not authorize
  production activation or deployment.

## Repository strategy

Keep the current repository and existing product. Use `web/transcend-lab/` as
the isolated experiment surface until the W1/W2 gates prove a stable world
runtime. Do not create a second repository merely because the experience becomes
game-like.

A future `web/transcend-world/` application is created only after all of the
following are true:

1. the W1 third-person slice works on physical Android Chrome and iPhone/iPad
   Safari at a usable quality tier;
2. input, simulation, camera and renderer ownership are stable without
   per-frame React state;
3. stop/reset/context/resource cleanup is deterministic;
4. a semantic non-3D route to the same test action exists;
5. the renderer/physics direction has survived an explicit review;
6. the world can remain isolated from product API/Auth/Model V2 until a later
   product-bridge gate.

The classic product remains the fallback while the world client matures.

## World track

| Track | Goal | Production meaning |
| --- | --- | --- |
| W0 | Program authority and bounded research | None |
| W1 | One isolated third-person playable slice | None |
| W2 | Minimal reusable world kernel after W1 evidence | None |
| W3 | One complete synthetic spatial interaction -> semantic DOM surface | None |
| W4 | Living Week alpha: connected weekday landmarks in a bounded world | None |
| W5 | Optional product-integration preview behind explicit review/rollback | Separate release decision required |
| W6 | Broader world journey with classic semantic fallback | Separate release decision required |
| W7 | Richer companion behavior; optional device/perception/dialogue lanes | Each capability separately reviewed |
| W8 | Conditional PWA/native/XR/large-world extensions | Evidence-driven only |

W1 is specified in [W1](W1.md). Do not pull later-track features into W1 to make
the prototype look more complete.

## Technology policy

Three.js/WebGL is the provisional W1 rendering baseline because the repository
already owns its asset, renderer, cleanup and browser evidence. This is not a
permanent engine commitment.

Trigger a focused Babylon.js/Havok or PlayCanvas bake-off only when measured
evidence shows that the current stack is blocked by engine/tooling cost rather
than by ordinary implementation work. Examples include persistent controller or
camera correctness problems after a bounded physics spike, world/content
tooling becoming the dominant delivery bottleneck, or a confirmed native/large
world requirement.

WebGPU remains a later progressive-enhancement experiment. W1 success must not
depend on WebGPU.

## Documentation and research lifecycle

Do not create a second project-management ledger.

- This file owns long-term Transcend direction.
- [W1](W1.md) owns the current first-playable experimental contract.
- Current task state and restart details stay in the task PR/body or the
  repository's existing project handoff mechanism.
- New research uses the existing `docs/research/` lifecycle.
- Durable architecture decisions with meaningful alternatives use the existing
  `docs/adr/` lifecycle.
- SHA/device-specific observations use the existing `docs/evidence/` lifecycle.
- Git history is the archive; do not append completed-task history to a
  permanent STATUS ledger.

Update this document only when the long-term program boundary, milestone model,
or durable engine/product strategy changes.
