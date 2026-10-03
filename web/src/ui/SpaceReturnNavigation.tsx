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
  const returning = destination.returning;

  return <nav
    className="today-my-space"
    aria-label="SK7 홈 전환"
    data-my-space-intent={returning ? "return" : "enter"}
    data-my-space-view={destination.view}
    data-my-space-storage={destination.storage}
    data-living-city-invitation={returning ? "return" : "enter"}
  >
    <span className="today-space-portal" aria-hidden="true">
      <span className="today-space-portal-sky" />
      <span className="today-space-portal-gate"><i /><i /></span>
      <span className="today-space-portal-path" />
      <span className="today-space-portal-garden"><i /><i /><i /></span>
      <span className="today-space-portal-companion"><i /><i /></span>
    </span>

    <div className="today-space-copy">
      <p className="today-space-kicker">{returning ? "Today 도착" : "Living City"}</p>

      <div className="section-header">
        <strong>{returning
          ? <>오늘의 기록 <span>· Today</span></>
          : <>내 공간 <span>· Living City</span></>}</strong>
        <p>{returning
          ? "Living City에서 오늘의 기록으로 돌아왔어요."
          : "잠깐 걷고, 쉬고, 내 취향을 더하는 곳."}</p>
      </div>

      {returning
        ? <ol className="today-return-route" aria-label="Living City에서 오늘의 기록까지">
          <li data-return-stop="space">Living City</li>
          <li className="today-return-route-arrow" aria-hidden="true">→</li>
          <li data-return-stop="today">오늘의 기록</li>
        </ol>
        : <ul className="today-space-capabilities" aria-label="내 공간에서 할 수 있는 일">
          <li data-space-capability="plaza">광장 걷기</li>
          <li data-space-capability="garden">정원 쉼터</li>
          <li data-space-capability="decorate">내 공간 꾸미기</li>
        </ul>}

      <div className="today-space-context" id={contextId} aria-label="이동할 내 공간">
        <span>{mySpaceStorageLabel[destination.storage]}</span>
        <span>{mySpaceViewLabel[destination.view]}</span>
      </div>

      <a className="today-space-entry-action" href={destination.href} aria-describedby={contextId}>
        <span>{returning ? "내 공간으로 돌아가기" : "내 공간으로 가기"}</span>
        <span className="today-space-entry-arrow" aria-hidden="true">→</span>
      </a>
    </div>
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
