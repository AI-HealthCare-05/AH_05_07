# SK7 Transcend W1 — bear `move` root-translation inspection

Status: bounded evidence for W1 Task 2 / Issue #730.

## Scope

This record answers one question only: whether the existing qualified bear v007
`move` clip may be used as **visual in-place locomotion** while physics retains
exclusive authority over actor world translation.

No production behavior, deployment, API/DB/Auth/RLS/Model V2 semantics, asset
activation, dependency, controller, camera, or physics implementation is changed.

## Source authority

- Repository baseline inspected: `3f41e10b654b6f78c7bbc48c9ef3cb02305e38d8`
  (`chore: add GitHub task resume helper (#729)`).
- W1 authority: `docs/transcend/W1.md`, bounded implementation sequence Task 2.
- Original bear v007 generator commit recorded by the repository:
  `98752a3996cf1844783a9d250bd88761b2be1e70`.
- Existing exact-byte structural forensic record source commit:
  `9361983ea00afa244da560ac62f0d533e9f9e942`.

## Exact assets

| Variant | Asset ID | Source file | Bytes | SHA-256 |
| --- | --- | --- | ---: | --- |
| lite | `COMPANION-R2-001` | `bear-v007/light.glb` | 518,636 | `7960a83fc11ffb57943227172caebe0dbabbd78a84f302d69df50e8ddcbc4874` |
| standard | `COMPANION-R2-002` | `bear-v007/standard.glb` | 1,032,708 | `48bfc97022f9799c2dccc58c0d0037a4cf06e846147e9b81864b814a5b214712` |

The current review catalog marks both exact identities as verified, self-contained
GLBs with the complete seven-clip set, including `move`.

## What the generated motion does

At the recorded bear v007 generator commit, the rig root is authored from
`(0, 0, 0)` to `(0, 0, 0.25)`. Repository QA documents that the root bone's local
Y axis is world vertical.

For `move`, the generator resets every bone transform each sample and then authors
only this root translation:

`root.location.y = 0.045 * (1 - cos(2a))`

Across the 25 authored samples from frame 1 through 97, this is a looped vertical
bounce from `0` to a maximum of `0.09` authored scene units and back to `0`.
The generator does not author root X/Z travel for bear `move`.

The leg and arm swing remains skeletal pose animation. Therefore the intended
clip is an in-place visual motion, not a world-space locomotion source.

## Binary-audit contract

`tools/companions/glb_audit.py` is the repository-owned, dependency-free binary
accessor audit. It evaluates root translation after transforming translation
differences through static ancestor transforms. For root translation channels it:

1. computes translation differences from the clip start value;
2. converts those differences to parent/world orientation;
3. measures horizontal X/Z magnitude;
4. rejects the asset with `horizontal_root_motion_not_in_place` when the horizontal
   component exceeds `1e-5`;
5. reports the bounded value as `clips.<name>.root_horizontal_max_delta`.

Its corruption tests explicitly exercise the world-axis conversion and verify that
horizontal root motion is rejected while vertical-only motion remains below the
horizontal tolerance.

The companion QA record states that the selected assets were inspected with the
independent binary parser and a fresh Blender GLB import, including exact original
hashes, skins/clips, finite deformation and loop endpoints. The companion tooling
record separately states the accepted motion contract: in-place motion with
vertical bounce where authored and no horizontal root translation. Earlier
incorrect root-axis candidates were rejected rather than counted as passed assets.

The existing structural forensic record for the exact lite and standard SHA values
also confirms a 4-second `move` clip with the expected skeletal translation targets;
it correctly warns that translation targets alone do not prove root motion, which
is why the binary root-motion audit contract above is the deciding evidence.

## W1 decision

**Eligible with the existing W1 ownership rule.**

- The bear v007 `move` clip may drive **visual pose only** for W1 locomotion.
- Physics / WorldSpace remains the sole owner of actor world X/Z translation.
- The authored vertical root bounce is visual animation and must not be fed back
  into physics position or treated as root-motion locomotion.
- Do not use animation displacement as controller input, accumulated travel, or
  authoritative actor position.

The evidence supports **no material horizontal root translation**. The repository
binary auditor's acceptance boundary is `<= 1e-5` in its audited world-horizontal
metric; this record does not invent a more precise per-asset number that was not
preserved in the checked-in evidence.

## Current-session limitation

This session could read GitHub repository authority but could not reacquire the
external GLB bytes: ordinary `git clone` and direct asset downloads failed because
outbound DNS/network access is unavailable in the execution environment. Therefore
this record reconciles the repository's existing exact-byte QA, exact asset hashes,
original generator source and current binary-audit rule; it does **not** claim a
new same-session binary download or a newly computed asset hash.

If a same-session byte reacquisition is required before merging, run the commands
below on a trusted workstation that has the preserved external `bear-v007` asset
directory. A hash/byte mismatch is a hard stop.

```bash
python tools/companions/glb_audit.py \
  --asset-dir "$ASSET_ROOT/bear-v007" \
  --variant light \
  --output "$OUT/bear-v007-light-root-audit.json"

python tools/companions/glb_audit.py \
  --asset-dir "$ASSET_ROOT/bear-v007" \
  --variant standard \
  --output "$OUT/bear-v007-standard-root-audit.json"
```

Recheck before accepting:

- lite bytes/SHA match `518636` / `7960a83f...cbc4874`;
- standard bytes/SHA match `1032708` / `48bfc970...b214712`;
- both reports contain `move`;
- `clips.move.root_horizontal_max_delta <= 1e-5`;
- the audit exits successfully without `horizontal_root_motion_not_in_place`.

## Boundary carried forward

Task 3 and later W1 work must preserve the rule already owned by `docs/transcend/W1.md`:
physics owns actor world translation; animation owns visual pose. This evidence does
not authorize a physics dependency or any product integration.
