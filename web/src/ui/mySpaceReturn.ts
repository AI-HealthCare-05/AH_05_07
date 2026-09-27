// Navigation context only, carried by this visit's URL. Never a snapshot, user
// identity, redirect URL or storage authority. E2 verifies and reads on return.
type MySpaceReturn = Readonly<{ view: "classic" | "3d"; storage: "browser" | "account" }>;

export function readMySpaceReturn(search: string): MySpaceReturn | null {
  const params = new URLSearchParams(search);
  if (params.getAll("return_space").length !== 1) return null;
  const match = /^(classic|3d)-(browser|account)$/.exec(params.get("return_space") ?? "");
  return match ? { view: match[1] as MySpaceReturn["view"], storage: match[2] as MySpaceReturn["storage"] } : null;
}

export function classicTodayHref(view: MySpaceReturn["view"], storage: MySpaceReturn["storage"]) {
  return `?screen=S02&return_space=${view}-${storage}`;
}
