import { useState } from "react";
import { readMySpaceReturn } from "./mySpaceReturn";
import "./mySpaceReturn.css";

export type MySpaceEntryDisplay = { href: string; returning: boolean; browserOnly: boolean };

/** Display only: App supplies bounded intent; the destination verifies storage. */
export function MySpaceEntry({ destination }: { destination: MySpaceEntryDisplay }) {
  return <nav className="today-my-space" aria-label="SK7 홈 전환">
    <span className="today-space-landmark" aria-hidden="true"><i /><i /><i /></span>
    <div className="section-header"><strong>내 공간 <span>· My Space</span></strong>
      <p>{destination.browserOnly ? "이 브라우저에 꾸며 둔 공간에서 잠시 쉬어가요." : "동반자와 함께 광장과 정원에서 잠시 쉬어가요."}</p>
    </div>
    <a href={destination.href}>{destination.returning ? "내 공간으로 돌아가기" : "내 공간으로 가기"} <span aria-hidden="true">→</span></a>
  </nav>;
}

/** The semantic shell keeps an escape path even at sign-in/read failure.
 * It imports no E2 runtime and never interprets a placement or auth state. */
export function MySpaceReturn() {
  const [space] = useState(() => readMySpaceReturn(window.location.search));
  if (!space) return null;
  return <nav className="my-space-return" aria-label="SK7 홈 전환">
    <div><strong>오늘의 기록</strong><span>내 공간에서 이어온 건강 작업 · {space.storage === "browser" ? "이 브라우저의 공간" : "계정 공간은 돌아갈 때 다시 확인"}</span></div>
    <a href={`?experience=e2&view=${space.view}&storage=${space.storage}`}>내 공간으로 돌아가기 <span aria-hidden="true">→</span></a>
  </nav>;
}
