import { useEffect, useRef, useState } from "react";
import { RecoveryPanel, type RecoveryContent } from "./RecoveryPanel";

export type AccountDeletionRecovery = "still-valid" | "ambiguous" | "failed" | null;

type AccountDeletionConfirmationProps = {
  pending: boolean;
  recovery: AccountDeletionRecovery;
  onCancel: () => void;
  onConfirm: () => void;
};

export function AccountDeletionConfirmation({ pending, recovery, onCancel, onConfirm }: AccountDeletionConfirmationProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [step, setStep] = useState<1 | 2>(1);

  useEffect(() => {
    const dialog = dialogRef.current;
    const trigger = document.activeElement;
    dialog?.showModal();
    return () => {
      dialog?.close();
      if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus();
    };
  }, []);

  const recoveryContent: RecoveryContent | null = recovery === "still-valid"
    ? {
        kind: "known-rejection",
        title: "계정이 아직 존재해요",
        known: "계정이 아직 유효한 것으로 확인됐어요.",
        next: "삭제를 원하면 최종 삭제를 다시 눌러 새 요청을 보내 주세요.",
      }
    : recovery === "ambiguous"
      ? {
          kind: "uncertain-delete",
          title: "삭제 요청 결과를 확인하지 못했어요.",
          known: "삭제 요청을 보냈고 같은 요청을 자동으로 반복하지 않았어요.",
          unknown: "계정 삭제 여부는 아직 확인되지 않았어요.",
          next: "연결을 확인한 뒤 최종 삭제를 눌러 명시적으로 다시 확인해 주세요.",
        }
      : recovery === "failed"
        ? {
            kind: "known-rejection",
            title: "계정을 삭제하지 못했어요",
            known: "서버가 이번 삭제 요청을 완료하지 못했다고 응답했어요.",
            next: "잠시 후 최종 삭제를 다시 눌러 주세요.",
          }
        : null;

  return (
    <dialog
      ref={dialogRef}
      className="delete-dialog account-delete-dialog surface"
      aria-labelledby="account-delete-title"
      aria-describedby="account-delete-description"
      onCancel={(event) => { event.preventDefault(); if (!pending) onCancel(); }}
    >
      <div className="screen-header">
        <p className="eyebrow">계정 영구 삭제 · {step}/2</p>
        <h2 id="account-delete-title">{step === 1 ? "무엇이 삭제되는지 확인" : "최종 삭제"}</h2>
        <p id="account-delete-description">{step === 1 ? "계정에 연결된 서버 데이터와 내 기기·브라우저에 남는 것을 먼저 구분해 주세요." : "계정을 영구 삭제할까요? 아래 버튼을 누르면 계정과 계정 소유 서버 데이터가 삭제되며 되돌릴 수 없어요."}</p>
      </div>
      {step === 1 ? (
        <>
          <div className="account-delete-scope">
            <section><p className="eyebrow">삭제됨</p><h3>계정에 연결된 항목</h3><ul><li>Supabase Auth 사용자 계정이 삭제됩니다.</li><li>계정 소유 혈압 관찰과 챌린지 기록</li><li>계정 My Space 꾸미기 상태</li></ul></section>
            <section><p className="eyebrow">자동 삭제되지 않음</p><h3>브라우저와 내 기기의 항목</h3><ul><li>화면 테마, 시작 화면, 동반자</li><li>browser-only My Space 배치</li><li>내려받은 JSON, 저장한 PDF, 인쇄물</li></ul></section>
          </div>
          <p className="account-delete-export-note">원하면 삭제 전에 설정에서 최근 30일 날짜 범위의 현재 접근 가능한 혈압 관찰 JSON 사본을 받을 수 있어요. 내려받기는 선택 사항이에요.</p>
          <div className="form-actions action-group">
            <button className="secondary" type="button" onClick={onCancel}>취소</button>
            <button type="button" aria-label="계속" onClick={() => setStep(2)}>계속 · 삭제 범위를 확인했어요</button>
          </div>
        </>
      ) : (
        <>
          <div className="account-delete-final-summary"><strong>계정 영구 삭제</strong><p>브라우저 개인화와 내 기기의 파일은 그대로 둘 수 있어요. 원하면 삭제 완료 뒤 별도로 브라우저 개인화를 초기화할 수 있어요.</p></div>
          {recoveryContent && <RecoveryPanel {...recoveryContent} tone="warning" role="status" focusOnMount />}
          <div className="form-actions action-group">
            <button className="secondary" type="button" onClick={() => setStep(1)} disabled={pending}>이전</button>
            <button className="text-button" type="button" onClick={onCancel} disabled={pending}>취소</button>
            <button className="danger" type="button" onClick={onConfirm} disabled={pending} aria-busy={pending}>
              {pending ? "삭제 처리 중" : "최종 삭제"}
            </button>
          </div>
        </>
      )}
    </dialog>
  );
}
