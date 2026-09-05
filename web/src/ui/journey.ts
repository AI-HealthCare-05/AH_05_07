export const signedInScreenIds = [
  "S02",
  "S03",
  "S04",
  "S05",
  "S06",
  "S07",
  "S08",
  "S09",
  "S10",
  "S11",
  "S12",
  "S13",
  "S14",
] as const;

export const allScreenIds = ["S01", ...signedInScreenIds] as const;

export type ScreenId = (typeof signedInScreenIds)[number];
export type JourneyScreenId = (typeof allScreenIds)[number];

export const primaryNavigation: ReadonlyArray<{ screen: ScreenId; label: string; shortLabel: string }> = [
  { screen: "S02", label: "오늘의 기록", shortLabel: "오늘" },
  { screen: "S08", label: "기록 찾아보기", shortLabel: "기록" },
  { screen: "S10", label: "7일 돌아보기", shortLabel: "7일" },
  { screen: "S11", label: "입력 기반 위험군 선별 신호", shortLabel: "신호" },
  { screen: "S14", label: "설정과 도움말", shortLabel: "설정" },
];

export function parseScreen(value: string | null): ScreenId {
  return signedInScreenIds.includes(value as ScreenId) ? value as ScreenId : "S02";
}

export const journeyCopy = {
  S01: {
    eyebrow: "상균7데이즈",
    title: "오늘의 기록을 차분히 시작해요",
    body: "이메일 링크로 내 기록을 이어볼 수 있어요.",
  },
  S02: {
    eyebrow: "오늘",
    title: "오늘의 기록",
    body: "혈압 관찰과 오늘 선택한 행동을 따로 기록하고, 최근 7일의 사실을 살펴볼 수 있어요.",
  },
  S03: {
    eyebrow: "7일 챌린지",
    title: "7일 동안 이어갈 행동을 골라주세요",
    body: "참여 상태를 처음 기록하기 전까지만 행동을 바꿀 수 있어요.",
  },
  S04: {
    eyebrow: "혈압 관찰",
    title: "혈압 기록",
    body: "측정한 값을 날짜와 시간대에 맞춰 남겨 주세요. 측정 전 안내는 아래에서 확인할 수 있어요.",
  },
  S05: {
    eyebrow: "저장됨",
    title: "기록을 저장했어요",
    body: "저장한 내용을 오늘의 기록에서 확인할 수 있어요.",
  },
  S06: {
    eyebrow: "오늘의 상태",
    title: "선택한 행동은 그대로 이어집니다",
    body: "참여 상태를 이미 기록해 행동을 바꿀 수 없어요. 혈압 측정 기록은 별도로 남겨 주세요.",
  },
  S07: { eyebrow: "오늘 상세", title: "오늘의 기록" },
  S08: { eyebrow: "기록", title: "기록 찾아보기" },
  S09: { eyebrow: "선택한 기록", title: "기록 상세" },
  S10: {
    eyebrow: "7일 기록",
    title: "선택한 7일을 돌아봐요",
    body: "혈압 관찰과 챌린지 참여를 각각 살펴보세요. 이전 방식으로 남긴 기록도 따로 표시해요.",
  },
  S11: { eyebrow: "준비 상태", title: "입력 기반 위험군 선별 신호" },
  S12: {
    eyebrow: "아직 기록 없음",
    title: "아직 기록이 없어도 괜찮아요",
    body: "혈압 관찰과 7일 챌린지는 각각 시작할 수 있어요.",
  },
  S13: {
    eyebrow: "불러오기 실패",
    title: "기록을 불러오지 못했어요",
    body: "아직 기록이 없다는 뜻은 아니에요. 연결을 확인한 뒤 다시 시도해 주세요.",
  },
  S14: { eyebrow: "설정", title: "설정과 도움말" },
} as const;
