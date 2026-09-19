# S01–S14 scene contracts

A0: decorative aria-hidden visual, empty poster alt, pointer inert; semantic headings/status/buttons; existing focus/navigation; 44px primary targets, 16px mobile form text, 320px reflow and 200% zoom. Character is never a required control.
L0: no scene downloads. L1: viewport-specific asynchronous image/layers only. L3: semantic UI/fallback first; eligible visible recipe only then lazy 3D. LS: unchanged S05 confirmed-save gate.

Current Living Journey visual grammar: S02 is the signed-in visual north star. Presentation follows environment → primary task/action → journey surface → factual/utility layer while each screen keeps its own semantic and runtime ownership. S03–S10 carry that grammar through the core journey; S01 and S12–S14 use the same surface/depth language at entry, empty, recovery, and settings boundaries. S11 remains governed separately by the Model V2 product contract.

## S01
| Field | Contract |
|---|---|
| visual mode | semantic entry + optional real-time companion narrator + read-only preview |
| primary visual | login/auth surface with companion narrator; preview reuses read-only S02 |
| character presence | selected companion when companion runtime is enabled; never required for login |
| environment presence | quiet entry surface; read-only preview exposes S02 environment |
| semantic DOM relationship | email form, status/recovery, companion preference and preview gate |
| mobile composition | login purpose/auth first; narrator and preview remain bounded at 320px |
| desktop composition | purpose/narrator beside strong auth surface |
| allowed animation | companion idle within its independent gate; short semantic feedback |
| prohibited animation | login success reward, health reaction, preview writes |
| loading strategy | semantic form is immediate; companion follows its independent runtime gate |
| fallback | login and preview entry remain complete without companion renderer |
| accessibility behavior | A0 + email labels + 16px mobile input + preview dialog/focus contract |
| performance tier | semantic + optional companion |

## S02
| Field | Contract |
|---|---|
| visual mode | real-time candidate |
| primary visual | large Moa |
| character presence | bear 1 |
| environment presence | today landmark |
| semantic DOM relationship | today/task/separate facts |
| mobile composition | dedicated stage; one focal landmark |
| desktop composition | task beside spacious stage |
| allowed animation | neutral pose; future idle/rest |
| prohibited animation | celebrate/health/participation reaction |
| loading strategy | L3 |
| fallback | T2/T3>T1>T0 |
| accessibility behavior | A0 + future pause |
| performance tier | optimized |

## S03
| Field | Contract |
|---|---|
| visual mode | 2.5D |
| primary visual | large action object |
| character presence | none |
| environment presence | garden fragment |
| semantic DOM relationship | real selection buttons and lock text |
| mobile composition | vertical choices |
| desktop composition | three comparable choices |
| allowed animation | control feedback |
| prohibited animation | selection reward |
| loading strategy | L1 |
| fallback | T1>T0 |
| accessibility behavior | A0 + selected/locked labels |
| performance tier | layered |

## S04
| Field | Contract |
|---|---|
| visual mode | none |
| primary visual | none |
| character presence | none |
| environment presence | none |
| semantic DOM relationship | BP guidance/form/validation |
| mobile composition | single column + keyboard clearance |
| desktop composition | bounded form |
| allowed animation | control feedback |
| prohibited animation | all scene motion |
| loading strategy | L0 |
| fallback | T0 |
| accessibility behavior | A0 + validation focus |
| performance tier | semantic |

## S05
Review migration and recovery matrix: [confirmed-save candidate](scene-s05-migration.md). Production remains the existing independent path.
| Field | Contract |
|---|---|
| visual mode | existing real-time |
| primary visual | bear-lite |
| character presence | bear 1 |
| environment presence | unchanged |
| semantic DOM relationship | confirmed save and next actions |
| mobile composition | current until Phase 6 |
| desktop composition | current until Phase 6 |
| allowed animation | confirmed celebrate once -> idle |
| prohibited animation | optimistic/error/duplicate celebration |
| loading strategy | LS |
| fallback | existing fallback |
| accessibility behavior | A0 + save announcement |
| performance tier | existing |

## S06
| Field | Contract |
|---|---|
| visual mode | static |
| primary visual | approved static illustration |
| character presence | no new companion |
| environment presence | static ground |
| semantic DOM relationship | action/period/lock text |
| mobile composition | text first; omit poster if needed |
| desktop composition | text beside poster |
| allowed animation | semantic entrance |
| prohibited animation | punishment/sad pose |
| loading strategy | L1 |
| fallback | T1>T0 |
| accessibility behavior | A0 + lock wording |
| performance tier | static |

## S07
| Field | Contract |
|---|---|
| visual mode | 2.5D |
| primary visual | today landmark |
| character presence | none |
| environment presence | focal fragment |
| semantic DOM relationship | separate BP/check-in/legacy lanes |
| mobile composition | short visual + fact lanes |
| desktop composition | landmark beside facts |
| allowed animation | short entrance |
| prohibited animation | data-dependent motion |
| loading strategy | L1 |
| fallback | T1>T0 |
| accessibility behavior | A0 + separate headings |
| performance tier | layered |

## S08
| Field | Contract |
|---|---|
| visual mode | none |
| primary visual | none |
| character presence | none |
| environment presence | none |
| semantic DOM relationship | period and grouped records |
| mobile composition | vertical grouped list |
| desktop composition | wider grouped list |
| allowed animation | control feedback |
| prohibited animation | scene/progress motion |
| loading strategy | L0 |
| fallback | T0 |
| accessibility behavior | A0 + list labels |
| performance tier | semantic |

## S09
| Field | Contract |
|---|---|
| visual mode | none |
| primary visual | none |
| character presence | none |
| environment presence | none |
| semantic DOM relationship | record/edit/delete/return |
| mobile composition | continuous detail and controls |
| desktop composition | bounded detail |
| allowed animation | dialog feedback |
| prohibited animation | deletion reward |
| loading strategy | L0 |
| fallback | T0 |
| accessibility behavior | A0 + dialog focus return |
| performance tier | semantic |

## S10
Review implementation: [calendar diorama and responsive posters](scene-s10-diorama.md). Production gate remains closed.

| Field | Contract |
|---|---|
| visual mode | real-time candidate |
| primary visual | focal diorama |
| character presence | bear max 1 |
| environment presence | seven desktop landmarks; focal + one neighbor instantiated on mobile |
| semantic DOM relationship | current/prior facts separate from challenge |
| mobile composition | dedicated 240/280px stage; one landmark and neighbor fragment |
| desktop composition | 420px stage; large focal region + surroundings |
| allowed animation | neutral; future short transition/idle |
| prohibited animation | completion/score/weather/automatic tour |
| loading strategy | L3 |
| fallback | T2/T3>T1>T0 |
| accessibility behavior | A0 + DOM access to all dates |
| performance tier | optimized |

## S11
| Field | Contract |
|---|---|
| visual mode | 2.5D |
| primary visual | neutral static clay layers |
| character presence | none |
| environment presence | no journey world |
| semantic DOM relationship | real ModelV2InputFlow plus synthetic states |
| mobile composition | form first; omit visual |
| desktop composition | neutral object beside form |
| allowed animation | control feedback |
| prohibited animation | scan/pulse/model-state reaction |
| loading strategy | L1 |
| fallback | T1>T0 |
| accessibility behavior | A0 + existing input/status |
| performance tier | layered |

## S12
| Field | Contract |
|---|---|
| visual mode | semantic + CSS-first 2.5D empty garden |
| primary visual | truthful empty-state actions over a quiet garden surface |
| character presence | none |
| environment presence | neutral CSS garden; no reward/failure metaphor |
| semantic DOM relationship | confirmed empty/current-or-prior period + BP/challenge actions + optional S11 tool link |
| mobile composition | factual empty state and BP action first; secondary options follow |
| desktop composition | bounded action surfaces with quiet garden context |
| allowed animation | semantic entrance/control feedback only |
| prohibited animation | withered garden, blame, streak or completion framing |
| loading strategy | L0 semantic/CSS presentation |
| fallback | semantic actions and period remain complete without decoration |
| accessibility behavior | A0 + truthful empty + 200% text/touch-target contract |
| performance tier | semantic / CSS-first |

## S13
| Field | Contract |
|---|---|
| visual mode | semantic recovery surface |
| primary visual | bounded error explanation and one retry action |
| character presence | none |
| environment presence | minimal neutral/coral recovery context |
| semantic DOM relationship | load failure is distinct from truthful empty; retry performs a bounded read |
| mobile composition | explanation and retry remain visible at 200% text |
| desktop composition | centered bounded recovery surface |
| allowed animation | semantic entrance only |
| prohibited animation | storm/anxiety metaphor, retry loop, automatic write |
| loading strategy | L0 semantic/CSS presentation |
| fallback | error explanation and retry control |
| accessibility behavior | A0 + alert/retry + no horizontal overflow |
| performance tier | semantic |

## S14
| Field | Contract |
|---|---|
| visual mode | semantic utility surfaces |
| primary visual | grouped settings surfaces within the Living Journey visual grammar |
| character presence | preference control only; no required scene character |
| environment presence | quiet shared product background; no scene world |
| semantic DOM relationship | companion preference, records/files guidance, help, logout and account deletion |
| mobile composition | vertical grouped settings; destructive action remains explicit |
| desktop composition | bounded grouped settings with utility hierarchy |
| allowed animation | control/dialog feedback only |
| prohibited animation | scene motion, health reaction, deletion reward |
| loading strategy | L0 |
| fallback | semantic settings remain complete without decoration |
| accessibility behavior | A0 + help disclosure + deletion confirmation/focus return |
| performance tier | semantic / CSS-first |

## Mobile focal acceptance
320px: projected Moa height candidate 112–144 CSS px; stage 176–224px. 390px: 132–176px; stage 208–272px. Desktop: Moa 200–280px; stage 320–440px. Measure visible subject, not canvas size. Keep face/ears/silhouette; crop only secondary environment. Short 320x568 may flow visual below controls or omit it, never shrink the desktop world into a thumbnail. No horizontal page scroll. Poster and GLB must use dedicated composition profiles.
