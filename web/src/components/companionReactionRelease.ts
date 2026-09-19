const COMPANION_REACTION_RELEASE_MS = 300;

type CompanionReactionReleaseOptions<Handle> = Readonly<{
  onElapsed: () => void;
  schedule: (callback: () => void, delayMs: number) => Handle;
  cancelScheduled: (handle: Handle) => void;
}>;

export function createCompanionReactionRelease<Handle>({
  onElapsed,
  schedule,
  cancelScheduled,
}: CompanionReactionReleaseOptions<Handle>) {
  let pendingHandle: Handle | undefined;

  const cancel = () => {
    if (pendingHandle !== undefined) {
      cancelScheduled(pendingHandle);
      pendingHandle = undefined;
    }
  };

  const release = () => {
    cancel();
    const handle = schedule(() => {
      if (pendingHandle !== handle) return;
      pendingHandle = undefined;
      onElapsed();
    }, COMPANION_REACTION_RELEASE_MS);
    pendingHandle = handle;
  };

  return { release, cancel };
}
