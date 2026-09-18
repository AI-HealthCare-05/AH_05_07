# World v2 companion browser pre-qualification

## Result

Classification: **Candidate**

Isolated browser technical pre-qualification: **PASS**

Production-ready: **No**

The World v2 review family tested:

- species: koala, mouse, owl, pig
- species count: 4
- candidate binaries: 8
- browser clip/variant checks: 56
- candidate inventory SHA-256: `0332f957c75e2f9091e14ee8f80d5fea46b459b936503807eaac7b118abffe0d`
- source archive SHA-256: `5f7541e8f48a0f3dd7bf58e0cf6f82d19a25063c38f8c018567bdfb727cebed2`
- candidate review input SHA-256: `2cf348dbcaf1a685601502abd2cfcfcacd4e4c1c6fa77854460c07259e47ba87`
- browser verification SHA-256: `7846ffe5ccc7268cb74bce5a85a06d0dd2e0db5f4028c390ea97b78a63cf60e0`

## Browser verification

The existing isolated character-preview verifier completed its technical
browser checks against the exact candidate binary identities.

Checks recorded by the verifier:

- read_only_path_boundary
- initial_selected_asset_only
- all_available_variant_clips_bone_playback
- pause_stop_play
- desktop_390_320_viewports
- keyboard_focus_rotation
- 10_swap_resource_counts_bounded
- fixed_ground_reference_toggle_release_and_views
- light_first_no_hidden_standard_and_common_reference
- pending_asset_not_counted
- failed_glb_static_fallback
- reduced_motion_unloads_glb
- context_loss_fallback
- initial_reduced_motion_no_glb_fetch
- no_webgl_static_fallback
- no_page_errors_or_external_network
- production_bundle_isolated
- catalog_and_glb_bytes_unchanged

## Diagnostic browser samples

| Viewport | Animal | Variant | Mean-derived FPS | P95 frame ms | Renderer | Software |
| --- | --- | --- | ---: | ---: | --- | --- |
| 1366×768 | koala | light | 120.00 | 9.30 | ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (LLVM 10.0.0) (0x0000C0DE)), SwiftShader driver) | True |
| 390×844 | koala | light | 120.00 | 9.30 | ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (LLVM 10.0.0) (0x0000C0DE)), SwiftShader driver) | True |
| 320×844 | koala | light | 119.73 | 9.30 | ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (LLVM 10.0.0) (0x0000C0DE)), SwiftShader driver) | True |

These frame samples describe only the recorded local browser execution.

They are not a physical Android/iOS result and are not used here to claim a
production performance improvement.

A software renderer result, if present, remains valid for functional browser
pre-qualification but is not hardware-performance evidence.

## Scope of PASS

This PASS establishes that the selected immutable candidate GLBs successfully
completed the isolated repository browser verifier.

It includes clip playback and browser-runtime behavior.

It does not establish that the assets are integrated into the SK7 product.

## Explicit non-claims

This evidence does not claim:

- S01 product integration qualification
- S02 product integration qualification
- S10 product integration qualification
- physical Android performance
- physical iPhone or iPad performance
- final owner visual acceptance
- final art acceptance
- Blender editable-source reimport
- production delivery publication
- production readiness

## Runtime boundary

The candidate inventory remains review-only.

This work does not:

- add CompanionSpecies
- alter the active companion manifest
- alter the active scene registry
- alter presentation profiles
- create a runtime candidate URL
- create or replace an R2 object
- modify Cloudflare
- modify deployment
- set a production flag

## Remaining gates

Before production promotion, the World v2 family still requires:

- owner visual and art acceptance
- actual SK7 S01/S02/S10 qualification where affected
- physical Android/iOS qualification
- Blender editable reimport where required
- immutable delivery evidence
- explicit active manifest/registry promotion
- explicit production release decision

The correct classification remains **Candidate**.
