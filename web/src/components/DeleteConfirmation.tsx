import { useEffect, useRef } from "react";
import { RecoveryPanel, type RecoveryContent } from "./RecoveryPanel";

type DeleteConfirmationProps = {
  title: string;
  pending: boolean;
  recovery?: RecoveryContent;
  onCancel: () => void;
  onConfirm: () => void;
  onRecover?: () => void;
  onOpenRecords?: () => void;
};

export function DeleteConfirmation({ title, pending, recovery, onCancel, onConfirm, onRecover, onOpenRecords }: DeleteConfirmationProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    const trigger = document.activeElement;
    dialog?.showModal();
    return () => {
      dialog?.close();
      if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus();
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="delete-dialog surface"
      aria-labelledby="delete-title"
      aria-describedby="delete-description"
      onCancel={(event) => { event.preventDefault(); if (!pending) onCancel(); }}
    >
      <div className="screen-header">
        <h2 id="delete-title">{title}</h2>
        <p id="delete-description">삭제한 기록은 되돌릴 수 없어요. 날짜와 기록 종류를 확인해 주세요.</p>
      </div>
      {recovery ? <RecoveryPanel {...recovery} role="alert" focusOnMount actions={<>
        <button type="button" onClick={onRecover}>다시 불러오기</button>
        <button className="secondary" type="button" onClick={onOpenRecords}>기록에서 확인하기</button>
      </>} /> : <div className="form-actions action-group">
        <button className="secondary" type="button" onClick={onCancel} disabled={pending} autoFocus>취소</button>
        <button className="danger" type="button" onClick={onConfirm} disabled={pending}>{pending ? "삭제 중" : "삭제"}</button>
      </div>}
    </dialog>
  );
}
