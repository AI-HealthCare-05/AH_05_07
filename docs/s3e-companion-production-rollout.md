# S3E companion production rollout

Evidence record date: 2026-09-07.

## Scope

- Issue [#252](https://github.com/AI-HealthCare-05/AH_05_07/issues/252)
- Implementation [PR #255](https://github.com/AI-HealthCare-05/AH_05_07/pull/255)
- S3D-approved narrow scope only
- Source baseline: merged `main` commit `30fd65eda8d988804c8af208276934226e0eb67d`

## Production profile

- Screen: S05 only
- Asset: `bear`, `lite`
- Trigger: confirmed `save_success`
- Animation: `celebrate` exactly once, then `idle`
- Companion is decorative only
- Cloudflare build variable: `VITE_SK7_COMPANION_MODE=production` (normal plaintext build variable)
- Live final variable state: `production`

## Activation evidence

- Deployment mirror sync: SUCCESS (operator reported successful deployment mirror sync)
- Cloudflare build/deploy: SUCCESS
- Baseline Worker version: `c7f85901-e427-4cb7-8efe-4ca5c1a32443`
- Baseline public deployment smoke: PASS
- First production activation Worker version: `70f9d4d5-6377-4087-a405-63993382441c`
- Deployment smoke: PASS
- GLB before confirmed save: `0`
- GLB after confirmed save: exactly `1`
- Loaded asset: `bear` / `lite`
- Bear visible: YES
- Celebrate exactly once: PASS
- Transition to idle: PASS
- S05 core UI: PASS

## Rollback evidence

- Rollback target: `c7f85901-e427-4cb7-8efe-4ca5c1a32443`
- Rollback completed: YES
- Deployment smoke: PASS
- GLB before save: `0`
- GLB after save: `0`
- Bear visible after save: NO
- S05 core UI: PASS

## Final restore evidence

- Restored Worker version: `70f9d4d5-6377-4087-a405-63993382441c`
- Restore completed: YES
- Final deployment smoke: PASS
- GLB before save: `0`
- GLB after save: exactly `1`
- Bear visible: YES
- Celebrate exactly once: PASS
- Transition to idle: PASS
- S05 core UI: PASS
- Final production state: ACTIVE

## Network boundary

| State | Companion GLB request |
| --- | ---: |
| Before confirmed successful save | 0 |
| After confirmed successful save | exactly 1 bear-lite GLB |
| Rollback Worker after save | 0 |

The production companion creates no request before save confirmation, reads only the
approved bear-lite GLB once after a confirmed successful save, and does not affect
the core product when it is off or unavailable.

## Safety/semantic boundary

The companion remains independent of:

- blood pressure values
- 입력 기반 위험군 선별 신호
- model outputs
- challenge adherence or completion
- inferred health improvement
- diagnosis, treatment, or prevention

The rollout evidence verifies reversible deployment, rollback isolation, and
preservation of the S05 core UI in both active and rolled-back states.

## Asset boundary

- R2 object changes: 0
- GLB bytes/SHA changes: 0
- CORS changes: 0

## Runtime boundary

- Cloud Run changes: 0
- Supabase changes: 0
- API changes: 0
- Product UI and animation code changes in this closeout: 0

## Final decision

- S3E production rollout: COMPLETE
- Final production companion: ACTIVE
- Rollback rehearsal: PASS
