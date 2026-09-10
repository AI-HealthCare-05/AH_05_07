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
  { screen: "S11", label: "생활정보 기반 고혈압 선별 참고", shortLabel: "분석" },
  { screen: "S14", label: "설정과 도움말", shortLabel: "설정" },
];

export function primaryNavigationScreen(screen: ScreenId): ScreenId {
  if (screen === "S08" || screen === "S09") return "S08";
  if (screen === "S10") return "S10";
  if (screen === "S11") return "S11";
  if (screen === "S14") return "S14";
  return "S02";
}

export function parseScreen(value: string | null): ScreenId {
  return signedInScreenIds.includes(value as ScreenId) ? value as ScreenId : "S02";
}

export const journeyCopy = {
  S01: {
    eyebrow: "상균7데이즈",
    title: "오늘 기록을 시작해요",
    body: "이메일 링크로 내 기록을 이어볼 수 있어요.",
  },
  S02: {
    eyebrow: "오늘",
    title: "오늘의 기록",
    body: "혈압과 챌린지 기록을 남기고, 최근 7일을 확인해요.",
  },
  S03: {
    eyebrow: "7일 챌린지",
    title: "이어갈 행동을 골라주세요",
    body: "첫 체크인 전까지만 바꿀 수 있어요.",
  },
  S04: {
    eyebrow: "혈압 관찰",
    title: "혈압 기록",
    body: "측정한 값을 날짜와 시간대에 맞춰 남겨 주세요.",
  },
  S05: {
    eyebrow: "저장됨",
    title: "기록을 저장했어요",
    body: "저장한 내용을 오늘의 기록에서 확인할 수 있어요.",
  },
  S06: {
    eyebrow: "오늘의 상태",
    title: "선택한 행동은 그대로 이어집니다",
    body: "선택한 행동과 오늘 상태를 확인해요.",
  },
  S07: { eyebrow: "오늘 상세", title: "오늘의 기록" },
  S08: { eyebrow: "기록", title: "기록 찾아보기" },
  S09: { eyebrow: "선택한 기록", title: "기록 상세" },
  S10: {
    eyebrow: "7일 기록",
    title: "최근 7일 기록",
    body: "오늘을 기준으로 기록을 확인해요. 챌린지 진행과는 별도입니다.",
  },
  S11: { eyebrow: "생활정보 분석", title: "생활정보 기반 고혈압 선별 참고" },
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
