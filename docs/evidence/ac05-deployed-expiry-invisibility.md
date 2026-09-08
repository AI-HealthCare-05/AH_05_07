# AC-05 deployed expired-row invisibility evidence

**Documentation date:** 2026-09-08
**Issue:** [#333](https://github.com/AI-HealthCare-05/AH_05_07/issues/333)
**Target table:** `public.blood_pressure_observations`

## Scope

This record closes only the AC-05 / R-03 evidence gap for deployed expired-row
invisibility before physical purge. It does not claim broader security
guarantees, every future schema version, or natural thirty-day observation.

## Baselines

- **Phase A source:** `f6a53d17e4c1503e1263e0aba2f8d23629cc21f2`
- **Phase B execution source:** `8a479fa0aefb9e0dce945cce9fde51c4d77d77d0`
- **Documentation baseline:** `49763e499e7bf782e7a397da9f92214ebc563275` (latest `origin/main` incorporated before final PR verification)

Between Phase A and Phase B, the Supabase migration and exact-time retention
contract were rechecked and remained unchanged. This documentation records the
already-completed owner-approved exercise; Phase B was not rerun.

## Environment

- Deployed Supabase production project
- PostgreSQL healthy
- Exact-time retention migration deployed
- RLS enabled
- Target table: `public.blood_pressure_observations`

No credentials, connection strings, project secrets, raw SQL, or raw database
output are retained here.

## Phase A

- Deployed migrations aligned with the repository: **PASS**
- Four retention-related product tables have expected authenticated RLS: **PASS**
- `auth.uid() = user_id AND expires_at > now()` contract present: **PASS**
- Local 17-assertion exact-time retention pgTAP contract aligned: **PASS**
- Transaction/auth simulation readiness: **PASS**
- Production mutations during Phase A: **0**

## Phase B

The sanitized production exercise results were:

- Synthetic fresh owner visibility: **PASS**
- Synthetic expiry transition: **PASS**
- Physical row presence after expiry: **PASS**
- Same expired row invisible to authenticated synthetic owner: **PASS**
- Invisibility proven before physical purge: **PASS**
- Transaction rollback: **PASS**
- Residual synthetic Auth rows: **0**
- Residual synthetic BP rows: **0**

Synthetic identifiers, email addresses, BP values, JWTs, service-role keys, raw
SQL, database credentials, and raw row output are intentionally excluded.

## Safety

- Synthetic production writes: transaction-local and fully rolled back; residual rows 0.
- Real accounts used: 0.
- Existing production product/health records touched: 0.
- Production clock changes: 0.
- Migration changes: 0.
- RLS/schema changes: 0.
- Deployment changes: 0.
- AI Model actions: 0.

## Conclusion

The deployed expired-row invisibility before physical purge evidence gap is
verified for the reviewed retention/RLS contract.
