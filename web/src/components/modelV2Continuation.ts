// S11 presentation only: loaded record facts choose the next screen.
// Unconfirmed records cannot choose a write destination.
export type ModelV2ContinuationState =
  | { freshness: "retained_or_unconfirmed" }
  | {
    freshness: "confirmed";
    bloodPressure: "exists" | "missing";
    challenge: "none" | "ended" | "active_pending" | "active_recorded";
  };

export type ModelV2Continuation = {
  key: "confirm-today" | "record-blood-pressure" | "record-challenge" | "review-today";
  destination: "S02" | "S04" | "S07";
  title: string;
  support: string;
  actionLabel: string;
};

export function resolveModelV2Continuation(state: ModelV2ContinuationState): ModelV2Continuation {
  switch (state.freshness) {
    case "retained_or_unconfirmed":
      return {
        key: "confirm-today",
        destination: "S02",
        title: "오늘 기록 상태를 먼저 확인해요",
        support: "현재 기록의 최신 여부를 아직 확인하지 못했어요. 오늘 화면에서 먼저 확인해 주세요.",
        actionLabel: "오늘 화면에서 확인하기",
      };
    case "confirmed":
      if (state.bloodPressure === "missing") return {
        key: "record-blood-pressure",
        destination: "S04",
        title: "오늘 혈압 기록을 이어가요",
        support: "오늘 혈압 기록이 아직 없어요. 측정한 값이 있다면 바로 남길 수 있어요.",
        actionLabel: "혈압 기록 남기기",
      };
      switch (state.challenge) {
        case "active_pending":
          return {
            key: "record-challenge",
            destination: "S07",
            title: "오늘 챌린지 상태를 이어서 남겨요",
            support: "오늘 혈압 기록은 있어요. 진행 중인 챌린지의 오늘 상태를 ‘기록함’ 또는 ‘건너뜀’으로 남길 수 있어요.",
            actionLabel: "오늘 상태 확인·기록하기",
          };
        case "none":
        case "ended":
        case "active_recorded":
          return {
            key: "review-today",
            destination: "S07",
            title: "오늘 기록을 확인해요",
            support: "오늘 남긴 혈압 기록과 챌린지 상태를 각각 확인할 수 있어요. 챌린지는 원할 때만 이용해요.",
            actionLabel: "오늘 기록 확인하기",
          };
      }
  }
}
