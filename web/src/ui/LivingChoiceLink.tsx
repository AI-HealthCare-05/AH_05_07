import { livingChoice, livingChoiceLabel, livingChoiceQuery } from "./livingChoice";
import { readMySpaceReturn } from "./mySpaceReturn";
import "./livingChoice.css";

/** App supplies only its current action id, after its existing read/write guards. */
export function LivingChoiceLink({ actionId, search }: { actionId: unknown; search: string }) {
  const choice = livingChoice(actionId);
  if (!choice) return null;
  const storage = readMySpaceReturn(search)?.storage ?? "browser";
  return <aside className="living-choice-link" aria-label="Living City에 가져갈 선택">
    <p><strong>{livingChoiceLabel[choice]}</strong> · 내가 고른 생활 행동</p>
    <a href={`?experience=e2&view=3d&storage=${storage}${livingChoiceQuery(choice)}`}>이 선택을 내 공간에 가져가기 <span aria-hidden="true">↗</span></a>
    <small>이번 방문의 광장에 작은 문양으로 놓여요.</small>
  </aside>;
}
