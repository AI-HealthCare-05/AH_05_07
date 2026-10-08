import { journeyCopy } from "../ui/journey";
import { DailyActionLoop } from "./DailyActionLoop";
import { Scene, SceneCompanion } from "./SceneShell";

type SavedFactKind = "blood-pressure" | "challenge-checkin";

type SignedInSavedPresentationProps = {
  journey: boolean;
  savedFactKind: SavedFactKind;
  savedBloodPressureIsToday: boolean;
  firstBloodPressureWindow: boolean;
  onPrimary: () => void;
  onSecondary: () => void;
  onReturnHome: () => void;
};

export function SignedInSavedPresentation({
  journey, savedFactKind, savedBloodPressureIsToday, firstBloodPressureWindow,
  onPrimary, onSecondary, onReturnHome,
}: SignedInSavedPresentationProps) {
  return (
    <Scene id="S05" {...journeyCopy.S05} tone="subtle" className={journey ? "saved-scene journey-candidate journey-saved" : "saved-scene"}>
      {journey && <DailyActionLoop current="S05" firstSession={firstBloodPressureWindow && savedFactKind === "blood-pressure"} />}
      <div className="save-ripple" aria-hidden="true">{journey ? <><div className="save-ripple-landscape"><i /><i /></div><SceneCompanion /></> : <><SceneCompanion /><i /><i /></>}<span>✓</span></div>
      {journey && <section className="save-next-step section-header" aria-labelledby="save-next-step-title">
        <p className="eyebrow">다음 확인</p>
        <h2 id="save-next-step-title">{savedFactKind === "challenge-checkin"
          ? "오늘의 기록에서 방금 저장한 챌린지 상태를 확인해요"
          : savedBloodPressureIsToday
            ? "오늘의 기록에서 방금 저장한 혈압을 확인해요"
            : "최근 기록에서 방금 저장한 혈압을 확인해요"}</h2>
        <p>{savedFactKind === "challenge-checkin"
          ? "챌린지 상태는 혈압 기록과 별도로 남아요."
          : savedBloodPressureIsToday
            ? "오늘 기록 상세에서 바로 확인할 수 있어요."
            : "기록 찾아보기에서 날짜·시간대별로 확인할 수 있어요."}</p>
      </section>}
      <div className="split-actions action-group journey-continuation-actions journey-continuation-actions--saved">
        <button type="button" onClick={onPrimary}>{savedFactKind === "blood-pressure" && !savedBloodPressureIsToday ? "기록 찾아보기" : savedBloodPressureIsToday && journey ? "방금 기록한 혈압 확인" : "오늘의 기록 보기"}</button>
        <button className="secondary" type="button" onClick={onSecondary}>{savedFactKind === "challenge-checkin" ? "챌린지 상태 보기" : "계속 기록하기"}</button>
      </div>
      {journey && savedBloodPressureIsToday && <button className="text-button journey-saved-home" type="button" onClick={onReturnHome}>오늘의 기록 보기</button>}
    </Scene>
  );
}
