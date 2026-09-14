export type AuthEmailConfirmIntent =
  | { kind: "none" }
  | { kind: "invalid" }
  | { kind: "verify"; tokenHash: string };

const authEmailConfirmPath = "/auth/confirm";

function readTokenParams(url: URL): URLSearchParams {
  const fragment = new URLSearchParams(url.hash.startsWith("#") ? url.hash.slice(1) : url.hash);
  if (fragment.has("token_hash") || fragment.has("type")) return fragment;
  return url.searchParams;
}

export function resolveAuthEmailConfirmIntent(href: string): AuthEmailConfirmIntent {
  const url = new URL(href);
  if (url.pathname !== authEmailConfirmPath) return { kind: "none" };

  const params = readTokenParams(url);
  const tokenHash = params.get("token_hash")?.trim();
  if (!tokenHash || params.get("type") !== "email") return { kind: "invalid" };

  return { kind: "verify", tokenHash };
}

export function scrubAuthEmailConfirmUrl(href: string): string {
  const url = new URL(href);
  url.pathname = "/";
  url.search = "";
  url.hash = "";
  return url.toString();
}
