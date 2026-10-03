export const DATA_SCOPE_LABELS = {
  account: "계정",
  browser: "이 브라우저",
  visit: "이번 방문",
  deviceFile: "내 기기 파일",
} as const;

export type DataScope = keyof typeof DATA_SCOPE_LABELS;

/** Presentation vocabulary only. Owns no storage or lifecycle behavior. */
export function dataScopeLabel(scope: DataScope): string {
  return DATA_SCOPE_LABELS[scope];
}
