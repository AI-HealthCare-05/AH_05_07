export const MODEL_V2_RESULT_STATE_CONTRACT_VERSION = "model-v2-result-state-v1";

export const modelV2ResultStates = [
  "not_ready",
  "input_invalid",
  "temporarily_unavailable",
  "result_available_not_user_visible",
] as const;

export type ModelV2ResultState = (typeof modelV2ResultStates)[number];

export type ModelV2ResultView = Readonly<{
  state: ModelV2ResultState;
  status: string;
  heading: string;
  body: string;
  disclaimer: string;
}>;

export const MODEL_V2_DEFAULT_RESULT_STATE: ModelV2ResultState = "not_ready";

const COMMON_DISCLAIMER = "이 신호는 진단·치료·예방 판단을 제공하지 않습니다.";

const RESULT_VIEWS: Readonly<Record<ModelV2ResultState, ModelV2ResultView>> = {
  not_ready: {
    state: "not_ready",
    status: "아직 준비 중이에요",
    heading: "검증된 모델이 준비되기 전에는 결과를 표시하지 않습니다.",
    body: "현재는 점수, 확률, 등급을 표시하지 않습니다.",
    disclaimer: COMMON_DISCLAIMER,
  },
  input_invalid: {
    state: "input_invalid",
    status: "입력을 확인해 주세요",
    heading: "이 입력으로는 신호를 준비할 수 없습니다.",
    body: "입력 내용을 다시 확인해 주세요. 입력값 자체는 이 화면에 표시하지 않습니다.",
    disclaimer: COMMON_DISCLAIMER,
  },
  temporarily_unavailable: {
    state: "temporarily_unavailable",
    status: "잠시 사용할 수 없어요",
    heading: "지금은 신호 결과를 준비할 수 없습니다.",
    body: "잠시 후 다시 확인해 주세요. 기술 정보는 이 화면에 표시하지 않습니다.",
    disclaimer: COMMON_DISCLAIMER,
  },
  result_available_not_user_visible: {
    state: "result_available_not_user_visible",
    status: "결과 표시 검토 중",
    heading: "기술적으로 결과가 준비되어도 아직 화면에는 표시하지 않습니다.",
    body: "점수와 등급의 사용자 표시 기준이 승인되기 전까지 결과 값은 보여주지 않습니다.",
    disclaimer: COMMON_DISCLAIMER,
  },
};

export function getModelV2ResultView(state: ModelV2ResultState): ModelV2ResultView {
  return RESULT_VIEWS[state];
}

export function resolveModelV2ResultState(
  requestedState: string | null,
  allowSyntheticOverride: boolean,
): ModelV2ResultState {
  if (!allowSyntheticOverride || !requestedState) return MODEL_V2_DEFAULT_RESULT_STATE;
  return modelV2ResultStates.includes(requestedState as ModelV2ResultState)
    ? requestedState as ModelV2ResultState
    : MODEL_V2_DEFAULT_RESULT_STATE;
}
