/**
 * Verified render bytes presented to the reusable world renderer.
 *
 * Provenance, hashes, membership and admission decisions stay with the caller.
 */
export interface WorldRenderableAsset {
  readonly bytes: ArrayBuffer;
}
