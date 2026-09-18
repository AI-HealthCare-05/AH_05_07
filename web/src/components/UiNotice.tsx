import type { ReactNode } from "react";
import { UiIcon } from "./UiIcon";
import type { UiIconName } from "../ui/uiIconPaths";

type UiNoticeProps = {
  title: string;
  children: string;
  icon?: UiIconName;
  tone?: "quiet" | "empty" | "retry";
  actions?: ReactNode;
};

/** An optional presentation block, not a live region or a source of product state. */
export function UiNotice({ title, children, icon = "info", tone = "quiet", actions }: UiNoticeProps) {
  return (
    <div className={`ui-notice ui-notice--${tone}`}>
      <UiIcon name={icon} />
      <div className="ui-notice__copy">
        <strong>{title}</strong>
        <p>{children}</p>
        {actions && <div className="ui-notice__actions">{actions}</div>}
      </div>
    </div>
  );
}
