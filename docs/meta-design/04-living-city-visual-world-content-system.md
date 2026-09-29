> **DESIGN PROPOSAL — NOT IMPLEMENTATION AUTHORITY**

# 04. Living City Visual & World Content System

## 1. Status, baseline, and authority boundary

**Status: repository-grounded design draft for Issue #899.** This is a standalone design asset, not an implementation plan accepted for execution. It authorizes no production behavior, implementation outside this docs-only task, deployment, provider change, protected data/model change, new persistence, dependency, generated asset, asset publication, or activation. No Experience Slice Issue is created by this proposal. #396 remains untouched.

Reviewed repository: `AI-HealthCare-05/AH_05_07`. The live `main` resolved during this investigation to `6d3207d673b8001d8809628c0830d5a2f5affe39` on 2026-09-29 KST. Source evidence below is scoped to that immutable revision. Tests described below were **read, not executed for this draft**. Source capability, test coverage, a passing run, human comprehension, and served production are separate claims.

Future implementation starts from then-live `origin/main`, a new bounded GitHub Issue, and revalidation of the relevant assumptions. Root `AGENTS.md` alone owns repository workflow. Current task Issue/PR, `docs/transcend/PROGRAM.md`, `docs/architecture/SK7_LIVING_CITY_3D_FIRST_PRODUCT_CONTRACT.md`, Model V2, and other current protected domain authorities override this proposal. Older documents can explain a design's provenance without reinstating their historical workflow gates, activation status, or measurements.

This document contributes **content and visual-composition decisions**. It does not replace the Living City shell/bridge architecture, asset activation chain, personal ownership model, or release workflow. It is not a project ledger, status registry, roadmap registry, or handoff file. Candidate letters below name possible boundaries, not a schedule or pre-authorized sequence.

The visual direction is spacious, tactile and immediately legible: let place, silhouette, material and a visible next action do more work than explanatory paragraphs. Rich feedback is welcome where qualified. Simultaneous attention competition is not the goal. References to entertainment-product quality concern clarity and execution discipline, not another company's characters, wording, assets, signature architecture, or trade dress.

## 2. Current repository reality and evidence

### 2.1 Source map, not a new authority registry

The references identify seams used in this document. Relative links target repository paths at the reviewed baseline; future readers must re-open them at their task revision. Named functions and sections are more durable discovery anchors than today's line numbers.

| Ref | Exact source or contract | What it establishes here |
| --- | --- | --- |
| R01 | [AGENTS](../../AGENTS.md), [PROGRAM](../transcend/PROGRAM.md), [Living City contract](../architecture/SK7_LIVING_CITY_3D_FIRST_PRODUCT_CONTRACT.md) | Workflow, 3D-first direction, shell/bridge separation, future growth and activation limits |
| R02 | [Scene policy](../scene-policy-contract.md) | Visual input firewall; distinct E3/E4 and S05 exceptions |
| R03 | [scenePolicy.ts](../../web/src/ui/scenePolicy.ts), [sceneRecipes.ts](../../web/src/ui/sceneRecipes.ts) | Seven calendar landmarks; S02/S10 qualification; per-surface composition and descriptor resolution |
| R04 | [environment.ts](../../web/src/components/scene/environment.ts), [diorama.ts](../../web/src/components/scene/diorama.ts) | Authored procedural landmark families and S10 desktop/mobile composition |
| R05 | [worldScene.ts](../../web/src/placeable/worldScene.ts), [PlaceableWorld.tsx](../../web/src/placeable/PlaceableWorld.tsx) | Product plaza geometry, material roles, camera-only obstacle proxies, visual-only Garden path, labels, visit-local twilight |
| R06 | [gardenScene.ts](../../web/src/placeable/gardenScene.ts), [GardenNook.tsx](../../web/src/placeable/GardenNook.tsx) | Separate Garden visit; instance-specific pavilion treatment; bounded movement, framing and resource owner |
| R07 | [livingCityRenderDensity.ts](../../web/src/placeable/livingCityRenderDensity.ts), [placeable-world.contract.spec.ts](../../web/e2e/placeable-world.contract.spec.ts) | Drawing-buffer cap and inspected geometry/lifecycle tests; not measured device performance |
| R08 | [Living Week landmarks](../../web/transcend-lab/src/platform/spatial/livingWeekLandmarks.ts), [worldSceneProfile.ts](../../web/transcend-lab/src/platform/spatial/worldSceneProfile.ts) | Bounded foundation geometry and explicit actor/camera/destination profile; not a universal city scale |
| R09 | [Factory/runtime boundary](../architecture/SK7_VISUAL_FACTORY_RUNTIME_ACTIVATION_BOUNDARY.md), [companionActiveAsset.ts](../../web/src/ui/companionActiveAsset.ts) | Candidate, available delivery, active membership, and surface qualification are different facts |
| R10 | [Authored scene manifest](../../web/src/ui/scene-manifest.v2.json), [verifier](../../web/scripts/verify-scene-manifest.mjs) | Existing scoped schema, dependencies, source hashes, measurement and poster compatibility |
| R11 | [themePreference.ts](../../web/src/ui/themePreference.ts), [visual production contract](../visual-production-contract.md) | Browser-local semantic UI themes; semantic content, accessibility and visual-evidence boundaries |
| R12 | [keepsakeMedia.ts](../../web/src/placeable/keepsakeMedia.ts), [placeable value contract](../../web/src/placeable/contract.ts), [data contract](../data-contract.md#my-space-cosmetic-snapshot-e4) | Immutable cosmetic IDs, two slots, still medallion family and version preservation |
| R13 | [controller.ts](../../web/src/placeable/controller.ts), [PlaceableExperience.tsx](../../web/src/placeable/PlaceableExperience.tsx), [placeable.contract.spec.ts](../../web/e2e/placeable.contract.spec.ts) | Confirmed versus preview, unsupported preservation, UNKNOWN/conflict and semantic exits |
| R14 | [Companion runtime current summary / E5 / E6](../companion-runtime.md) | My Space identity and explicit Twilight Welcome cause; historical S3 paragraphs do not describe current activation |
| R15 | [disposeScene.ts](../../web/src/components/scene/disposeScene.ts), [StaticSceneFallback.tsx](../../web/src/components/StaticSceneFallback.tsx) | Visit-owned cleanup and a specific static landscape path; not a generic ownership-restoration mechanism |
| R16 | [Placeable browser tests](../../web/e2e/placeable-classic.spec.ts), [spatial browser tests](../../web/e2e/plaza-spatial.spec.ts), [placeable boundary](../../web/scripts/placeable-boundary.mjs) | Existing browser scenarios and allowed pure foundation imports, distinct from importing the Lab runtime |

### 2.2 Three presentation families, not one existing content engine

**Semantic Journey scenes** use scene policy, verified recipes and registered environment/poster inputs. The S02/S10 scene is not the entire application. Their visual calendar selection does not follow a selected record date or challenge success. Current S02 placement additionally belongs to the Presence boundary described in Proposal 01; this proposal does not generalize that root writer into a world-content engine. R02–R04.

**Product My Space** has its own plaza, Garden visit, camera and locomotion owners. The plaza has an architectural Today arch, approach, surroundings, planting, seats, pinwheel sockets and a supporting motif. Garden reuses an authored pavilion instance while composing its own planting, path and supports. These are product source paths, not proof of their currently deployed version. R05–R07, R14.

**Transcend foundation** contains explicit world profiles and seven connected weekday landmarks. Some pure definitions are imported by My Space through a bounded import policy. That is not permission to import the Lab shell, diagnostic controls, backend selector or arbitrary Lab state into the product. The W4 four-metre bound and profile sizes belong to that bounded foundation, not a permanent specification for every future district. R08, R16.

### 2.3 Existing composition principles worth retaining

The shared landmarks use a limited clay/wood/stone/foliage palette, rounded geometry and material batching. S10's diorama composes seven landmarks on desktop but only the focal landmark and one neighboring fragment in narrow profiles. This is evidence for **selective scenery composition**, not evidence that every My Space scene already implements adaptive geometry density. R04.

The product plaza uses distinct finish families rather than one roughness for every object. The Garden recomposes an independently created pavilion and currently identifies some recoloring targets by their old color values. That works as a local source technique; promoting exact color-value comparisons into a general material-role API would be fragile. This is a future scaling risk, not a claim of a current rendering failure. R05–R06.

The plaza also derives conservative **camera-only** obstacles from static mesh bounds. Those are expressly not player collision. A decorative side path points toward Garden but is expressly visual-only. A user-facing route claim therefore cannot be inferred from a visible path mesh. R05.

### 2.4 Four densities must not be confused

The current `livingCityPixelRatio` caps the product plaza/Garden drawing buffer at a 1.5 density ceiling and approximately two million pixels; the inspected test checks the actual integer drawing dimensions over several sizes. That does not establish frame rate, texture memory, thermal behavior or optical quality. R07.

This proposal distinguishes **pixel density**, **geometry/resource density**, **visual-attention density**, and **semantic-control density**. Reducing one does not automatically fix the others. Fewer polygons do not clear a hidden button; a lower DPR does not remove competing labels; a spacious page does not reduce a shadow pass. Each needs evidence appropriate to the claim.

### 2.5 Three meanings of theme already need separation

`themePreference.ts` owns `cloud`, `warm`, and `high-contrast` as a browser-local semantic UI preference applied to the document root. The plaza's daylight/twilight colors are scene-owned and are not that preference. User-selected cosmetic colors are yet another domain: a selected teal pinwheel must not silently become a sunflower pinwheel when a presentation theme changes. R05, R11–R12.

The inspected world sources support manual, visit-local twilight and a separate calendar-based Journey scene. They do not establish a general weather, season or astronomical day/night system. This proposal does not assert repository-wide absence merely because a search found no such system. Later implementation must search again.

### 2.6 E4 stillness and E6 lighting are cause-specific, not contradictory blanket rules

E4's keepsake selection/save contract uses a still supporting medallion and does not authorize a new reward, particle, audio or saving animation. E6 later defines an **explicitly activated visit-local Twilight Welcome**. Current `worldScene.ts` includes the keepsake face among the materials receiving that small lighting response. R02, R05, R14.

Therefore “a keepsake must never change a pixel” is too broad. Equally, “twilight touches the keepsake, so saving it may explode with particles” is false. The narrow reconciliation is: preserve E4's static save/selection meaning and preserve E6's separately qualified environmental cause. Do not create a new autonomous keepsake animation or medical reward. Proposal 05 must retain this distinction.

### 2.7 Asset vocabulary and coverage limitations

Generated delivery descriptors are available inventory, not automatic production membership. The active resolver checks the generated descriptor against checked-in scene membership and surface clip requirements. A scene entry's `review` status is not itself a deployed activation bit. R09–R10.

The current scene manifest/verifier is scoped to known S02/S10 assets, recipes, measured dependencies and fallback mappings. It is not a generic registry for every My Space object or future content pack. Older document counts and “production disabled” rollout phrases must not override the current executable policy. No new count or served-state claim is made here.

The tests inspected contain pixel-budget, pavilion-support/framing, active member, placement, cleanup and browser scenarios. They demonstrate existing assertions and reusable test seams. They are not a new PASS run, performance result, or evidence that a person understands a proposed composition.

## 3. User promise / North Star

> “This is a place I recognize. I can see what matters and what I can do. New places feel related without all looking the same. My choices do not disappear because the picture cannot load.”

On arrival, a person should recognize one dominant destination, the companion and enough ground/path to understand the setting. The first screen should not require reading a tour. The few visible action labels should name real actions, not poetic substitutes for them.

A complete place may contain no saved decoration. More content should create variety and personal expression, not a visible debt to collect everything. Smaller screens should preserve the same consequential choices without turning the world into a miniature desktop or a wall of floating control cards.

The quality target is **recognizable variety with bounded complexity**. A new district should be recognizable by its silhouette, composition and materials before another block of explanatory copy is added.

## 4. Problem statement

The immediate problem is not a lack of meshes. It is that composition, palette, camera fit, content identity and fallback assumptions can proliferate independently as scenes are added.

A one-off change can look excellent at its authored angle and still fail when the camera turns, the editor opens, another species is selected, a saved motif becomes unsupported, or the browser enters a static mode. A shared color constant or a large JSON file alone does not solve that problem.

The scaling hazards are concrete: identifying semantic parts by old hex values; copying world metres into screen-space hit geometry; hiding a path because it is visually secondary while leaving an invisible collision wall; treating all available assets as usable; or disposing shared resources when one scene exits. These are ownership and compatibility problems expressed as visual defects.

This proposal supplies a design language and bounded compatibility obligations. It deliberately does not invent a universal scene compiler, remote theme platform, generic inventory, or new renderer architecture.

## 5. Principles and decisions

**Place first; controls remain real.** The world may occupy the primary visual area. Consequential actions, scope, uncertainty and exits retain semantic controls and truthful labels. No bitmap or emissive material carries the only copy of an important fact.

**Hierarchy before detail.** Choose the current visual lead, supporting context and quiet regions before adding foliage, bloom or particles. “One lead” is a composition heuristic for the current task, not an immutable rule that every screen has exactly one object or button.

**Richness is relational.** Use silhouette, material contrast, depth, light and comfortable grouping before increasing object count. Leave room for a completed action to be seen. Delight should not depend on continuously moving every surface.

**Adapt the scenery, not the user's rights.** Reduce background detail or use a simpler representation without removing destinations, stored selections, named actions or recovery. Visual pruning must not become entitlement pruning.

**Reuse roles, not accidental constants.** A roof is a roof because the source author identifies that role, not because its current material happens to be lavender. A reusable role must still be translated through the particular surface's rendering and lifetime policy.

**Presentation does not save.** Crop, quality, camera fit, asset failure and theme changes never generate cosmetic writes. Only the existing product authority may change a confirmed selection.

**Capabilities do not choose causes.** A material can support a bounded glow without becoming responsible for deciding when a save succeeded or which destination should open. Proposal 05 owns proposed timing conventions; the actual current effect owner remains authoritative.

**Use the smallest proven seam.** Reuse procedural authoring, manifests, projection and disposal where their contract fits. Expand only the selected boundary. A new theme is not a reason to replace the renderer, and a new landmark is not a reason to create an inventory service.

## 6. Protected boundaries

### 6.1 Domain and growth firewall

Maintain the current visual allowlists. BP values/trends, Model V2 inputs/results, inferred health quality, missed goals and poor outcomes do not select world weather, density, mood, species, decoration loss or intensity. Current S02/S10 calendar scenery, E3's explicitly handed-off cosmetic hint, E4's cosmetic identity and E6's manual atmosphere are distinct, narrowly scoped inputs. None licenses a new health-to-theme adapter. R01–R03, R12, R14.

Future voluntary growth remains possible under the current PROGRAM's explicit-contract model. This proposal neither activates it nor rewrites that direction into a permanent ban. It provides no participation API, grant event, attendance history or derivative retention workaround.

### 6.2 Asset and persistence firewall

Generation, technical review, delivery eligibility, active-in-source selection and served release remain separate. An authoring pack cannot bypass active membership or choose arbitrary runtime URLs. New content and its usage rights require their own task; no asset creation or activation occurs in #899.

Keep the current account/browser split, slot semantics, immutable operation/fingerprint, revision checks, unsupported preservation, retention and deletion boundaries. A theme is not a storage migration; a placeholder is not an erase operation. “Owned collection” remains a future concept, not a synonym for today's selected keepsake slot.

### 6.3 Accessibility and workflow firewall

Visual ambition does not weaken direct semantic access, visible focus, non-color meaning, static equivalents or current input cancellation. Old visual-production gate descriptions do not replace current root workflow. This draft does not create an extra permanent QA phase, mandatory human merge gate, or new release checklist registry.

## 7. Ownership and architecture seams

### 7.1 Decision ownership

| Concern | Existing authority to preserve | Contribution of Proposal 04 |
| --- | --- | --- |
| World pose, movement and camera writes | Target shell/runtime and its actual controller | Describe required envelopes and composition outcomes; do not write transforms independently |
| Companion reaction/tactile/gaze | Target embodiment owner; Proposal 01's separation | Reserve space and material roles, not a second mixer or input route |
| Semantic destination, history, return | App/bridge; Proposal 02 | Make the destination legible; do not invent navigation authority |
| Selected cosmetic state and any future collection | Product controller/adapters; Proposal 03 | Render the projection faithfully and define content compatibility; do not grant possession |
| Artwork identity, source/delivery qualification | Existing asset/manifest chain | Describe role, representation and fallback obligations; no new activation registry |
| Timing, sound, haptics, effect arbitration | Current effect owner; Proposal 05 | Supply effect-capable surfaces and limits, not a second clock or event bus |
| Account/browser/visit/device meaning | Existing data authorities; Proposal 08 | Preserve scope in visual labels and failure treatment |
| Recovery truth and evidence | Existing controllers; Proposals 09/10 | Provide content-specific failure cases and measurable visual claims |

### 7.2 Four identities, none interchangeable

A **semantic destination key** says where an admitted action leads. A **content/asset identity** identifies reviewed artwork or source geometry. A **confirmed cosmetic selection** is product data. A **scene visit identity** fences runtime loading and effects. Names such as “Today Gate” may appear in more than one layer, but string equality is not authority to merge those layers.

A new decorative arch cannot create a new semantic route. Replacing an asset cannot rewrite a selected slot. A different renderer visit cannot replay an old save cue. A new destination name cannot authorize downloading a similarly named Factory candidate.

### 7.3 One final writer for each composed output

A content descriptor may propose base material values, allowed accent surfaces and displacement bounds. It must not install its own loop that competes with the existing theme/effect owner. Current plaza lighting and feedback already meet in a local scene owner. A later implementation must either keep composition there or establish an equally explicit seam within its scope, not stack unrelated global animation helpers.

Shared geometry or immutable bytes may be reused; mutable material instances, skeleton pose and disposal ownership need a deliberate lifetime. The present disposer deduplicates resources within its traversal and has renderer-specific cleanup. That is not permission to turn all scenes into a shared global mutable asset cache. R15.

## 8. Visual and content grammar

### 8.1 Layer roles: composition, not literal render order

| Role | Example in current language | Visual job | What it may not imply |
| --- | --- | --- | --- |
| Place foundation | Ground, approach, boundary | Make the space feel inhabitable and oriented | Walkable terrain beyond the actual movement contract |
| Primary landmark | Today arch or Garden pavilion | Give this visit a recognizable focal identity | Auto-navigation, data readiness or an unlocked entitlement |
| Companion | Selected qualified actor | Presence and direct interaction where supported | Health-derived emotion, a second actor owner |
| Supporting context | Neighbor fragment, bench, grove | Depth, scale and local character | A compulsory additional task |
| Personal decoration | Confirmed pinwheel / still motif | Express a known user choice | A collection or achievement not actually stored |
| Atmosphere | Sky, fill light, fog, qualified twilight | Cohesive mood and surface separation | Real weather, local time inference or medical condition |
| Semantic layer | Named actions, scope, recovery | Make real capabilities operable and truthful | Decorative copy masquerading as a second state source |

These are responsibilities, not seven required Three.js groups or a fixed z-order. During editing the selected pinwheel may become the focal object; during a recovery dialog the semantic action takes priority. The Today landmark does not have to remain the brightest object while the user is resolving a write.

### 8.2 Spaciousness as a set of relationships

Use three distinct spaces: **within a control group**, **between different actions**, and **around the world's focal silhouette**. The label belongs near its control; the editor belongs near its preview; global exits need separation from the world gesture surface. Increasing every margin equally would break those relationships.

A useful candidate composition has a generous field around the hero, a readable approach, an off-centre companion and a small number of personal accents. The exact empty-area percentage is deliberately unspecified. It must work with the current camera, species, viewport and user text size rather than meet an invented universal quota.

The quiet area behind semantic content is a **semantic clearance region**, not a new invisible collider or storage field. It may be implemented by in-flow layout, a stable backing surface or camera-aware composition in a later slice. Glow tails, foreground leaves and projected labels may not occupy that region just because their meshes are technically behind the HTML.

Visible affordances should remain named: `꾸미기`, `오늘의 기록`, `간단한 광장`. Optional descriptive paragraphs can collapse. `미리보기`, account/browser scope and uncertainty cannot be replaced by a color or an animation.

### 8.3 Silhouette and landmark hierarchy

A primary landmark should be identifiable at arrival through its large-scale outline and spatial relationship to the approach. Detail can reward closer inspection, but an arch must not depend on a tiny plaque or continuous pulse to be a destination. Supporting architecture should not repeat the same dominant outline at equal size on both sides of the scene.

Use a near/middle/far composition where it helps: foreground forms frame rather than cover the actor; the middle holds the current action; the distance suggests a larger place without promising reachable streets. This is not an instruction to add fog or a background object to every screen.

Keep **art silhouette**, **interaction envelope**, and **walkable topology** distinct. A wide arch may visually frame the destination while its current approach radius and navigation action remain unchanged. If the art is made so large that those three no longer appear coherent, the slice must reconcile the mismatch; it cannot claim a cosmetic-only change while changing where people can walk or activate actions.

### 8.4 Material-role language without a global repaint

Candidate roles can extend existing stone, paving, timber, foliage, gate, trim and accent families. Their job is to describe what a material communicates and how it behaves under the target lighting, not prescribe one permanent hex code or roughness.

| Material role | Desired reading | Review concern |
| --- | --- | --- |
| Ground/paving | Stable, low-frequency support | Path is distinguishable without glossy distraction or z-fighting |
| Timber/architecture | Warm, grounded construction | Roof/support joins remain credible across close and narrow views |
| Foliage | Depth and soft framing | Does not camouflage the actor or create apparent impassable walls |
| Primary landmark finish | Recognizable destination | Holds hierarchy in daylight and qualified twilight without looking like an alarm |
| Small personal accent | User-chosen color and motif | Remains recognizable; theme does not overwrite selection semantics |
| Semantic backing/focus | Legible action and state | Uses actual DOM contrast and focus rules, not material-color assumptions |

Authored material roles should be local and explicit where first needed. Do not refactor every existing module to a universal theme engine in order to replace one pavilion's color lookup. Do not recolor all objects sharing a material instance when only the selected instance is in scope. Textures, tone mapping, light and opacity mean a hex-code contrast calculation alone cannot prove rendered-world legibility.

Keep semantic UI theme, world art theme, selected cosmetic color and visit-local lighting as separate inputs. High Contrast must not silently reset the world or choose a new asset. A future cross-surface palette alignment can map roles explicitly while preserving each input's meaning.

### 8.5 Spatial content dossier — a design checklist, not a new schema

Before promoting a reusable module, the future task should be able to answer the following for that module using the smallest existing representation that fits. These fields are **not** instructions to create a new JSON manifest, public API or database table.

| Question | Required design answer |
| --- | --- |
| Identity and role | Exact source/asset identity, intended visual role and target surfaces |
| Coordinates | Target coordinate basis, authored units, origin and forward direction |
| Grounding | Ground contact and transform normalization; deliberate offset versus geometry error |
| Static envelope | Visible footprint and height after the target transform |
| Dynamic envelope | Union of supported poses/effects and their allowed local offsets, when applicable |
| Movement relationship | Decorative only, walkable support, or separately authorized blocker; not inferred from mesh shape |
| Camera relationship | Allowed views, occlusion risk and camera-obstacle handling |
| Semantic relationship | Label anchor, real action binding if any, and clearance from critical HTML |
| Adaptation | What may simplify/crop/disappear, and what must retain a representation |
| Material and FX role | Local instances, baseline properties, qualified accent surfaces and static endpoint |
| Resource ownership | Who loads, mutates and disposes geometry/material/texture/skeleton state |
| Failure and retirement | Neutral or equivalent fallback and treatment of still-referenced identity |
| Provenance | Authored source, rights basis, delivery/hash evidence where applicable |

World-space metres cannot be substituted for CSS-pixel hit geometry. Convert through the current camera/viewport adapter when projection is required. Recompute projected clearance after relevant resize, scroll, text expansion or camera changes. A metre value may be correct and still place a button behind the global header.

Normalization is surface-specific. Existing Journey scene fitting and My Space companion fitting use different framing logic. Reusing a GLB does not prove that one scalar gives the same silhouette, foot contact or motion clearance in both. Proposal 01 still owns the separation between world-root movement and local embodiment.

### 8.6 Camera composition without a competing camera controller

Treat the camera's **required outcome** as part of the content contract, while preserving the target runtime as the camera writer. On arrival the landmark, companion, initial legal movement area and independent semantic exit should be understandable. During orbit, it is not necessary to keep every landmark simultaneously visible, but the user must retain a meaningful way to orient or reset the view.

A content addition must be reviewed at representative camera extremes as well as its authored hero angle. Current plaza tests and camera-only proxies are relevant seams. They do not prove arbitrary new geometry will be safe. Adding a tall plant after proxies are captured, or hiding an object while retaining its camera obstacle, can change behavior even when the edit looks like decoration.

For narrow Garden views, current tests measure pavilion geometry and reachable actor positions, not just the center of the canvas. Reuse that idea. An axis-aligned envelope is a useful conservative check, but it is not proof that a moving face is readable through foliage or that a label is unobscured by HTML. R07, R16.

### 8.7 Content pack means a bounded authoring unit

A **content pack candidate** is a small, versioned set of related authored inputs with known roles, compatibility and fallbacks. It is not an entitlement bundle, network-delivered executable scene, monetized collection, runtime control plane, or new activation mechanism.

An appropriate first example is a single place composition using an existing landmark family, a bounded support layer and explicit narrow/wide composition. It need not contain new binary media. Its dossier declares the target surface, dependencies and visual differences from the current place. A theme pack cannot replace the navigation registry or rename saved cosmetic IDs.

Think of representation along two independent axes:

| Authorship / provenance | Delivery form |
| --- | --- |
| Repository-authored procedural geometry | Source module built with the product |
| Repository-authored sculpted or animated content | Verified immutable binary |
| Separately reviewed external or generated source | Only the exact qualified delivery form |

“Procedural,” “authored,” and “delivered” are not mutually exclusive quality tiers. Code-authored geometry is authored content; delivered geometry can have been generated procedurally. Choose by repeatability, shape requirements, performance, tooling and rights, not by assuming external 3D is more premium.

Repetition can use deterministic authored patterns. Unbounded random scattering must not place decoration into paths, conceal a saved object, or create a different review target on each load. A seed is a reproducibility aid, not permission to persist new world state. No generator or asset batch is run by this proposal.

### 8.8 Pack compatibility and admission

A later pack task must declare whether each part is **required for the proposed composition**, **optional scenery**, or a **representation of product-selected state**. Failure of a required new landmark returns to an already admitted baseline or semantic fallback. Failure of optional planting can omit only that planting. Failure of a saved-object representation does not erase its value or silently replace it with another object.

Admission checks include exact dependencies, supported role/representation, source/hash provenance where applicable, expected capability, grounding and envelope, fallback coverage, and the absence of forbidden runtime access. A manifest-shaped file does not automatically fit the present S02/S10 verifier. Either fit its existing scope or explicitly scope a later tooling change; never make the verifier permissive just to accept a new pack.

New content is not required to hot-swap mid-visit. A coherent first implementation may choose at a clean visit boundary, keeping the existing owner and avoiding parallel live worlds. Hot swaps, shared caches and partial asynchronous composition need their own demonstrated requirement and lifecycle evidence. None is a prerequisite invented by this draft.

### 8.9 Light and FX surfaces

04 proposes **where a qualified response may be legible**: the arch trim, a selected object's outline, an approach segment, a supporting atmospheric layer. 05 will propose temporal vocabulary, while current source retains actual triggers and cancellation. A surface capable of emission is not itself permission to animate it.

Candidate attention order is task-relative: arrival landmark → currently chosen action → that action's local result → resting atmosphere. This is not a compulsory tour or an implementation timing chart. While a user edits, unrelated entry hints should not compete. During uncertainty, critical static recovery takes priority over instruction FX.

The E4/E6 distinction in §2.6 is binding for this proposal's reasoning. No new keepsake save celebration is proposed. Existing environmental lighting of its face is acknowledged. Likewise an atmosphere activation cannot reuse a health-record S05 success event or the cosmetic `saved` boolean. Optional sound cannot be the only evidence of a result.

### 8.10 Time, weather and seasons: candidate decisions only

| Candidate | Potential value | Minimum boundary before implementation |
| --- | --- | --- |
| Existing manual daylight/twilight | Immediate, reversible atmosphere | Preserve the current visit-local cause and no-write behavior |
| Another manual art theme | Variation without attendance pressure | Qualified art/fallback, readable selected cosmetics, explicit non-persistent or separately approved preference scope |
| Calendar-themed art | Shared calendar character | Decide the exact calendar input, locale/timezone, change boundary and stable task geometry; do not infer health or real weather |
| Automatic day/night or weather | Possible atmosphere | No demonstrated need established here; no location permission, weather API, ambient clock polling or provider expansion is authorized |
| Seasonal pack | New authored variety | No time-limited ownership loss, artificial scarcity, missed-season shame or mandatory return |

Do not make a stored item unavailable merely because the season ended. Do not treat actual clock time as interchangeable with today's calendar landmark or an explicit twilight gesture. A semantic route must not become darker because its records are missing.

### 8.11 Representation lifecycle and saved references

A content identity's availability and a user's confirmed selection are independent. Resolve changes by cause, not by the visual symptom “nothing appeared.”

| Situation | Proposed truthful presentation | Forbidden shortcut |
| --- | --- | --- |
| Delivery timeout / corrupt bytes | Current surface's qualified neutral/equivalent fallback; retry only through its owner | Claim the user lost the item; save a default |
| New art revision not yet active | Existing active representation | Load a candidate because its thumbnail looks newer |
| Optional background retired | Admit an appropriate baseline in a separately scoped content change | Rewrite cosmetic selection as part of scenery replacement |
| Referenced cosmetic art temporarily unavailable | Preserve confirmed identity; show supported semantic representation | Substitute another motif under the old ID |
| Stored schema/asset unsupported by this client | Existing unsupported boundary with data preserved | Partially normalize into an editable “empty” layout |
| Asset withdrawn for safety/rights | Suppress prohibited delivery through an explicit decision; preserve data and explain availability separately | Continue unsafe delivery for visual continuity, or silently delete user state |

A future new-art mapping needs immutable identity/provenance and explicit compatibility. Do not overwrite an existing versioned object. Do not automatically alias a retired selected ID to a visually similar ID. A removal control is offered only where the current value/persistence contract supports it; an unsupported state cannot be made editable by a placeholder component.

Account lifetime is not a forever-hosting or restore promise. A picture, scene source archive, or browser cache is not a backup of a user's layout. Proposal 03 owns possession and loss meaning; Proposal 08 owns scope language; any migration, export or recovery guarantee requires separate authority.

### 8.12 Worked module: the existing Today arch

For a first composition slice, preserve the current destination binding, movement bounds, sockets, camera/input owner and storage projection. The arch is the arrival lead; the approach explains orientation; the companion remains readable; the pinwheel and motif remain supporting selections. Asymmetric planting and quieter distant shapes frame the arch rather than duplicate it.

When the editor opens, it receives a stable semantic region and the selected pinwheel becomes the local action focus. This does not enlarge the saved socket's legal footprint or move the actor for visual convenience. On a narrow or short display, a reduced scenic perimeter or an in-flow editor is preferable to hiding confirm/cancel beneath a large scene.

The acceptance question is not “does the screenshot look cinematic?” It is: can a person identify the destination, enter editing, distinguish preview from saved, recover from a blocked world, and continue to Today without the new composition changing the underlying task? No health facts are required to achieve that coherence.

## 9. Desktop, mobile and adaptive behavior

### 9.1 Preserve topology and task meaning

Adaptive composition first distinguishes a decorative diorama from a traversable world. Cropping or not instantiating a decorative S10 neighbor is not the same operation as removing a reachable destination or an occluding wall from My Space. The seven-to-two S10 precedent is useful precisely because it is scoped. R03–R08.

For a future traversable-world slice, retain the current movement bounds, destination identities, admitted actions, selected cosmetic meaning and semantic exits across display classes unless a new geometry change is explicitly in scope. Optional background meshes may be simplified. Any associated camera-only proxies must remain coherent; do not leave invisible obstacles or remove a visual wall that still reads as a real boundary. Let the current camera/collision owner apply the change, not the content pack.

### 9.2 Suggested reduction order, not a universal runtime tier ladder

Start by reducing gratuitous decorative emphasis and labels, then peripheral high-frequency detail, distant repeated objects, and optional material/shadow complexity where qualification permits. Recompose or allow ordinary scrolling before shrinking critical text, hit targets, the active object or its useful movement space. If the surface cannot remain usable, use its existing simpler/semantic path rather than claiming a miniature scene is adequate.

This order is a design starting point. A GPU bottleneck may require a drawing-buffer adjustment; a semantic overlap requires layout work. Neither justifies switching storage mode or changing the task. Keep quality changes stable instead of oscillating around a viewport threshold. No automated quality detector or persistence preference is introduced here.

| Context | Composition target | Things not to sacrifice |
| --- | --- | --- |
| Wide desktop | Landmark plus layered surroundings; adjacent editor only when comfortable | Clear exits, actor silhouette and one readable action group |
| Tablet / intermediate widths | Deliberate recomposition; fewer competing panels | Do not assume 768 means either phone or full desktop geometry |
| 390-wide | Hero and a small amount of context; in-flow tools or a non-overlapping region | Selection labels, scope, confirm/cancel and normal scroll |
| 320-wide | Recognizable place, essential action and supported simplified presentation | Do not shrink text/targets to preserve all decoration |
| Short viewport | Task and recovery before tall scenery; consider existing fallback | No fixed-height stage trapping actions below an inaccessible fold |
| Enlarged text / actual zoom | Reflow semantic groups and recompute clearances | No hidden status, truncated action or hover-only fallback |

These are outcomes, not new breakpoints. Use the then-live surface's actual dimensions, including browser chrome, safe areas, software keyboard and surrounding HTML where relevant.

### 9.3 Measurable composition witnesses

For a selected slice, inspect the **projected actor envelope**, **primary landmark silhouette**, **legal gesture area**, **label rectangles**, and **semantic control rectangles** in the same viewport. If effects extend outside an object, include their maximum visible footprint. A control's glow is not additional hit area. A hidden label is not an acceptable sole description of a destination.

Useful tests combine projected geometry with actual DOM measurements. Check the arrival view and the views a user can reach, not every mathematically possible camera. If the camera can orbit behind a tree, exercise that path. If a portrait Garden retains a visible roof but the companion is clipped at a path corner, the composition is not qualified.

No universal pixel, polygon, label count or empty-space percentage is established here. Existing DPR and resource caps remain current implementation boundaries until separately changed. Fresh observed performance must accompany any later performance claim; function arithmetic alone cannot supply it.

### 9.4 Independent responsive representation

A static fallback must fit its target profile; a desktop crop is not automatically a mobile master. But neither is a newly authored mobile poster automatically permitted by #899. Use current qualified fallback sources, and scope later capture/registration work explicitly when needed. Verify identity and surface compatibility rather than rendering a historical bear image as proof of every selected species.

A context-dependent static landscape may be decorative and identity-neutral in meaning while the selected actor exists elsewhere. Do not generalize that into “any poster can replace any actor.” Re-read the exact presentation/fallback owner before changing such a mapping.

## 10. Accessibility and non-primary-input equivalents

**FX-off is a complete experience.** A destination has a name and an actual semantic route. A selected color has a label and selected-state semantics. A pending write is described as pending. The user never needs to deduce these facts from the brightest mesh.

Retain current keyboard and non-drag alternatives. Content may frame or point to an existing control; it cannot intercept focus, pointer capture, wheel behavior or Escape through a decorative overlay. A 3D canvas that is interactive and focusable in My Space has different semantics from an `aria-hidden` decorative Journey canvas. Do not apply one blanket accessibility wrapper to both.

Keep visual grounding and semantic order related without duplicating every mesh in the accessibility tree. Announce meaningful destination and task changes, not every plant, light interpolation or frame. Critical labels stay live HTML; no text-bearing illustration substitutes for them. Exits remain outside an optional renderer's failure boundary where the current architecture provides that separation.

Use the existing repository accessibility targets, including preferred 44 CSS-pixel primary touch controls, suitable text/non-text contrast and readable enlarged text. A design mockup or unit test cannot establish conformance. Where the scene is behind text, inspect representative bright/dark/animated states or provide an appropriate stable backing. Forced-colors support belongs to semantic borders, labels and focus treatment; a custom WebGL shader is not assumed to inherit it. R11.

Reduced motion may remove autonomous travel, pulses and camera sweeps. It must preserve the action, representation of selection and truthful result. Current Journey may choose a poster while My Space can retain a neutral actor; those are intentionally different surface policies. An environmental switch can show its final hierarchy without replaying the omitted sequence. Mute or unavailable audio likewise does not remove navigation or ownership information. R03, R14.

Spaciousness is not sufficient accessibility evidence. Check reachable controls, focus visibility, text resizing, reading order and scroll. Distinguish actual browser zoom from a wider screenshot, a narrower viewport, DPR changes or increasing `font-size`; each tests a different condition.

## 11. Loading, failure, recovery and cancellation

### 11.1 Independent readiness

At least three relevant facts can differ: semantic capability ready, cosmetic state confirmed, and optional visual resources ready. The composition should not conflate them. A world can still be loading while Today is available. An account read can remain uncertain after the canvas draws. A selected pinwheel can be confirmed even if its 3D representation fails.

Use the existing owner's states rather than introduce a global content-ready boolean. Never use a poster, warm shader or completed lighting effect to declare account data ready. Never add a minimum reveal duration that holds back real ready/error content. No decorative percentage pretends to measure loading progress.

### 11.2 Optional versus essential visual failure

An optional peripheral layer may fail quietly. A missing hero that prevents orientation must expose the current retry/simpler/semantic route rather than leave a apparently usable but directionless scene. A missing selected-object image must not be treated as a confirmed empty slot. An unsupported snapshot stays unsupported even if some values look familiar.

Existing fallback owners remain local. Do not add another canvas behind a failed one, mount a duplicate poster, or hot-load an unreviewed substitute. A hypothetical baseline fallback has to be an actually admitted current representation, not a new asset inferred from a filename.

### 11.3 Preserve mutation truth and source release rules

Preview, saving, UNKNOWN, conflict, unsupported and session loss retain their existing meaning. Source visual failure does not override the navigation safeguards discussed in Proposals 02/03. Conversely, no new decorative failure may become a prerequisite to reaching the source's existing recovery controls.

When an old save response arrives after a new account or visit, neither the old object nor its success light may appear under the new owner. Use current request/session/controller fencing. The content system has no authority to retry a write, allocate a new operation ID or migrate a value. Existing bounded reconciliation reads must not be inaccurately described as absent; only the admitted write retry is explicit and immutable. R13.

### 11.4 Resource lifecycle

A late asset load after a visit exits is disposed or ignored through the current owner, never attached to the next scene by a global name lookup. Retrying visual resources creates only the opportunities the existing failure owner allows. Re-entering a visit can reconstruct a representation without restoring a prior animation, camera motion or unfinished effect.

A future reusable pack must specify ownership of material instances, textures, geometries and skeletons. “Shared” must not mean one visit disposes another visit's live resources. Conversely, keeping everything globally resident to avoid disposal is not an acceptable default. Existing renderer-specific cleanup is evidence to preserve, not boilerplate to replace with a shorter loop. R15.

### 11.5 Content repair is not data recovery

Changing a visual mapping, rolling back a release and restoring deleted account data are separate operations. A compatible old renderer may show the same stored selection; that does not recover lost rows. A renderer rollback must not downgrade unsupported snapshot values. Asset storage is not an account backup. No numerical recovery guarantee or offline capability is established by this design.

## 12. Conflicts and anti-patterns

| Temptation | Failure it introduces | Proposed alternative |
| --- | --- | --- |
| Turn every object into a hero with glow and motion | Competing instruction; weaker task meaning | Rich local responses, task-relative lead, stable quiet regions |
| Shrink the desktop world to fit a phone | Tiny actors/actions and unusable travel | Recompose or simplify optional scenery; preserve meaningful geometry |
| Cull every secondary mesh, including blockers | Invisible collisions or changed topology | Classify scenic, camera and movement roles before adaptation |
| Call every visible path traversable | Art makes an unimplemented promise | Match affordance to real capability; keep explicit destination controls |
| Assume two-megapixel cap proves performance | Resource, CPU or shadow cost ignored | Measure the bottleneck actually affected |
| Use old hex values as universal material IDs | Theme changes break semantic part selection | Add the smallest explicit authored role seam when needed |
| Globally repaint all shared materials | Other scenes, user colors or snapshots appear changed | Local material ownership; preserve selected identity |
| Treat generated inventory or `review` as active | Unqualified content enters runtime | Existing membership and surface policy; deployment separate |
| Generalize S02/S10 verifier to arbitrary packs by loosening checks | Removes real compatibility protections | Explicitly scoped tooling decision or use the current supported shape |
| Make a photo/thumbnail the only fallback | No operation or truthful ownership survives | Semantic representation and supported controls remain independent |
| Save a default when art cannot load | Data loss presented as visual recovery | Preserve the selected value; separate availability from possession |
| Equate E4 stillness with no environmental lighting ever | Erases the later scoped E6 behavior | Distinguish exact cause and surface |
| Reuse E6 to celebrate keepsake saving | Invents reward authority | Keep E4 save static unless separately changed |
| Apply High Contrast by changing cosmetic identity | Accessibility changes possession/choice | Preserve selection; strengthen semantic contrast separately |
| Add a night/season system from a manual twilight control | Expands time, privacy, persistence and lifecycle without need | Treat each as a separately justified candidate |
| Treat old audit or visual gate as current workflow | Duplicates repository authority | Root AGENTS and live task govern execution |

## 13. Explicit non-goals

This draft does not create scenes, assets, textures, GLBs, generated imagery, audio files, runtime themes, public deliveries or content packs. It does not implement a renderer, CSS redesign in SK7, camera/collision change, API, database schema, storage preference, collection, entitlement, health-derived growth or any Model V2 change. No production or preview deployment, provider call with side effects, implementation Issue or asset activation is authorized.

It does not design multiplayer, user-uploaded world scripts, tradable items, a theme marketplace, arbitrary URLs, user health murals, free-text personal place names, persistent camera coordinates, telemetry, a new cache service, or engine replacement.

Any accompanying local HTML review sheet is **a static diagrammatic design document**, not SK7 runtime, an art asset, interactive behavior, an activated content pack or evidence of 3D/FX performance. It stays outside the planned repository docs-only change. Screenshots of that sheet show only its document layout.

## 14. Candidate future implementation slices

Each candidate requires its own then-current Issue and live-source check. Broader candidates are not prerequisites for a narrower one; choose an already completed equivalent instead of reimplementing a letter. Evidence ideas are specified again by candidate in §16.

### 04-A — One coherent arrival composition on the existing plaza

**User outcome:** recognize Today and the companion immediately, locate editing, and retain an independent exit without reading a tutorial.

**Scope:** visual hierarchy and semantic clearance in the current product plaza using its existing content and owner tree. Recompose supporting context and tools where needed. Keep destination mapping, storage projection, slots, player bounds, current camera/input authority and E6 causes intact. No new content library, new asset or saved setting is required.

**First inspection:** `worldScene`, `PlaceableWorld`, `PlaceableExperience`, current camera/input seams and the existing spatial browser cases. Before moving art, identify which meshes contribute camera-only proxies. If coherent arrival requires changing movement/collision or destination meaning, stop treating it as presentation-only and explicitly narrow or re-scope the later Issue.

**Proof / stop:** test arrival, edit, preview/cancel, semantic exit, orbit/reset and world failure at relevant viewports. A beautiful fixed-angle capture is not completion. Do not force 04-B or a new pack framework before finishing A.

### 04-B — One reusable material-role seam without a global repaint

**User outcome:** a related place feels coherent while selected accents and task boundaries remain recognizable under its own lighting.

**Scope:** replace one fragile role-selection technique in one target module with explicit local authoring roles, preserving the intended current geometry and independent instances. Garden's local pavilion treatment is a candidate inspection point, not an already authorized change. No global palette service or browser/account preference change.

**Proof / stop:** compare the changed instance and an unaffected shared-landmark consumer; check supports/grounding, daylight or qualified lighting endpoints, selected cosmetic colors and disposal. Stop if the proposal relies on mutating globally shared material state, changing an asset hash in place or weakening capture/source compatibility checks.

### 04-C — Topology-preserving adaptive scenery for one surface

**User outcome:** a small/short screen still has a legible place, useful movement/control area and the same meaningful actions.

**Scope:** classify and simplify only the selected surface's optional scenery; integrate with its existing composition/quality owner. Preserve real destinations, selected cosmetic representations, semantic exits and movement contract. Explicitly handle camera-proxy coherence. Do not create a service-wide quality detector or equate viewport width with device power.

**Proof / stop:** inspect boundary sizes and actual text/zoom, compare action/destination availability and movement bounds, exercise orbit and active gestures across resize, and measure the specific claimed resource saving. Stop if visual pruning silently removes an interaction or creates an invisible obstruction.

### 04-D — A bounded content-authoring unit using existing representations

**User outcome:** a new composition can be authored coherently without copying an entire world implementation.

**First coherent scope:** under a new task, demonstrate one small authoring unit with explicit role, grounding, envelopes, dependencies and fallback using the supported source/asset chain. No remote pack execution, entitlement, generic scene graph or provider expansion. Actual asset creation, if needed then, must be explicitly in scope and separately qualified; none occurs here.

**Proof / stop:** the unit is deterministic, target-scoped, rejects incomplete required dependencies, retains semantic functionality when optional art fails and cleans up through one owner. Stop if success requires inventing a new broad manifest/activation platform. A second independently justified composition is evidence for reuse, not permission to build twenty speculative packs.

### 04-E — Unavailable selected-art clarity without changing ownership

**User outcome:** distinguish “the picture is unavailable” from “this version cannot edit the stored selection” and from a genuinely empty place.

**Scope:** one current fallback/unsupported presentation path coordinated with Proposal 03 and the existing controller. Retain current values and admitted actions. No replacement save, slot normalization, automatic migration, restore promise or new collection.

**Proof / stop:** fail the visual asset, load an unsupported value, change account during loading, and compare to a confirmed empty snapshot. Check selected storage mode and write count. Stop if a new removal/repair control would bypass current unsupported-state protection. Asset withdrawal/migration is a separate decision, not the same slice.

### 04-F — One additional art theme only after a concrete need

**User outcome:** choose a coherent alternate atmosphere without losing orientation, selected objects, accessibility or task state.

**First coherent scope:** a decision on one theme's role/representations, compatibility and static result. A later implementation can use a narrowly scoped manual visit-local choice if separately approved. Automatic clock/weather/season logic and durable preferences are excluded from the smallest form.

**Proof / stop:** the same destination and selections remain recognizable in normal/static/forced-colors-equivalent operation; repeated switching and failed theme delivery retain the admitted baseline. Timing and interruption require Proposal 05's relevant reasoning. Stop if the only value is more rendering cost, FOMO, or an implicit health interpretation.

## 15. Dependencies and prerequisites

**Proposal 01** contributes actor input/animation/root ownership, not content activation. Any new art envelope must fit the actually qualified poses without enabling unapproved clips. **Proposal 02** owns bridge, history and return; 04 supplies visual orientation, not route mutation. **Proposal 03** owns selected/owned/collection meaning and data-loss language; 04 owns representation compatibility, not entitlements.

**Proposal 05** owns shared sensory cause/time/termination vocabulary while consuming the visual roles and capacities defined here. It does not require a global scheduler and preserves cause-scoped E4/E6 behavior, exact receipt semantics and current surface cancellation. **Proposal 06** owns dates, recorded facts and missingness; seven decorative landmarks are not a record-completion chart. **Proposal 07** and current Model V2 cannot supply lighting or asset-selection inputs.

**Proposal 08** owns UI/account/browser/transient/device scope vocabulary. **Proposal 09** keeps representation failure separate from uncertain writes, account loss and data recovery. **Proposal 10** selects real browser/runtime evidence in proportion to the chosen geometry, input, contrast, performance or lifecycle claim.

Not all ten proposals need to become implementation prerequisites for every small visual change. A task that changes one static material role should not inherit a full Auth or Model V2 regression campaign merely because those boundaries are listed here. A task that changes retained references or cross-owner behavior must not evade the relevant protected review by calling itself visual polish.

## 16. Acceptance and evidence ideas

### 16.1 Candidate-specific proof

| Candidate | Inspect / test at the actual changed seam | Actual experience evidence | Explicitly insufficient |
| --- | --- | --- | --- |
| 04-A arrival | Destination bindings, action boxes, camera proxies, state projection and source-only diff | Arrival → identify destination → edit/preview/cancel → exit; orbit/reset; static/world failure | A single hero screenshot or a document mockup |
| 04-B material roles | Role selection, instance independence, source/capture compatibility and idempotent teardown | Target and unaffected consumer under relevant lighting and viewpoints | Comparing only hex constants |
| 04-C adaptive scenery | Scenic-versus-topological classification, unchanged task/bounds, projection and resource counts | Resize during action, narrow/short/enlarged layout, touch and keyboard alternative | A low DPR or a smaller canvas labelled “mobile optimized” |
| 04-D authoring unit | Exact dependencies, unsupported rejection, allowed imports, ownership/disposal | One complete composition and its failure/static path | A candidate manifest containing many unused entries |
| 04-E unavailable art | No writes/normalization, correct state class, account/browser and stale-load fencing | Empty versus delivery-failed versus unsupported presentation and recovery | A placeholder that looks attractive but lies about selection |
| 04-F theme | Cause, no persistence expansion, selected-ID stability, baseline fallback | Switch/reverse/interruption/static result, readability of same action and object | More effects, longer dwell or automatic seasonal changes |

### 16.2 Six adversarial walkthroughs

**W1 — Same place, smaller window.** Begin at a supported wide arrival view, enter the relevant action, and resize to an intermediate and narrow width. The destination and selected state remain the same. A currently active gesture is reconciled by its owner; art does not teleport the actor or change a socket. Confirm that the controls, not only the scene, remain reachable.

**W2 — Orbit past the pretty angle.** Use the current camera controls to place foreground foliage or the arch near the view line. Validate the actual camera obstruction behavior and reset path. Verify that a decorative Garden path does not masquerade as automatic navigation. A label hidden to protect the header retains an independent semantic action.

**W3 — Static theme, truthful choice.** Disable nonessential motion, use the static/simpler path and inspect a selected color and keepsake. All consequential names and actions remain. E4 saving does not gain a success animation; E6's explicit atmosphere may settle immediately to its qualified endpoint. A high-contrast UI setting does not change the selected ID.

**W4 — Two users, one late load.** Replace the account while content or cosmetic state is pending. Late artwork may not carry the previous selection/receipt into the next owner's scene. Keep browser-only preferences separate from account data. No new diagnostic payload includes account identifiers or health facts.

**W5 — Missing artwork is not an empty slot.** Exercise blocked asset delivery, an unknown stored asset/schema, and a truly empty supported snapshot. Show three different meanings without overwriting any value. Use the existing unsupported contract rather than a partial editor pretending to understand a future version.

**W6 — Visit, leave, repeat.** Open and leave the changed place repeatedly. Inspect renderer/resource counts appropriate to the change and exercise a late load. Unmounting one instance cannot dispose another live instance's mutable resources; resuming cannot replay an obsolete attention or save effect. A passing deterministic disposer test alone does not measure GPU memory on a device.

### 16.3 Evidence proportionality and comprehension

Code inspection is strong for locating owners and forbidden imports, but weak for perceptual clarity. A still capture is useful for spacing, material hierarchy and clipping at that instant, but weak for motion, history, input cancellation or held gestures. Geometry arithmetic catches bounds; actual browser input catches unreachable controls and viewport changes. Device measurements support performance claims only for their recorded environment.

For an instructional claim, ask an operator to identify the next action, distinguish preview from saved, and find recovery without a tutorial. Record the observed confusion as well as success. A one-person rehearsal is not representative usability research. Do not add telemetry, attention tracking, medical logs, engagement scoring or a permanent QA phase just to evaluate the composition.

The minimum coherent first proof is the selected candidate's complete action and failure/static alternative. Broader matrices are warranted when the change actually spans those risks, not by default for every document or color adjustment.

## 17. Risks, unresolved questions and scoped contradiction review

### 17.1 Open decisions

| Question | Current position | Evidence or authority needed |
| --- | --- | --- |
| Which existing place should anchor the next visual reference? | Product plaza is a promising starting point, not an irrevocable choice | Then-live source, actual viewport problem and a bounded Issue |
| Does more sensory richness improve understanding? | A hypothesis; effect quantity is not evidence | Observed unaided action plus FX-off comparison |
| How far should material roles be shared? | One demonstrated reuse before a broad abstraction | Independent consumer compatibility and lifetime evidence |
| Can optional scenery disappear without topology drift? | Only after roles and proxies are classified | Actual movement/orbit and boundary checks |
| Are saved art references safely replaceable? | No silent replacement; current value contract wins | Explicit asset/version/data compatibility decision |
| Does a selected motif reveal the earlier lifestyle choice? | The mapping can be inferred despite storing only an art ID | Minimize secondary exposure; Proposal 08 trust language |
| Should a world theme persist or follow time? | No such new decision is made here | Clear user need plus separate persistence/privacy scope |
| Are current resource caps enough on actual devices? | Unknown from arithmetic or code inspection alone | Measurements of the changed runtime on the claimed device class |
| Is a retained old asset legally/safely deliverable? | Continuity cannot override withdrawal obligations | Explicit content/rights decision, separate from user-data deletion |

### 17.2 Local review against 01–03

This draft preserves Proposal 01's separate root, authored pose, tactile and gaze domains; a content envelope cannot become an additional transform writer. It preserves Proposal 02's navigation-only bridge and bounded return context; a path silhouette is not a route. It preserves Proposal 03's catalog/selection/collection distinction and no-write preview/fallback semantics.

The review found and clarified a wording issue in the accompanying local Proposal 03 copy: E4's static keepsake save contract must not be paraphrased as prohibiting the already qualified E6 environmental lighting response. The precise distinction is documented in §2.6 and §8.9. It grants no new cause or animation. The source `mood` variable also means visit-local lighting, not a persistent companion mood or a user-emotion model.

04's content dossier does not replace the current manifest; its pack vocabulary does not become a second active registry. “Authored,” “procedural,” and “delivered” are clarified as orthogonal properties rather than competing categories. “Adaptive density” is not generalized from S10 into an unimplemented My Space feature. These distinctions avoid silently amplifying statements from the reconnaissance conversation.

**This is a scoped 01–04 consistency pass, not the required completed ten-document contradiction review.** The final review must still reconcile ownership, vocabulary, persistence, privacy, accessibility and Living City authority across all ten drafts, including any later amendments. It must not treat this section as permission to skip that work.

## 18. Live revalidation checklist before any implementation Issue

1. Resolve canonical live `origin/main`; read root `AGENTS.md`, the current task context and relevant open PRs. Use a fresh bounded Issue for implementation, never #899 as standing product authority.
2. Re-open current PROGRAM, Living City and domain contracts. Distinguish current source authorization from historical rollout text, review artifacts and served production.
3. Select one actual user-visible outcome. Verify whether a candidate is already implemented. Read its source, projection, camera/input, asset, semantic and test seams at the same revision.
4. Identify the actual presentation family: decorative Journey scene, product My Space, or isolated Lab. Do not transfer a renderer, coordinate system, culling policy or activation rule by analogy alone.
5. Trace destination identity, content identity, confirmed selection and visit identity separately. Define every writer and cancellation owner; preserve root/input/data authority.
6. Verify the exact active asset and surface capability chain. A Factory candidate, upload, generated descriptor, `review` field or preview screenshot is insufficient. Do not weaken existing verifier or import allowlists.
7. Classify optional art, camera proxies, movement boundaries, interactive objects and semantic controls before editing density. Recompute grounding, dynamic envelopes, projected targets and clearances where relevant.
8. Keep semantic UI theme, world theme, cosmetic color and local atmosphere separate. Revalidate the current E3/E4/E6 exceptions and S05/Model V2 boundaries; do not infer a new event from a similar effect.
9. Define complete entry/action/result and failure/static behavior. No minimum animation delay, optimistic success, hidden unknown write, automatic repair save or ownership-loss story from visual failure.
10. Preserve current account/browser/visit/device boundaries. Unsupported values, old-owner responses, reset/deletion and export claims must follow live contracts, not a content placeholder.
11. Choose evidence proportional to the changed claim: geometry plus actual browser operation for layout/input; frame/video traces for motion; actual zoom/text and focus for accessibility; measured runtime for performance. Mark unrun and inconclusive evidence honestly.
12. Inspect all changed paths and the meaningful diff. Run current required checks, including `git diff --check` and the autopilot guard, before an actual repository publication; use hosted routed checks without claiming skipped suites passed.
13. Re-read adjacent proposals only for the boundaries crossed. Resolve conflicts in the active task and affected draft, not a new ledger or permanent gate registry.
14. Keep source merge, asset delivery, runtime activation and production deployment separate. No design, prior approval or successful local review supplies current external-effect authorization.

---

The durable design goal is **a world that can gain variety without accumulating ambiguity**. Keep the place recognizable, the next action legible, the data truthful and the ownership boundaries small. A richer view is successful when it helps someone act or enjoy the place—not when it merely contains more objects or effects.
