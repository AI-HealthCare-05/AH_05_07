# S01–S14 scene contracts

A0: decorative aria-hidden visual, empty poster alt, pointer inert; semantic headings/status/buttons; existing focus/navigation; 44px primary targets, 16px mobile form text, 320px reflow and 200% zoom. Character is never a required control.
L0: no scene downloads. L1: viewport-specific asynchronous image/layers only. L3: semantic UI/fallback first; eligible visible recipe only then lazy 3D. LS: unchanged S05 confirmed-save gate.

## S01
| Field | Contract |
|---|---|
| visual mode | static |
| primary visual | gate poster |
| character presence | none |
| environment presence | gate fragment |
| semantic DOM relationship | email form, status and recovery |
| mobile composition | form first; optional short gate |
| desktop composition | form beside gate |
| allowed animation | short semantic fade |
| prohibited animation | loop/reward |
| loading strategy | L1 |
| fallback | T1>T0 |
| accessibility behavior | A0 + email labels |
| performance tier | static |

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
| visual mode | static |
| primary visual | approved empty poster |
| character presence | existing static only |
| environment presence | neutral garden |
| semantic DOM relationship | confirmed empty + two actions |
| mobile composition | actions + large optional poster |
| desktop composition | text beside poster |
| allowed animation | semantic entrance |
| prohibited animation | withered garden/blame |
| loading strategy | L1 |
| fallback | T1>T0 |
| accessibility behavior | A0 + truthful empty |
| performance tier | static |

## S13
| Field | Contract |
|---|---|
| visual mode | static |
| primary visual | approved retry poster |
| character presence | existing static only |
| environment presence | minimal neutral |
| semantic DOM relationship | load failure and retry |
| mobile composition | retry first |
| desktop composition | text beside poster |
| allowed animation | semantic entrance |
| prohibited animation | storm/anxiety/retry loop |
| loading strategy | L1 |
| fallback | T1>T0 |
| accessibility behavior | A0 + error/retry |
| performance tier | static |

## S14
| Field | Contract |
|---|---|
| visual mode | none |
| primary visual | none |
| character presence | none |
| environment presence | none |
| semantic DOM relationship | settings/account deletion/help |
| mobile composition | vertical settings |
| desktop composition | bounded settings |
| allowed animation | dialog feedback |
| prohibited animation | scene motion |
| loading strategy | L0 |
| fallback | T0 |
| accessibility behavior | A0 + deletion confirmation |
| performance tier | semantic |

## Mobile focal acceptance
320px: projected Moa height candidate 112–144 CSS px; stage 176–224px. 390px: 132–176px; stage 208–272px. Desktop: Moa 200–280px; stage 320–440px. Measure visible subject, not canvas size. Keep face/ears/silhouette; crop only secondary environment. Short 320x568 may flow visual below controls or omit it, never shrink the desktop world into a thumbnail. No horizontal page scroll. Poster and GLB must use dedicated composition profiles.
