export const SCHEMA = "placeable.v1";
export const LAYOUT = "e1-plaza.v1";
export const ASSET = "welcome-pinwheel-v1";
export const COLORS = { coral: "#ee765f", teal: "#238b88", sunflower: "#dfb641" } as const;
// Authored in E1 world metres. Clear of spawn, gate approach, weekday markers,
// paths and the world boundary. Cosmetics never add movement colliders.
export const SOCKETS = [
  { id: "gate-left", label: "Gate left", x: -1.55, z: -1.6 },
  { id: "gate-right", label: "Gate right", x: 1.55, z: -1.6 },
  { id: "plaza-edge", label: "Plaza edge", x: 1.8, z: 1.25 },
] as const;
export type Selection = Readonly<{
  assetId: typeof ASSET;
  color: keyof typeof COLORS;
  socketId: (typeof SOCKETS)[number]["id"];
}>;
export type Snapshot = Readonly<{
  revision: number;
  schemaVersion: string;
  layoutId: string;
  selection: unknown;
  latestOperationId: string | null;
  latestFingerprint: string | null;
}>;
export type Operation = Readonly<{
  operationId: string;
  expectedRevision: number;
  schemaVersion: typeof SCHEMA;
  layoutId: typeof LAYOUT;
  selection: Selection | null;
}>;
export const emptySnapshot = (): Snapshot => ({
  revision: 0, schemaVersion: SCHEMA, layoutId: LAYOUT,
  selection: null, latestOperationId: null, latestFingerprint: null,
});
function freezeJson(value: unknown): void {
  if (!value || typeof value !== "object") return;
  Object.values(value).forEach(freezeJson);
  Object.freeze(value);
}
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
export function isSelection(value: unknown): value is Selection | null {
  return value === null || (record(value) && Object.keys(value).length === 3
    && value.assetId === ASSET && typeof value.color === "string" && Object.hasOwn(COLORS, value.color)
    && SOCKETS.some((socket) => socket.id === value.socketId));
}
export function supported(snapshot: Snapshot): boolean {
  return snapshot.schemaVersion === SCHEMA && snapshot.layoutId === LAYOUT && isSelection(snapshot.selection);
}
export function readSnapshot(value: unknown): Snapshot {
  if (!record(value) || !Number.isSafeInteger(value.revision) || Number(value.revision) < 0
    || typeof value.schemaVersion !== "string" || typeof value.layoutId !== "string"
    || !Object.hasOwn(value, "selection")
    || !(value.latestOperationId === null || (typeof value.latestOperationId === "string"
      && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.latestOperationId)))
    || !(value.latestFingerprint === null || (typeof value.latestFingerprint === "string" && /^[a-f0-9]{64}$/.test(value.latestFingerprint)))
    || (value.revision === 0 ? value.latestOperationId !== null || value.latestFingerprint !== null
      : value.latestOperationId === null || value.latestFingerprint === null)
    || Object.keys(value).some((key) => !Object.hasOwn(emptySnapshot(), key))) throw new Error("Invalid snapshot");
  // Unknown selection/schema/layout survives unchanged; it is never normalized to unplaced.
  const snapshot = structuredClone(value);
  freezeJson(snapshot);
  return snapshot as Snapshot;
}
export function sameSelection(left: unknown, right: unknown): boolean {
  if (left === null || right === null) return left === right;
  return isSelection(left) && isSelection(right) && left.assetId === right.assetId
    && left.color === right.color && left.socketId === right.socketId;
}
export async function fingerprint(operation: Operation): Promise<string> {
  const { expectedRevision, schemaVersion, layoutId, selection } = operation;
  const text = [expectedRevision, schemaVersion, layoutId, selection?.assetId ?? "-",
    selection?.color ?? "-", selection?.socketId ?? "-"].join("|");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
export function confirms(snapshot: Snapshot, operation: Operation, hash: string): boolean {
  return snapshot.revision === operation.expectedRevision + 1
    && snapshot.latestOperationId === operation.operationId && snapshot.latestFingerprint === hash
    && snapshot.schemaVersion === operation.schemaVersion && snapshot.layoutId === operation.layoutId
    && sameSelection(snapshot.selection, operation.selection);
}
export function isPlaceableRoute(search: string, hash = ""): boolean {
  const params = new URLSearchParams(search);
  return params.get("experience") === "e2" && !params.has("screen")
    && params.get("guest") !== "1" && !params.has("auth") && !params.has("code") && !params.has("token_hash")
    && !/(?:^#|&)(?:access_token|refresh_token|error|type)=/.test(hash);
}
