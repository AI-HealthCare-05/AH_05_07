import type { MySpaceEntryDisplay } from "../ui/SpaceReturnNavigation";
import { MySpaceEntry } from "../ui/SpaceReturnNavigation";
import { journeyCopy, type ScreenId } from "../ui/journey";
import { DailyActionLoop } from "./DailyActionLoop";
import { RecoveryPanel } from "./RecoveryPanel";
import { Scene } from "./SceneShell";

type SignedInStateScreen = "S12" | "S13";

type SignedInStatePresentationProps = {
  screen: SignedInStateScreen;
  journey: boolean;
  isPriorDashboard: boolean;
  evidenceMode: boolean;
  startOn: string;
  endOn: string;
  mySpaceEntry?: MySpaceEntryDisplay;
  dateLabel: (value: string) => string;
  onNavigate: (screen: ScreenId) => void;
  onSelectCurrentWindow: () => void;
  onRefresh: () => void;
};

export function SignedInStatePresentation({
  screen,
  journey,
  isPriorDashboard,
  evidenceMode,
  startOn,
  endOn,
  mySpaceEntry,
  dateLabel,
  onNavigate,
  onSelectCurrentWindow,
  onRefresh,
}: SignedInStatePresentationProps) {
  if (screen === "S13") {
    const recovery = <RecoveryPanel
      kind="initial-load"
      title="기록 상태를 아직 확인하지 못했어요"
      known="기록 불러오기가 완료되지 않았어요. 아직 기록이 없다는 뜻은 아니에요."
      unknown="기록이 있는지와 현재 최신 상태는 확인되지 않았어요. 기존 기록이 변경됐다는 뜻도 아니에요."
      next="연결을 확인한 뒤 기록을 다시 불러와 주세요."
      tone="critical"
      role="alert"
      className={journey ? "journey-load-error-card" : "state-message"}
      actions={<button type="button" onClick={onRefresh}>다시 불러오기</button>}
    />;
    if (journey) return (
      <Scene id="S13" eyebrow="불러오기 오류" title="기록을 불러오지 못했어요" tone="critical" className="journey-load-error surface">
        {recovery}
      </Scene>
    );
    return <Scene id="S13" eyebrow={journeyCopy.S13.eyebrow} title={journeyCopy.S13.title} tone="critical" className="state-scene surface">
      <div className="mist-shape" aria-hidden="true" />
      {recovery}
    </Scene>;
  }

  if (journey) return (
    <Scene
      id="S12"
      eyebrow={isPriorDashboard ? "이전 7일 · 읽기 전용" : "현재 7일 · 오늘 포함"}
      title={isPriorDashboard ? "이 기간에는 기록이 없어요." : "측정한 혈압부터 기록해요"}
      body={isPriorDashboard ? "이전 구간에는 기록이 없으며, 새 기록은 현재 7일에서 시작할 수 있어요." : undefined}
      tone="subtle"
      className="journey-empty surface"
    >
      <p className="journey-empty-period" aria-label="조회 기간"><time dateTime={startOn}>{dateLabel(startOn)}</time> ~ <time dateTime={endOn}>{dateLabel(endOn)}</time></p>
      {isPriorDashboard ? (
        <div className="journey-empty-return">
          <button type="button" onClick={onSelectCurrentWindow} disabled={evidenceMode}>현재 7일 보기</button>
        </div>
      ) : (
        <>
          <DailyActionLoop current="S12" firstSession />
          <div className="journey-empty-actions action-group">
            <section className="journey-empty-action journey-empty-action--primary">
              <div><p className="eyebrow">첫 실제 행동</p><h2>혈압 한 건 기록하기</h2></div>
              <p>저장이 확인되면 방금 남긴 기록을 바로 확인할 수 있어요.</p>
              <button type="button" onClick={() => onNavigate("S04")}>혈압 기록하기</button>
            </section>
            <section className="journey-empty-action journey-empty-action--secondary">
              <div><p className="eyebrow">선택</p><h2>7일 챌린지</h2></div>
              <p id="empty-challenge-help">참여는 선택이에요. 한 행동을 오늘부터 7일간 기록하며, 혈압 기록은 참여하지 않아도 그대로 사용할 수 있어요.</p>
              <button className="secondary" type="button" aria-describedby="empty-challenge-help" onClick={() => onNavigate("S03")}>7일 챌린지 시작하기</button>
            </section>
          </div>
          <aside className="journey-empty-signal" aria-labelledby="empty-signal-title">
            <div><p className="eyebrow">선택 도구 · 저장 안 함</p><h2 id="empty-signal-title">생활정보를 먼저 정리할 수도 있어요</h2><p id="empty-signal-help">활동·수면·생활습관을 이번 이용에만 정리해요.</p></div>
            <button className="text-button" type="button" aria-describedby="empty-signal-help" onClick={() => onNavigate("S11")}>생활정보 정리하기</button>
          </aside>
        </>
      )}
      {mySpaceEntry && <MySpaceEntry destination={mySpaceEntry} />}
      <div className="empty-garden" aria-hidden="true"><i /><i /><i /></div>
    </Scene>
  );

  return <Scene id="S12" {...journeyCopy.S12} tone="subtle" className="state-scene surface">
    <div className="empty-garden" aria-hidden="true"><i /><i /><i /></div>
    <div className="split-actions action-group">
      <button type="button" onClick={() => onNavigate("S04")}>혈압 기록하기</button>
      <button className="secondary" type="button" onClick={() => onNavigate("S03")}>7일 챌린지 시작하기</button>
    </div>
    {mySpaceEntry && <MySpaceEntry destination={mySpaceEntry} />}
  </Scene>;
}
