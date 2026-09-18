import type { SVGProps } from "react";
import { uiIconPaths, type UiIconName } from "../ui/uiIconPaths";

type UiIconProps = Omit<SVGProps<SVGSVGElement>, "children" | "dangerouslySetInnerHTML" | "name"> & {
  name: UiIconName;
  size?: number;
};

/** Always decorative. Put the accessible name on its native button/link or adjacent HTML label. */
export function UiIcon({ name, size = 24, className = "", ...props }: UiIconProps) {
  const glyph = uiIconPaths[name];
  return (
    <svg {...props} className={`ui-icon ${className}`.trim()} data-ui-icon={name}
      viewBox="0 0 24 24" width={size} height={size} fill="none"
      stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true" focusable="false">
      {"wash" in glyph && <path d={glyph.wash} fill="currentColor" fillOpacity={0.12} stroke="none" />}
      {glyph.paths.map((d, index) => <path d={d} key={index} />)}
    </svg>
  );
}
