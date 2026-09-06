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

The first penguin candidate also retained the shared protruding mammalian muzzle,
bifurcated smile and rounded ball tail. Its actual front/side render review stopped
further rendering. The penguin now has a closed tapered bill seated directly in
the cranium, a short low tapered tail and a broader breast material region on the
same closed skin. Its eye surroundings, palette, rig and seven clips stay intact.
Geometry tests check closed winding, analytic base overlap, bounded tail weights
and the unchanged other-species dispatch. Remeshed attachment, reduced-mesh material
cuts and species recognition still require a new candidate's actual render and
playback review; the former v001 remains stored as needing revision.

### Fox sitting and seal movement anchors

An actual fox source probe found feet below the authored ground during its sitting
motion. The two existing foot bones now use the root as parent for that species;
their special-action channels stay planted while pelvis and thighs move back/down.
The other six actions convert their former thigh-parent FK poses into root-relative
foot channels at the original keys. A fresh Blender in-memory probe checked 193
integer/half-frame sitting poses: sampled foot position/basis error was zero and
the minimum world Z stayed positive. The six actions reproduced their original
25 key poses within `1e-5`. Between-key interpolation is not identical: the largest
sampled move foot-position difference was about `0.0001241` authored scene units. Preserve
that result and inspect the new exported motion; do not claim exact continuous
reproduction or infer the final fox quality pass from this source probe.

The later actual `fox-v001` browser review passed playback, original opening,
resource and video checks, but failed the requested tail-wrap gesture. In the
standard/light side and rear-oblique special sequences, the short upturned tail
stayed behind the pelvis. The successful functional reports and failed candidate
are retained; a lowered body alone does not satisfy “꼬리를 감싸고 앉기”.

The next fox candidate uses one authored structural correction: a longer, low
curved tail, the same two tail bones with pivots aligned to that geometry, and a
quarter-turn at each hinge around the rest-space vertical axis. This routes the
tip around the right flank to the seated front. Two complementary smooth skin
weights bridge the joint. Horizontal tail rings use a fixed vertical frame to
avoid the generic tangent fallback reversing ring orientation. The existing
cream tip uses one exact cut along rest-length Y instead of the old upright
tail's Z threshold. Palette, twenty-bone count, seven clips, planted-foot setup
and the other species' authoring paths remain unchanged.

Pure checks cover closed winding, finite normalized weights, an embedded root,
front reach, distal clearance from the authored coat union, and positive-volume
nondegenerate cage deformation at 97 special phases. These are an independent
two-hinge linear-skin calculation of the actual authored cage, not Blender's
evaluated subdivision or a guarantee against every surface intersection. The
visible hip creases in `fox-v001` have not been diagnosed as self-intersections.
The new candidate still needs actual neutral side/rear views, special wrap/return
and hip/foot contact inspection, the existing import/original/playback/floor/video
gates, and human species/style review. Do not reuse `fox-v001`'s quality evidence
for the changed geometry or relabel its failed gesture as complete.

The seal's anatomical shear previously tilted the root bone and therefore sent a
local-Y bounce partly sideways. The root alone is now excluded from that shear;
the mesh, non-root anatomy and authored motion amplitudes remain unchanged. Pure
regression checks fail on the previous source. A fresh Blender armature-only probe
then checked all seven actions at 97 frames each: no sampled horizontal root motion,
matching loop endpoints, and the existing `0.09`/`0.16` move/celebrate heights.
This is a movement-anchor check without mesh creation, export or rendering. The
future seal still requires complete body/flipper deformation and playback QA.

For the penguin, inspect special at fractions `0.375` and `0.625` as well as a full
loop: quarter/midpoint stills miss its alternating spine roll. For the squirrel,
include `0.125`, `0.375`, `0.625`, `0.875` and continuous motion. A posed screenshot
at a zero crossing is not evidence that the authored movement is absent or approved.

### Quill tag lifetime in Blender

The first hedgehog build stopped because its quill attachment received all-zero
base tags. A single-quill memory probe reproduced the actual cause in Blender
4.5.13: SUBSURF preserved both weight groups, but the saved RNA group handles
reported index `-1` after modifier application. The authoring code now resolves
indices by name after the modifier and obtains a fresh handle for each deletion.
The same probe passed attachment and left no temporary groups after the fix.
The base-existence, `0.5` weight, finite-range and insertion-depth guards are
unchanged. The diagnostic command's exit 0 means it captured the former attachment
failure successfully; it does not turn the failed build into a pass.

The next hedgehog candidate passed that construction path, but its actual front/side
renders still showed a bear-like face, almost no frontal quill silhouette and seven
aligned comb rows. It remains a revision candidate. The current hedgehog-only design
uses a narrower cranium with preserved eye embedding, a small tapered snout/tip nose,
and 77 deterministic staggered quills: 55 across the back and 22 around the crown.
Authored lengths and directions vary without random sampling or new dependencies.
The same closed tube, fresh tag lookup and `0.04` evaluated-base embedding guard
remain in force. [San Diego Zoo's hedgehog description](https://animals.sandiegozoo.org/animals/hedgehog)
was checked on 2026-09-06 for the long snout and quill-covered back. Proportions and
placement are original stylization, not copied photographs or anatomical accuracy.

Pure tests apply the existing subdivision/attachment checks to all 77 new cages,
retain the old detached-cage negative fixture, and check closed faces, skin weights,
snout/nose overlap and all seven authored loop endpoints. They do not model the
actual remeshed skin or certify every animated quill intersection. Before selecting
a new candidate, inspect front/side/oblique crown visibility, base attachment,
quill spacing during curl/return and both exported variants in Blender and browser.
That source-only design change was followed by the native candidate checks below;
its pure test success did not constitute visual approval.

The first native build with that new crown layout then stopped at the existing
coat-height guard. A memory-only Blender probe of all 77 quills identified crown
indices 75/76: their evaluated base bands reached Z `2.590556`/`2.589648`, above
the authored head maximum `2.58`. The probe command succeeded in recording these
failures; it did not certify attachment. Native group tags used linear scalar
interpolation (`0.5`, `0.75`, `1.0` in the base band), whereas the prior pure
fixture smoothed tags with geometry and missed these vertices. Updating the
fixture reproduced both failing cages without changing the attachment guard.

The crown origins are now `0.04` lower; all 77 quills, tips' relative dimensions,
face design and the `0.04` base embedding guard remain. The corrected fixture
passes the existing attachment/topology tests. It is still an approximation of
OpenSubdiv geometry: the observed two native cages differ from pure coordinates
by up to about `0.0038` in nearest-point comparison. A new native 77-quill probe
and full candidate rendering are required before accepting this repair. The
failed `hedgehog-v003` and original reports remain unchanged.

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
