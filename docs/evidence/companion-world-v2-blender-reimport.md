# World v2 Blender editable reimport evidence

## Result

Blender editable reimport gate: **PASS**

World v2 binaries checked: **8 / 8**

Blender version: `5.2.1 LTS`

Production-ready: **No**

Original native `.blend` recovered: **No**

## What passed

Each World v2 GLB:

- matched the audited Master archive identity
- imported successfully into Blender
- contained mesh geometry
- contained exactly one armature
- contained bones
- exposed all seven expected animation actions
- saved as an editable `.blend` checkpoint
- reopened successfully in Blender
- retained matching structural metrics after reopen

## Checkpoints

| GLB | Meshes | Armatures | Bones | Actions | Blend bytes | Blend SHA-256 |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| koala-world-v2-001-lite.glb | 2 | 1 | 20 | 7 | 769864 | `b38cddba432f954514305a0b3fb9a20d620da6f705ad00af4f8e874e6a1aac72` |
| koala-world-v2-001-standard.glb | 2 | 1 | 20 | 7 | 1369030 | `714436684e5b890cfebfe9c7bd9c02dbb1e0824532a9bc1faca35c48e6ad2064` |
| mouse-world-v2-001-lite.glb | 2 | 1 | 20 | 7 | 848378 | `6ab83fa57cf99b452a3a483f7b83ea34a5c7cff25670bb6ef9c5b1d07ac7696a` |
| mouse-world-v2-001-standard.glb | 2 | 1 | 20 | 7 | 1494556 | `707b7a8a73e674631acf8e8f31d8a46a7ff9f25c6d7bad0fffd6d401a23c0b86` |
| owl-world-v2-001-lite.glb | 2 | 1 | 20 | 7 | 884281 | `0b2f49489d42f90b55e516eed75aab8a48536bfdab4e6d3e4c65838263869392` |
| owl-world-v2-001-standard.glb | 2 | 1 | 20 | 7 | 1429955 | `871483d19ce8ffb5e74db0c64279828531b1bc230b74218a10092d08c6b47166` |
| pig-world-v2-001-lite.glb | 2 | 1 | 20 | 7 | 775781 | `da33a3861f813716208970f4c9447d8dfcf718dc7ae921c70e57e3020dc00620` |
| pig-world-v2-001-standard.glb | 2 | 1 | 20 | 7 | 1330738 | `a75b699b3900ac3f55fcbfd3965cae44ffbda42400d9e2c344009eef4c7cb3e9` |

## Exact scope

This evidence proves **editable reimport from the delivered GLB binaries**.

It does not prove recovery of the original authoring `.blend`, because the
audited Master archive did not contain native World4 `.blend` files.

The generated checkpoints are therefore derivative editable checkpoints, not
original modeling-history sources.

## Remaining promotion gates

This Blender PASS does not close:

- final human visual/art acceptance
- physical Android qualification
- physical iPhone/iPad qualification
- immutable production delivery publication
- active manifest/registry promotion
- final release qualification and explicit production decision

No runtime, R2, Cloudflare or deployment mutation was performed.
