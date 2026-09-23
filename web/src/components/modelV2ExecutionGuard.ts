export type ModelV2ExecutionToken = Readonly<{
  scopeId: string;
  generation: number;
}>;

export type ModelV2ExecutionGuard = Readonly<{
  capture: () => ModelV2ExecutionToken | null;
  isCurrent: (token: ModelV2ExecutionToken) => boolean;
}>;

export function createModelV2SessionGuard(
  getIdentity: () => { userId: string | null; generation: number },
): ModelV2ExecutionGuard {
  return {
    capture: () => {
      const { userId, generation } = getIdentity();
      if (!userId) return null;
      return { scopeId: userId, generation };
    },
    isCurrent: (token) => {
      const { userId, generation } = getIdentity();
      return userId === token.scopeId && generation === token.generation;
    },
  };
}

/**
 * Guest S11 uses one stable guard per mounted ModelV2InputFlow instance.
 * Stale-completion safety comes from the React mount boundary
 * (ModelV2InputFlow's mounted ref cleanup) plus this per-mount opaque token,
 * not from a fake account, a global generation manager, or token revocation.
 * Navigating away unmounts the flow; returning mounts a fresh flow with a
 * fresh guard. A page reload creates a fresh JS/component instance.
 */
export function createModelV2GuestGuard(): ModelV2ExecutionGuard {
  const scopeId = "guest";
  // Object identity is the per-instance guard boundary. The generation field
  // is ignored for guests because there is no account/session generation.
  const token: ModelV2ExecutionToken = Object.freeze({ scopeId, generation: 0 });
  return {
    capture: () => token,
    isCurrent: (candidate) => candidate === token,
  };
}
