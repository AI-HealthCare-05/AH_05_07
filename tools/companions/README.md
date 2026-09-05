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
python tools/companions/glb_audit.py --asset-dir $OUTPUT --variant standard --output $NEW_STANDARD_REPORT
python tools/companions/glb_audit.py --asset-dir $OUTPUT --variant light --output $NEW_LIGHT_REPORT
```

Always use `--python-exit-code 1`: Blender otherwise can return exit 0 after a Python
assertion fails. A saved GLB is only a candidate. Inspect all views and every action
in the development viewer before setting a quality pass. `--clip greet --poses`
can diagnose one motion without rerendering every already-inspected pose.
For an additional review, use `--output NEW_EXTERNAL_DIRECTORY`; it must not exist.
`--views side,back --render` limits a corrective render to the selected views.
Existing PNGs and reports are refused, not replaced.
The four standard delivery views remain 1600×1800. For additional light-variant
shape comparisons, `--view-width 640` renders 640×720 views; it does not change
the GLB, pose renders or standard delivery requirement. Every report records the
actual PNG dimensions. Use browser playback and matched poses as well as these
static comparisons when reviewing the reduced mesh.

Final rendering defaults to Cycles. On the measured Intel host, EEVEE sometimes
saved an almost unlit frame among otherwise valid views or poses. This was not
limited to one camera or a second view. Preserve those diagnostic frames and render
affected deliverables with Cycles in a new output. A successful render exit code
alone does not qualify an image. Reports identify the actual engine, dimensions,
camera, input/source hashes and selected frames.

Before a new build, commit the exact authoring file bytes. Generation rejects a dirty
source and rechecks source/commit at the end. `rigged.blend` checkpoints the rigged
rest geometry before animation. The source `.blend` retains editable high-detail geometry, modifier/skin structure,
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
  Camera framing uses the union of sampled deformed vertices across all clips,
  fits both axes in the actual portrait frame and adds 25% scale margin. Bounds
  between sampled frames still require playback inspection.
- `glb_audit.py` independently reads real binary accessors, skin weights, indices,
  normals, four-second zero-start timelines, loop values, actual parent-coordinate
  root motion and generator Git bytes. Its synthetic corruption tests run on
  Windows/Linux without Blender or private assets. This is a bounded uncompressed
  SK7 profile, not the whole glTF conformance suite. Geometric diagnostics cannot
  replace art and motion inspection.
- These checks do **not** prove collision-free animation, foot planting, art quality
  or runtime frame rate. Inspect joints, contact, ears/tail/body intersections,
  front/side/back completeness and standard/light differences separately. Browser
  playback and reduced-motion/error handling are separate G5 evidence.
- Motion is in place, with vertical bounce where authored. No horizontal root
  translation or health-value-dependent expression is used. Idle includes real
  eyelid/eye-bone compression, not a camera or whole-object scale substitute.
- The root bone's **local Y** is vertical. Export shifts every clip to 0–4 seconds.
  Independent binary QA found and rejected earlier local-Z bounce and 1/24-second
  start-offset candidates; these were not counted as quality-passed assets.
- The shared hip/leg weights are continuous through the old height boundary and
  fade toward the centerline. A visible folded seam on an earlier rabbit candidate
  prompted the fix. Synthetic invariants cover normalized, bounded influences,
  boundary continuity and opposing-leg stress; actual repaired move poses were
  also inspected. None of these tests certifies every possible contact or pose.
- A cat candidate's tall oval ears did not read clearly as a cat in the actual
  front render. Cat/fox ears now use a broad embedded base and a tapered, rounded
  triangle profile. Closed-volume, mirror and tip-width controls are synthetic
  checks; species recognition and moving-ear contact still need actual renders.
- Any failed version remains stored with a reason. Only assets that pass the stated
  QA scope count as complete; final human design review is still pending.

### Explicit post-decimation skin control

A real red-panda and otter light build stopped because decimation joined neighboring
joint sets into five positive influences at two existing vertices. New material-cut
vertices were valid. The existing four-influence guard remains unchanged. After
reduction, only vertices exceeding that limit retain the four strongest weights
(with a joint-index tie break) and normalize, matching the existing GLB export
policy. Already-valid weights and all geometry stay unchanged; missing, negative,
non-finite or unnormalized input still fails. Each new variant manifest records
changed vertex counts and maximum discarded weight. Actual export, deformation and
visual review are still required even after the in-memory regression probe passes.

### Species correction from actual candidate review

The first capybara candidate had detached small ears in its front render and a
bear-like cream muzzle/triangular nose. Small ears now seat against their own
cranium profile, with the rotation pivot moved into the same attached base. This
also corrects the shared small-ear placement for otter and hedgehog; actual moving
contact must still be reviewed. The capybara uses a lower, deeper cranium and a
dedicated blunt rostrum with small paired nostrils and one quiet mouth line.
It has no visible tail mesh. The original stylistic dimensions are design choices;
the distinguishing high facial features and absence of an external tail were
checked against [San Diego Zoo's capybara description](https://animals.sandiegozoo.org/animals/capybara)
on 2026-09-06. No source photograph was copied into the asset.

Pure geometry checks cover closed rostrum surfaces, attached facial details and
the small-ear base/pivot within the cranium. They do not approve the new shape,
recognition or motion; new candidate renders and full playback remain required.
The penguin's current foot is a flattened rounded form, so its material name is
simply `Ochre feet`; a material label is not evidence of modeled webbing.

## Storage and resumption

Large editable sources, GLBs, renders and videos stay in the external run directory.
Do not add them or absolute private machine paths to the application repository.
The external run state, artifact manifest and `RESUME.md` identify the last verified
candidate. Never overwrite a previously verified candidate while regenerating.
Same-disk checkpoints are not independent backup. No paid Meshy job or external
asset upload is authorized by these scripts.

### Selected-asset inventory

After asset writers stop, run:

```text
python tools/companions/inventory.py --assets ASSETS --output NEW_INVENTORY_JSON
```

`ASSETS` is an explicit external root containing `catalog.json`. The output file
must not exist and its parent must exist. Only recognized direct artifacts in the
selected candidate folders are hashed. GLB and generator digests are compared with
the generated manifest; missing files and catalog statuses remain explicit.
Prior unselected version folders are listed without reading their contents.
The optional `rigged.blend` checkpoint is included when present. After video QA,
byte-identical copies named `motion-preview.webm` and `ground-preview.webm` may be
placed next to the selected asset. The inventory hashes these optional files; it
does not decode or approve them. The copy manifest links the original recording,
video checks and technical review. Preserve the originals and use exclusive copies.
Separate QA folders stay in the run manifest. Clip/triangle counts here are generated-manifest
declarations, not new binary or visual validation. File presence and successful
inventory never imply quality or completion approval. Use a new inventory filename
after the catalog changes, preserving every earlier snapshot.
