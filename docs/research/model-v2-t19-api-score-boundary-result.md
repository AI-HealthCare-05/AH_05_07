# Model V2 T19 — API Numeric Score Boundary Result

Status: **PASS_API_TRANSPORT_SCORE_HIDDEN**

Starting main: `d5c5469fd8bd2090267abb14325ad6dcfaeb81fa`

Issue: `#353`

## Purpose

T19 removes the internal continuous Model V2 score from the authenticated HTTP response while preserving the frozen inference computation and existing authentication and semantic-input boundaries.

## Change

Successful Model V2 API responses now contain only:

- `schema_version`
- `product_wording`

The inference boundary still executes. Its internal continuous score is no longer serialized into the HTTP response.

## Baseline coupling check

Before the patch, the repository frontend was checked for a direct reference to:

`/api/v1/model-v2/score`

No frontend reference was found.

## Unchanged boundaries

T19 does not change authentication, the exact 11-feature semantic input contract, malformed-input fail-closed behavior, frozen model artifact, artifact SHA, schema version, preprocessing, product wording, database persistence, analytics, UI rendering, production traffic authorization, or research-data collection authorization.

Frozen artifact SHA-256 remains:

`d0f3bc407edae83db0852e9b393831b02cc5420a49fbc447d8d108f99c69ed84`

Product wording remains **입력 기반 위험군 선별 신호**.

## Verification target

A valid enabled-path response must return HTTP 200, preserve the schema and approved product wording, and contain no `score` key.

T19 is a transport-boundary hardening task. It does not authorize any new user-visible Model V2 result representation.
