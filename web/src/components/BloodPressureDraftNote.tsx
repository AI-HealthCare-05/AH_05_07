import "./blood-pressure-draft.css";

type Props = {
  restored: boolean;
  observedOn: string;
  today: string;
};

export function BloodPressureDraftNote({ restored, observedOn, today }: Props) {
  if (!restored && (!observedOn || observedOn === today)) return null;
  return (
    <div className="bp-draft-note">
      {restored && <p role="status">작성 중인 기록을 이어서 보여드리고 있어요.</p>}
      {observedOn && observedOn !== today && <p id="bp-draft-date-help">입력 날짜는 {observedOn}예요. 오늘({today})과 다른 날짜이니 저장 전에 확인해 주세요.</p>}
    </div>
  );
}
