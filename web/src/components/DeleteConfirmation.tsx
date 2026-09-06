import { useEffect, useRef } from "react";

type DeleteConfirmationProps = {
  title: string;
  pending: boolean;
  error?: string;
  onCancel: () => void;
  onConfirm: () => void;
};

export function DeleteConfirmation({ title, pending, error, onCancel, onConfirm }: DeleteConfirmationProps) {
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
      className="delete-dialog"
      aria-labelledby="delete-title"
      aria-describedby="delete-description"
      onCancel={(event) => { event.preventDefault(); if (!pending) onCancel(); }}
    >
      <h2 id="delete-title">{title}</h2>
      <p id="delete-description">삭제한 기록은 되돌릴 수 없어요. 날짜와 기록 종류를 확인해 주세요.</p>
      {error && <p className="notice notice-warning" role="status">{error} 취소를 누른 뒤 목록을 다시 불러와 확인해 주세요.</p>}
      <div className="form-actions">
        <button className="secondary" type="button" onClick={onCancel} disabled={pending} autoFocus>취소</button>
        <button className="danger" type="button" onClick={onConfirm} disabled={pending}>{pending ? "삭제 중" : "삭제"}</button>
      </div>
    </dialog>
  );
}
