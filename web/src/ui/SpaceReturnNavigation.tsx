import { useState } from "react";
import {
  mySpaceContextLabel,
  mySpaceStorageLabel,
  mySpaceViewLabel,
  readMySpaceReturn,
  type MySpaceReturn as MySpaceReturnContext,
} from "./mySpaceReturn";
import "./mySpaceReturn.css";

export type MySpaceEntryDisplay = MySpaceReturnContext & {
  href: string;
  returning: boolean;
};

/** Display only: App supplies bounded intent; the destination verifies storage. */
export function MySpaceEntry({ destination }: { destination: MySpaceEntryDisplay }) {
  const contextId = "today-my-space-context";
  return <nav
    className="today-my-space"
    aria-label="SK7 홈 전환"
    data-my-space-intent={destination.returning ? "return" : "enter"}
    data-my-space-view={destination.view}
    data-my-space-storage={destination.storage}
  >
    <span className="today-space-landmark" aria-hidden="true"><i /><i /><i /></span>
    <div className="section-header">
      <strong>내 공간 <span>· My Space</span></strong>
      <p>{destination.returning
        ? "방금 머물던 내 공간으로 이어서 돌아가요."
        : "동반자와 광장·정원에서 잠시 쉬어가요."}</p>
    </div>
    <div className="today-space-context" id={contextId} aria-label="이동할 내 공간">
      <span>{mySpaceStorageLabel[destination.storage]}</span>
      <span>{mySpaceViewLabel[destination.view]}</span>
    </div>
    <a href={destination.href} aria-describedby={contextId}>
      {destination.returning ? "내 공간으로 돌아가기" : "내 공간으로 가기"} <span aria-hidden="true">→</span>
    </a>
  </nav>;
}

/** The semantic shell keeps an escape path even at sign-in/read failure.
 * It imports no E2 runtime and never interprets a placement or auth state. */
export function MySpaceReturn() {
  const [space] = useState(() => readMySpaceReturn(window.location.search));
  if (!space) return null;

  const contextId = "my-space-return-context";
  return <nav
    className="my-space-return"
    aria-label="SK7 홈 전환"
    data-my-space-intent="return"
    data-my-space-view={space.view}
    data-my-space-storage={space.storage}
  >
    <div>
      <strong>오늘의 기록 · Today</strong>
      <span>내 공간에서 이어온 건강 기록 작업</span>
      <span id={contextId} className="my-space-return-context">
        {mySpaceContextLabel(space)}로 돌아갈 수 있어요.
      </span>
    </div>
    <a
      href={`?experience=e2&view=${space.view}&storage=${space.storage}`}
      aria-describedby={contextId}
    >
      내 공간으로 돌아가기 <span aria-hidden="true">→</span>
    </a>
  </nav>;
}
