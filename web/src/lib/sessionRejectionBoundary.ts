export type AuthoritativeSessionRejection = "session-invalid" | "owner-deleted";

export const AUTHORITATIVE_SESSION_REJECTION_CHANNEL = "sk7:authoritative-session-rejection:v1";

type RejectionMessage = Readonly<{
  version: 1;
  tokenFingerprint: string;
  reason: AuthoritativeSessionRejection;
}>;

async function tokenFingerprint(accessToken: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(accessToken));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function readMessage(value: unknown): RejectionMessage | null {
  if (typeof value !== "object" || value === null) return null;
  const candidate = value as Partial<RejectionMessage>;
  if (
    candidate.version !== 1
    || typeof candidate.tokenFingerprint !== "string"
    || !/^[0-9a-f]{64}$/.test(candidate.tokenFingerprint)
    || (candidate.reason !== "session-invalid" && candidate.reason !== "owner-deleted")
  ) return null;
  return Object.freeze({
    version: 1,
    tokenFingerprint: candidate.tokenFingerprint,
    reason: candidate.reason,
  });
}

export async function publishAuthoritativeSessionRejection(
  accessToken: string,
  reason: AuthoritativeSessionRejection,
): Promise<void> {
  if (typeof BroadcastChannel === "undefined") return;
  const tokenHash = await tokenFingerprint(accessToken);
  const channel = new BroadcastChannel(AUTHORITATIVE_SESSION_REJECTION_CHANNEL);
  try {
    channel.postMessage({ version: 1, tokenFingerprint: tokenHash, reason } satisfies RejectionMessage);
  } finally {
    channel.close();
  }
}

export function subscribeAuthoritativeSessionRejection(
  currentAccessToken: () => string | null,
  onRejected: (reason: AuthoritativeSessionRejection) => void,
): () => void {
  if (typeof BroadcastChannel === "undefined") return () => undefined;

  const channel = new BroadcastChannel(AUTHORITATIVE_SESSION_REJECTION_CHANNEL);
  let active = true;

  const onMessage = (event: MessageEvent<unknown>) => {
    const message = readMessage(event.data);
    if (!active || !message) return;

    const capturedToken = currentAccessToken();
    if (!capturedToken) return;

    void tokenFingerprint(capturedToken).then((currentFingerprint) => {
      if (
        !active
        || currentFingerprint !== message.tokenFingerprint
        || currentAccessToken() !== capturedToken
      ) return;
      onRejected(message.reason);
    }).catch(() => undefined);
  };

  channel.addEventListener("message", onMessage);
  return () => {
    active = false;
    channel.removeEventListener("message", onMessage);
    channel.close();
  };
}
