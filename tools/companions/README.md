# Original local companions

These Blender authoring tools create original geometry, PBR materials, skin weights
and seven skeletal actions. They are not part of `web`, its bundle, any API, or a
model inference path. No clinical/model-input file is accessed. See
[execution record](../../docs/upgrade-execution.md).

## Local tools

- Blender **4.5.13 LTS**, Windows x64 portable; no administrator install.
- [Official ZIP](https://download.blender.org/release/Blender4.5/blender-4.5.13-windows-x64.zip)
  and [official release checksums](https://mirror.blender.org/release/Blender4.5/blender-4.5.13.sha256).
  Verified archive SHA-256: `b5fdf800ce65fa2f209e8f68d02667e4d720fa1c42f247c72d1882ab04decba6`.
- Blender's bundled Python, no project dependency/lock changes. The separate
  development viewer owns its renderer dependency decision.
- CPU renders use three threads at most. Coordinate an idle host for API or browser
  measurements; if other work overlaps, record it instead of claiming isolation.

## Regenerate a new candidate

Substitute explicit local paths. `OUTPUT` must not exist. Keep the previous candidate.

```powershell
& $BLENDER --background --factory-startup --threads 3 --python-exit-code 1 `
  --python tools/companions/build.py -- --species bear --output $OUTPUT
& $BLENDER --background --factory-startup --threads 3 --python-exit-code 1 `
  --python tools/companions/review.py -- --asset $OUTPUT --variant standard --render --poses
& $BLENDER --background --factory-startup --threads 3 --python-exit-code 1 `
  --python tools/companions/review.py -- --asset $OUTPUT --variant light --render
```

Always use `--python-exit-code 1`: Blender otherwise can return exit 0 after a Python
assertion fails. A saved GLB is only a candidate. Inspect all views and every action
in the development viewer before setting a quality pass. `--clip greet --poses`
can diagnose one motion without rerendering every already-inspected pose.

The source `.blend` retains editable high-detail geometry, modifier/skin structure,
materials and named actions. `standard.blend` and `light.blend` retain the two web
meshes. `generator.py` snapshots the exact authoring source; the manifest stores its
digest. The character name, special motion and asset provenance remain local.

## Quality scope

- Default budgets: standard about 32k triangles; light about 13.5k. Preserve small
  face details rather than force an exact count. PBR color/roughness factors need no
  image texture; zero textures is an intentional material choice.
- `review.py` starts a fresh scene and imports the GLB, checks one actual skeleton,
  all seven actions, skinned surfaces, finite deformation at 13 times per clip,
  and identical start/end bone matrices. It excludes the importer's hidden bone
  display widget from the mesh count. It renders the actual imported asset.
- These checks do **not** prove collision-free animation, foot planting, art quality
  or runtime frame rate. Inspect joints, contact, ears/tail/body intersections,
  front/side/back completeness and standard/light differences separately. Browser
  playback and reduced-motion/error handling are separate G5 evidence.
- Motion is in place, with vertical bounce where authored. No horizontal root
  translation or health-value-dependent expression is used. Idle includes real
  eyelid/eye-bone compression, not a camera or whole-object scale substitute.
- Any failed version remains stored with a reason. Only assets that pass the stated
  QA scope count as complete; final human design review is still pending.

## Storage and resumption

Large editable sources, GLBs, renders and videos stay in the external run directory.
Do not add them or absolute private machine paths to the application repository.
The external run state, artifact manifest and `RESUME.md` identify the last verified
candidate. Never overwrite a previously verified candidate while regenerating.
Same-disk checkpoints are not independent backup. No paid Meshy job or external
asset upload is authorized by these scripts.
