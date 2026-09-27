import { useState } from "react";
import { readMySpaceReturn } from "./mySpaceReturn";
import "./mySpaceReturn.css";

export type MySpaceEntryDisplay = { href: string; returning: boolean; browserOnly: boolean };

/** Display only: App supplies bounded intent; the destination verifies storage. */
export function MySpaceEntry({ destination }: { destination: MySpaceEntryDisplay }) {
  return <nav className="today-my-space" aria-label="내 공간 · Living City">
    <div className="section-header"><strong>내 공간 <span>· Living City</span></strong>
      <p>{destination.browserOnly ? "이 브라우저에 꾸며 둔 공간에서 쉬어가요." : "동반자와 함께, 나만의 광장과 정원에서 쉬어가요."}</p>
    </div>
    <a href={destination.href}>{destination.returning ? "Return to My Space" : "내 공간으로 가기"} <span aria-hidden="true">↗</span></a>
  </nav>;
}

/** The semantic shell keeps an escape path even at sign-in/read failure.
 * It imports no E2 runtime and never interprets a placement or auth state. */
export function MySpaceReturn() {
  const [space] = useState(() => readMySpaceReturn(window.location.search));
  if (!space) return null;
  return <nav className="my-space-return" aria-label="Living City return">
    <div><strong>Living City</strong><span>{space.storage === "browser" ? "Browser-only space" : "Account space · session verified on return"}</span></div>
    <a href={`?experience=e2&view=${space.view}&storage=${space.storage}`}>Return to My Space <span aria-hidden="true">↗</span></a>
  </nav>;
}
