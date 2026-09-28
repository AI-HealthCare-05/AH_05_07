import type { ScreenId } from "../ui/journey";

type LoopScreen = Extract<ScreenId, "S03" | "S04" | "S05" | "S06" | "S07">;

const steps: ReadonlyArray<{ screen: LoopScreen; label: string; optional?: boolean }> = [
  { screen: "S03", label: "행동 선택", optional: true },
  { screen: "S04", label: "혈압 기록" },
  { screen: "S05", label: "저장 확인" },
  { screen: "S06", label: "챌린지", optional: true },
  { screen: "S07", label: "오늘 확인" },
];

/** A presentation-only map. It does not gate navigation or combine the two fact types. */
export function DailyActionLoop({ current, guest = false }: { current: LoopScreen; guest?: boolean }) {
  return <div className="daily-action-loop" data-loop-kind={guest ? "guest" : "account"}>
    <p className="daily-action-loop-title">하루의 흐름</p>
    <ol>
      {steps.map(({ screen, label, optional }, index) => <li key={screen} aria-current={current === screen ? "step" : undefined}>
        <span className="daily-action-loop-index" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
        <span>{guest && screen === "S05" ? "반영 확인" : label}</span>
        {optional && <small>선택</small>}
      </li>)}
    </ol>
  </div>;
}
