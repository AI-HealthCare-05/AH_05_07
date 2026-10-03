// Navigation context only, carried by this visit's URL. Never a snapshot, user
// identity, redirect URL or storage authority. E2 verifies and reads on return.
export type MySpaceView = "classic" | "3d";
export type MySpaceStorage = "browser" | "account";
export type MySpaceReturnPlace = "garden-nook";
export type MySpaceReturn = Readonly<{
  view: MySpaceView;
  storage: MySpaceStorage;
}>;

export const mySpaceViewLabel: Readonly<Record<MySpaceView, string>> = Object.freeze({
  classic: "간단한 광장",
  "3d": "3D 광장",
});

export const mySpaceStorageLabel: Readonly<Record<MySpaceStorage, string>> = Object.freeze({
  browser: "이 브라우저의 공간",
  account: "계정 공간",
});

export const mySpaceReturnPlaceLabel: Readonly<Record<MySpaceReturnPlace, string>> = Object.freeze({
  "garden-nook": "정원 쉼터",
});

export function mySpaceContextLabel(space: MySpaceReturn): string {
  return `${mySpaceStorageLabel[space.storage]} · ${mySpaceViewLabel[space.view]}`;
}

export function readMySpaceReturn(search: string): MySpaceReturn | null {
  const params = new URLSearchParams(search);
  if (params.getAll("return_space").length !== 1) return null;
  const match = /^(classic|3d)-(browser|account)$/.exec(params.get("return_space") ?? "");
  return match ? { view: match[1] as MySpaceReturn["view"], storage: match[2] as MySpaceReturn["storage"] } : null;
}

/** Exact raw E2 request context for return authority only.
 * Renderer fallbacks remain owned by ProductPlaceableEntry. */
export function readMySpaceRouteRequest(search: string): MySpaceReturn | null {
  const params = new URLSearchParams(search);
  if (params.getAll("view").length !== 1 || params.getAll("storage").length !== 1) return null;
  const view = params.get("view");
  const storage = params.get("storage");
  if (view !== "classic" && view !== "3d") return null;
  if (storage !== "browser" && storage !== "account") return null;
  return { view, storage };
}

export function readMySpaceReturnPlace(search: string): MySpaceReturnPlace | null {
  const params = new URLSearchParams(search);
  if (params.getAll("return_place").length !== 1) return null;
  return params.get("return_place") === "garden-nook" ? "garden-nook" : null;
}

export function mySpaceReturnPlaceQuery(place: MySpaceReturnPlace | null | undefined): string {
  return place === "garden-nook" ? "&return_place=garden-nook" : "";
}

export function classicTodayHref(view: MySpaceReturn["view"], storage: MySpaceReturn["storage"]) {
  return `?screen=S02&return_space=${view}-${storage}`;
}
