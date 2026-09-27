import { useState } from "react";
import { readMySpaceReturn } from "./mySpaceReturn";
import "./mySpaceReturn.css";

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
