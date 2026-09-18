# World v2 Blender editable reimport gate

## Purpose

The World v2 Master archive does not contain native `.blend` authoring files for
koala, mouse, pig or owl.

Therefore this gate does not claim recovery of an original Blender authoring
source.

Instead it verifies that each immutable World v2 GLB can be imported into
Blender, saved as an editable Blender checkpoint, reopened, and retain the
required rig and animation structure.

## Scope

The gate covers all eight World v2 candidate binaries:

- koala lite
- koala standard
- mouse lite
- mouse standard
- pig lite
- pig standard
- owl lite
- owl standard

Each source binary is read from the audited Master archive and must match its
known SHA-256 and byte size before Blender is invoked.

## Blender checks

For each binary the gate requires:

- successful Blender glTF import
- at least one mesh
- exactly one armature
- at least one bone
- non-empty mesh vertices
- non-empty mesh polygons
- all seven expected actions:
  - celebrate
  - curious
  - greet
  - idle
  - move
  - rest
  - special
- successful editable `.blend` save
- successful reopening of that `.blend`
- matching structural metrics before save and after reopen
- SHA-256 identity for the saved `.blend` checkpoint

## Evidence boundary

The generated GLB copies, Blender checkpoints and detailed import/reopen reports
remain outside the repository.

Repository evidence contains only sanitized structural results and hashes.

## Interpretation

A PASS means the delivered World v2 GLBs are usable as editable Blender
checkpoints and survive a Blender save/reopen cycle with the required rig and
animation structure.

A PASS does not mean:

- the original native `.blend` authoring source was recovered
- the original modeling history or modifier stack was recovered
- visual/art acceptance is complete
- physical-device qualification is complete
- production delivery is complete
- active runtime promotion is approved

The World v2 family remains Candidate until the other promotion gates are
closed.
