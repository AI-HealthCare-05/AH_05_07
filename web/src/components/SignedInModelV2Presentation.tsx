import type { ModelV2Continuation } from "./modelV2Continuation";
import type { ModelV2ExecutionGuard } from "./modelV2ExecutionGuard";
import type { ModelV2ResultState, ModelV2ResultView } from "../ui/modelV2SyntheticResultState";
import { journeyCopy } from "../ui/journey";
import { ModelV2InputFlow } from "./ModelV2InputFlow";
import { Scene } from "./SceneShell";

type Props =
  | Readonly<{
    mode: "synthetic";
    state: ModelV2ResultState;
    view: ModelV2ResultView;
  }>
  | Readonly<{
    mode: "account";
    sessionGeneration: number;
    guard: ModelV2ExecutionGuard;
    continuation: ModelV2Continuation;
    bloodPressureStatus: string;
    bloodPressureSupport: string;
    challengeStatus: string;
    challengeSupport: string;
    onContinue: () => void;
    onReturnToToday: () => void;
  }>;

/** Display-only S11 boundary. App owns session authority and continuation. */
export function SignedInModelV2Presentation(props: Props) {
  if (props.mode === "synthetic") {
    return <Scene id="S11" {...journeyCopy.S11} tone="secondary" className="signal-scene">
      <div className="signal-orbit" aria-hidden="true"><span /><span /><i /></div>
      <div className="signal-card" data-model-v2-synthetic-result data-model-v2-result-state={props.state} role="status" aria-live="polite">
        <span className="status-pill">{props.view.status}</span>
        <h2>{props.view.heading}</h2>
        <p>{props.view.body}</p>
      </div>
      <p className="signal-disclaimer">{props.view.disclaimer}</p>
    </Scene>;
  }

  const needsCurrentReadConfirmation = props.continuation.key === "confirm-today";
  return <ModelV2InputFlow
    key={props.sessionGeneration}
    guard={props.guard}
    bloodPressureStatus={needsCurrentReadConfirmation ? "오늘 혈압 상태 · 최신 여부 미확인" : props.bloodPressureStatus}
    bloodPressureSupport={needsCurrentReadConfirmation ? "오늘 화면에서 최신 기록을 확인해요." : props.bloodPressureSupport}
    continuation={props.continuation}
    challengeStatus={needsCurrentReadConfirmation ? "오늘 챌린지 상태 · 최신 여부 미확인" : props.challengeStatus}
    challengeSupport={needsCurrentReadConfirmation ? "오늘 화면에서 최신 챌린지 상태를 확인해요." : props.challengeSupport}
    onContinue={props.onContinue}
    onReturnToToday={props.onReturnToToday}
  />;
}
