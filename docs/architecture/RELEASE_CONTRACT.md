# Release contract

## Release identity

Source, build, runtime, data schema, model, verification, and rollback are separate facts. A release identity records, as applicable: upstream source SHA; Issue/PR; CI verification identity; repository-controlled release-input fingerprints; build identity and submitted-source provenance; resolved external build-image digests; API image digest; Cloud Run revision; Cloudflare deployment snapshot/source; Cloudflare Worker version; Supabase migration inventory/checksums; model artifact digest and schema version; public-config fingerprint; verification gates/results; and rollback API revision/image and Worker version. Values are immutable identifiers; secret values are prohibited.

Merged source is not a deployed runtime. Git sync alone does not prove a Cloudflare runtime. A rollback target is a distinct known-good runtime identity. Historical entries stay historical and do not become current merely because they are copied into a ledger. Docs-only commits require no production deployment.

## API release provenance manifest

Each production API release should have a repository-owned immutable provenance manifest. The manifest records historical evidence; it does not redeploy, rebuild, or mutate the recorded runtime.

At minimum, record:

- upstream source commit and tree identity;
- repository-controlled build-input presence/absence and SHA-256 fingerprints;
- the application COPY-input fingerprint used by the Docker build;
- Cloud Build identity, location, status, and submitted-source identity;
- the submitted source archive SHA-256 when Cloud Build uses a storage source;
- whether Cloud Build provenance natively binds the submitted source to a Git commit;
- resolved digests of external build/base images observed for that build;
- immutable API output-image digest;
- Cloud Run revision and only those runtime facts actually re-verified;
- frozen Model V2 artifact/schema identity by reference only;
- verification results and known provenance limitations.

Do not treat an image tag containing a Git SHA as native source provenance. When Cloud Build records only an immutable storage source, preserve that fact and separately record any verified source-content comparison.

Resolved historical digests for mutable Docker references document what a build used; they do not mean the Dockerfile reference itself is pinned, and they do not claim a hermetic or bit-for-bit reproducible build.

Repository-controlled fields must be verifiable offline from local Git objects and the manifest.

Verifier command: `python3 scripts/ops/verify_release_provenance.py <manifest>`

The verifier must require no production credentials or network access and must fail closed when a recorded repository-controlled fingerprint or source identity does not match.

## Recorded S11 release evidence

The retained source/runtime/rollback tuple and operator verification are owned by
[deployment SSOT](../deployment-ssot.md#recorded-model-v2-s11-production-evidence).
API provenance remains in [release-s11-api.json](release-s11-api.json); its
immutable evidence is unchanged. Do not maintain a second current-runtime table here.

R9 independently re-read the recorded Cloud Run revision/image identity; that
read-only recheck did not assert serving-traffic percentage. Keep this scope
separate from the original operator activation record. Neither this reference
nor a documentation edit verifies today's runtime. Capture current, compatible
API/web and distinct rollback identities before a new release or recovery.
