// Navigation context only, carried by this visit's URL. Never a snapshot, user
// identity, redirect URL or storage authority. E2 verifies and reads on return.
export type MySpaceView = "classic" | "3d";
export type MySpaceStorage = "browser" | "account";
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

export function mySpaceContextLabel(space: MySpaceReturn): string {
  return `${mySpaceStorageLabel[space.storage]} · ${mySpaceViewLabel[space.view]}`;
}

export function readMySpaceReturn(search: string): MySpaceReturn | null {
  const params = new URLSearchParams(search);
  if (params.getAll("return_space").length !== 1) return null;
  const match = /^(classic|3d)-(browser|account)$/.exec(params.get("return_space") ?? "");
  return match ? { view: match[1] as MySpaceReturn["view"], storage: match[2] as MySpaceReturn["storage"] } : null;
}

export function classicTodayHref(view: MySpaceReturn["view"], storage: MySpaceReturn["storage"]) {
  return `?screen=S02&return_space=${view}-${storage}`;
}
