import { useState } from "react";
import { readStartingHomePreference, writeStartingHomePreference } from "./startingHomePreference";

export function StartingHomeControl({ headingLevel = 2 }: { headingLevel?: 2 | 3 } = {}) {
  const [preference, setPreference] = useState(readStartingHomePreference);
  const [saveFailed, setSaveFailed] = useState(false);
  const Heading = headingLevel === 3 ? "h3" : "h2";
  return <section className="journey-settings-section journey-settings-display starting-home-control">
    <div className="section-header">
      <Heading>시작 화면</Heading>
      <p id="starting-home-help">이 브라우저에만 저장돼요. 건강 기록·분석에는 영향이 없으며 언제든 바꿀 수 있어요. 다음에 기본 주소로 들어올 때 로그인 상태라면 적용돼요.</p>
    </div>
    <fieldset className="theme-preset-control" aria-describedby="starting-home-help">
      <legend>로그인 후 시작 화면</legend>
      {([
        ["classic-today", "Classic Today", "오늘의 기록부터 시작"],
        ["my-space", "My Space", "내 공간에서 시작"],
      ] as const).map(([value, label, description]) => <label key={value}>
        <input type="radio" name="sk7-starting-home" value={value} checked={preference === value}
          onChange={() => {
            const stored = writeStartingHomePreference(value);
            setPreference(stored);
            setSaveFailed(stored !== value);
          }} />
        <span><strong>{label}</strong><small>{description}</small></span>
      </label>)}
    </fieldset>
    {saveFailed && <p role="status">시작 화면 선택을 저장하지 못했어요. 브라우저 저장 설정을 확인한 뒤 다시 시도해 주세요.</p>}
  </section>;
}
