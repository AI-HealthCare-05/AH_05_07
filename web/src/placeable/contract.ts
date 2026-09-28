export const SCHEMA = "placeable.v1";
export const LAYOUT = "e1-plaza.v1";
export const SCHEMA_V2 = "placeable.v2";
export const LAYOUT_V2 = "e1-plaza.v2";
export const KEEPSAKES = ["plaza-ribbon-v1", "quiet-moon-v1", "garden-leaf-v1"] as const;
export type Keepsake = (typeof KEEPSAKES)[number];
export type CosmeticLayout = Readonly<{ pinwheel: Selection | null; keepsake: Keepsake | null }>;
export const ASSET = "welcome-pinwheel-v1";
export const COLORS = { coral: "#ee765f", teal: "#238b88", sunflower: "#dfb641" } as const;
// Authored in E1 world metres. Clear of spawn, gate approach, weekday markers,
// paths and the world boundary. Cosmetics never add movement colliders.
export const SOCKETS = [
  { id: "gate-left", label: "입구 왼쪽", x: -1.55, z: -1.6 },
  { id: "gate-right", label: "입구 오른쪽", x: 1.55, z: -1.6 },
  { id: "plaza-edge", label: "광장 가장자리", x: 1.8, z: 1.25 },
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
  schemaVersion: typeof SCHEMA | typeof SCHEMA_V2;
  layoutId: typeof LAYOUT | typeof LAYOUT_V2;
  selection: Selection | CosmeticLayout | null;
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
  return supportedValue(snapshot.schemaVersion, snapshot.layoutId, snapshot.selection);
}
export function isKeepsake(value: unknown): value is Keepsake | null {
  return value === null || KEEPSAKES.some((id) => id === value);
}
export function isCosmeticLayout(value: unknown): value is CosmeticLayout {
  return record(value) && Object.keys(value).length === 2 && Object.hasOwn(value, "pinwheel")
    && Object.hasOwn(value, "keepsake") && isSelection(value.pinwheel) && isKeepsake(value.keepsake);
}
export function supportedValue(schema: string, layout: string, selection: unknown): boolean {
  return (schema === SCHEMA && layout === LAYOUT && isSelection(selection))
    || (schema === SCHEMA_V2 && layout === LAYOUT_V2 && isCosmeticLayout(selection));
}
// Projection only; callers must gate writes with supported(). No read migrates storage.
export function cosmeticLayout(snapshot: Snapshot | null): CosmeticLayout {
  if (!snapshot || !supported(snapshot)) return { pinwheel: null, keepsake: null };
  return isCosmeticLayout(snapshot.selection) ? snapshot.selection
    : { pinwheel: snapshot.selection as Selection | null, keepsake: null };
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
  if (isCosmeticLayout(left) && isCosmeticLayout(right)) {
    return sameSelection(left.pinwheel, right.pinwheel) && left.keepsake === right.keepsake;
  }
  return isSelection(left) && isSelection(right) && left.assetId === right.assetId
    && left.color === right.color && left.socketId === right.socketId;
}
export async function fingerprint(operation: Operation): Promise<string> {
  const { expectedRevision, schemaVersion, layoutId, selection } = operation;
  const pinwheel = isCosmeticLayout(selection) ? selection.pinwheel : selection;
  const fields = [expectedRevision, schemaVersion, layoutId, pinwheel?.assetId ?? "-",
    pinwheel?.color ?? "-", pinwheel?.socketId ?? "-"];
  if (schemaVersion === SCHEMA_V2) fields.push(isCosmeticLayout(selection) ? selection.keepsake ?? "-" : "-");
  const text = fields.join("|");
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
