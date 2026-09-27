export const REGISTERED_SEMANTIC_DESTINATIONS = Object.freeze({
  today: "/?screen=S02",
} as const);

export type RegisteredSemanticDestination = keyof typeof REGISTERED_SEMANTIC_DESTINATIONS;

export type WorldSemanticIntent = Readonly<{
  kind: "navigate";
  destination: RegisteredSemanticDestination;
}>;

export const TODAY_SEMANTIC_INTENT: WorldSemanticIntent = Object.freeze({
  kind: "navigate",
  destination: "today",
});

function validHttpOrigin(candidate: string): string {
  const parsed = new URL(candidate);
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("product origin must use http or https");
  }
  if (parsed.username || parsed.password) {
    throw new Error("product origin must not include credentials");
  }
  return parsed.origin;
}

export function resolveProductOrigin(
  currentOrigin: string,
  explicitProductOrigin?: string | null,
): string {
  const current = new URL(validHttpOrigin(currentOrigin));

  if (explicitProductOrigin?.trim()) {
    const explicit = new URL(validHttpOrigin(explicitProductOrigin.trim()));
    if (explicit.hostname !== current.hostname) {
      throw new Error("product origin override must share the current hostname");
    }
    return explicit.origin;
  }

  if (
    current.protocol === "http:"
    && (current.hostname === "127.0.0.1" || current.hostname === "localhost")
    && current.port === "4179"
  ) {
    return `${current.protocol}//${current.hostname}:4173`;
  }
  return current.origin;
}

export function worldSemanticIntentHref(
  intent: WorldSemanticIntent,
  currentOrigin: string,
  explicitProductOrigin?: string | null,
): string {
  const path = REGISTERED_SEMANTIC_DESTINATIONS[intent.destination];
  return new URL(path, resolveProductOrigin(currentOrigin, explicitProductOrigin)).toString();
}
