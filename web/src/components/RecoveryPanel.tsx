import { useEffect, useId, useRef, type ReactNode } from "react";

import { UiIcon } from "./UiIcon";

export type RecoveryKind =
  | "initial-load"
  | "stale-read"
  | "uncertain-save"
  | "uncertain-delete"
  | "known-rejection"
  | "session-expired"
  | "export-failure";

export type RecoveryContent = {
  kind: RecoveryKind;
  title: string;
  known: string;
  unknown?: string;
  next: string;
};

type RecoveryPanelProps = RecoveryContent & {
  actions?: ReactNode;
  className?: string;
  focusOnMount?: boolean;
  role?: "alert" | "status";
  tone?: "critical" | "warning";
};

export function RecoveryPanel({
  kind,
  title,
  known,
  unknown,
  next,
  actions,
  className = "",
  focusOnMount = false,
  role = "status",
  tone = "warning",
}: RecoveryPanelProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (focusOnMount) panelRef.current?.focus({ preventScroll: true });
  }, [focusOnMount]);

  return (
    <section
      ref={panelRef}
      className={`notice notice-${tone === "critical" ? "error" : "warning"} recovery-panel recovery-panel--${tone} ${className}`.trim()}
      data-recovery-kind={kind}
      role={role}
      aria-labelledby={titleId}
      tabIndex={focusOnMount ? -1 : undefined}
    >
      <div className="recovery-panel__icon" aria-hidden="true">
        <UiIcon name={kind === "known-rejection" ? "info" : kind === "export-failure" ? "download" : "warning"} size={24} />
      </div>
      <div className="recovery-panel__body">
        <header className="recovery-panel__header">
          <span>확인 상태</span>
          <strong id={titleId}>{title}</strong>
        </header>
        <dl className="recovery-panel__facts">
          <div>
            <dt>확인됨</dt>
            <dd>{known}</dd>
          </div>
          {unknown && <div>
            <dt>아직 확인되지 않음</dt>
            <dd>{unknown}</dd>
          </div>}
          <div className="recovery-panel__next">
            <dt>지금 할 일</dt>
            <dd>{next}</dd>
          </div>
        </dl>
        {actions && <div className="recovery-panel__actions action-group">{actions}</div>}
      </div>
    </section>
  );
}
