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
  { screen: "S11", label: "AI 분석", shortLabel: "AI" },
  { screen: "S08", label: "기록 찾아보기", shortLabel: "기록" },
  { screen: "S10", label: "7일 돌아보기", shortLabel: "7일" },
  { screen: "S14", label: "설정", shortLabel: "설정" },
];

export function primaryNavigationScreen(screen: ScreenId): ScreenId {
  if (screen === "S08" || screen === "S09") return "S08";
  if (screen === "S10") return "S10";
  if (screen === "S11" || screen === "S14") return screen;
  return "S02";
}

export function parseScreen(value: string | null): ScreenId {
  return signedInScreenIds.includes(value as ScreenId) ? value as ScreenId : "S02";
}

export const journeyCopy = {
  S01: {
    eyebrow: "상균7데이즈",
    title: "측정한 혈압을 기록하고 최근 7일을 확인해요",
    body: "같은 브라우저에서는 로그인 상태가 유지되면 다시 로그인하지 않고 기록을 이어갈 수 있어요.",
  },
  S02: {
    eyebrow: "오늘",
    title: "오늘의 기록",
  },
  S03: {
    eyebrow: "선택 기능 · 7일 챌린지",
    title: "원하면 이어갈 행동을 골라요",
    body: "선택 기능이며, 첫 상태 저장 후에는 행동을 바꿀 수 없어요.",
  },
  S04: {
    eyebrow: "혈압 관찰",
    title: "혈압 기록",
    body: "날짜·시간대를 확인하고 측정값을 입력해요.",
  },
  S05: {
    eyebrow: "저장됨",
    title: "기록을 저장했어요",
  },
  S06: {
    eyebrow: "오늘의 상태",
    title: "선택한 행동은 그대로 이어집니다",
  },
  S07: { eyebrow: "오늘 상세", title: "오늘의 기록" },
  S08: { eyebrow: "기록", title: "기록 찾아보기" },
  S09: { eyebrow: "선택한 기록", title: "기록 상세" },
  S10: {
    eyebrow: "7일 기록",
    title: "최근 7일 기록",
  },
  S11: { eyebrow: "입력 기반 위험군 선별 신호", title: "이번 이용에만 생활정보를 살펴봐요" },
  S12: {
    eyebrow: "아직 기록 없음",
    title: "측정한 혈압부터 기록해요",
    body: "혈압부터 시작하고, 챌린지는 선택할 수 있어요.",
  },
  S13: {
    eyebrow: "불러오기 실패",
    title: "기록을 불러오지 못했어요",
    body: "아직 기록이 없다는 뜻은 아니에요. 연결을 확인한 뒤 다시 시도해 주세요.",
  },
  S14: { eyebrow: "설정", title: "설정" },
} as const;
