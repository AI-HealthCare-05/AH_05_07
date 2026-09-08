import { useEffect, useRef, useState } from "react";

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

  const recoveryMessage = recovery === "still-valid"
    ? "계정이 아직 유효한 것으로 확인됐어요. 삭제를 다시 요청하려면 최종 삭제를 눌러 주세요."
    : recovery === "ambiguous"
      ? "삭제 요청 결과를 확인하지 못했어요. 삭제 여부를 단정하지 않았습니다. 연결을 확인한 뒤 명시적으로 다시 시도해 주세요."
      : recovery === "failed"
        ? "계정을 삭제하지 못했어요. 잠시 후 명시적으로 다시 시도해 주세요."
        : null;

  return (
    <dialog
      ref={dialogRef}
      className="delete-dialog account-delete-dialog"
      aria-labelledby="account-delete-title"
      aria-describedby="account-delete-description"
      onCancel={(event) => { event.preventDefault(); if (!pending) onCancel(); }}
    >
      <h2 id="account-delete-title">{step === 1 ? "계정을 삭제할까요?" : "계정을 영구 삭제할까요?"}</h2>
      {step === 1 ? (
        <>
          <p id="account-delete-description">이 작업은 되돌릴 수 없어요.</p>
          <ul>
            <li>계정이 삭제됩니다.</li>
            <li>저장된 혈압 관찰과 챌린지 제품 기록이 삭제됩니다.</li>
            <li>이미 다운로드한 JSON 파일은 기기에 남으므로 직접 삭제해야 합니다.</li>
          </ul>
          <div className="form-actions">
            <button className="secondary" type="button" onClick={onCancel}>취소</button>
            <button type="button" onClick={() => setStep(2)}>계속</button>
          </div>
        </>
      ) : (
        <>
          <p id="account-delete-description">계정과 저장된 제품 기록을 영구 삭제합니다. 삭제 후 되돌릴 수 없습니다.</p>
          {recoveryMessage && <p className="notice notice-warning" role="status">{recoveryMessage}</p>}
          <div className="form-actions">
            <button className="secondary" type="button" onClick={onCancel} disabled={pending}>취소</button>
            <button className="danger" type="button" onClick={onConfirm} disabled={pending} aria-busy={pending}>
              {pending ? "삭제 처리 중" : "최종 삭제"}
            </button>
          </div>
        </>
      )}
    </dialog>
  );
}
