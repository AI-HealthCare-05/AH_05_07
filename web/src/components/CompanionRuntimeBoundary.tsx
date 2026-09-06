import { resolveCompanionRuntimeConfig } from "../ui/companion";

type CompanionRuntimeBoundaryProps = {
  mode: unknown;
};

/**
 * Keeps the future companion runtime behind a fail-closed, non-visual boundary.
 * Both modes intentionally render no assets until S2 usage and rights are approved.
 */
export function CompanionRuntimeBoundary({ mode }: CompanionRuntimeBoundaryProps) {
  const config = resolveCompanionRuntimeConfig(mode);
  if (!config.enabled) return null;
  // Review mode is intentionally a no-op until a separately approved asset source exists.
  return null;
}
