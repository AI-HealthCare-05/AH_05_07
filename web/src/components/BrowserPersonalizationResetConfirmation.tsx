import { useEffect, useRef } from "react";
import { dataScopeLabel } from "../ui/dataScope";

type BrowserPersonalizationResetConfirmationProps = {
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
};

export function BrowserPersonalizationResetConfirmation({
  error,
  onCancel,
  onConfirm,
}: BrowserPersonalizationResetConfirmationProps) {
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
      className="delete-dialog browser-reset-dialog surface"
      aria-labelledby="browser-reset-title"
      aria-describedby="browser-reset-description"
      onCancel={(event) => { event.preventDefault(); onCancel(); }}
    >
      <div className="screen-header">
        <p className="eyebrow" data-scope-label="browser">{dataScopeLabel("browser")}</p>
        <h2 id="browser-reset-title">이 브라우저의 개인화를 초기화할까요?</h2>
        <p id="browser-reset-description">화면 테마, 시작 화면, 동반자, 브라우저 전용 My Space 배치를 기본값으로 되돌립니다.</p>
      </div>
      <div className="browser-reset-boundary" aria-label="초기화 범위">
        <div><strong>초기화됨 · <span data-scope-label="browser">{dataScopeLabel("browser")}</span></strong><span>개인화 4가지</span></div>
        <div><strong>변경되지 않음</strong><span><span data-scope-label="account">{dataScopeLabel("account")}</span> · 로그인·서버 기록·계정 My Space · <span data-scope-label="device-file">{dataScopeLabel("deviceFile")}</span></span></div>
      </div>
      {error && <p className="notice notice-warning status-notice" role="alert">{error}</p>}
      <div className="form-actions action-group">
        <button className="secondary" type="button" onClick={onCancel}>취소</button>
        <button type="button" onClick={onConfirm}>이 브라우저만 초기화</button>
      </div>
    </dialog>
  );
}
