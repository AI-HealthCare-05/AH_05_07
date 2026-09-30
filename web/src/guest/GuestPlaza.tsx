import { Component, lazy, Suspense, useEffect, useRef, type ReactNode } from "react";
import type { CompanionAsset } from "../ui/companionAssets.generated";
import "../ui/mySpaceReturn.css";
import "../placeable/placeable.css";
import "./guest-plaza.css";

const World = lazy(() => import("../placeable/PlaceableWorld"));
const quiet = () => {};

class WorldRecovery extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed ? <div className="placeable-world-message" role="alert">
      <h2>3D 공간을 열지 못했어요</h2>
      <p>오늘 화면으로 돌아가 체험을 계속할 수 있어요.</p>
    </div> : this.props.children;
  }
}

/** Presentation/navigation only. The Guest Journey retains its own memory.
 * No controller, persistence adapter, auth, health, model or cosmetic owner. */
export default function GuestPlaza({ companion, onReturn }: {
  companion: CompanionAsset | null;
  onReturn: () => void;
}) {
  const title = useRef<HTMLHeadingElement>(null);
  useEffect(() => { title.current?.focus({ preventScroll: true }); }, []);

  return <main className="placeable-experience placeable-world-view guest-plaza" data-guest-space="plaza">
    <header className="placeable-header">
      <div className="placeable-home-title">
        <p className="placeable-eyebrow">SK7 · LIVING CITY</p>
        <h1 ref={title} tabIndex={-1}>3D 체험 공간</h1>
        <p className="plaza-scope">이번 체험에서만 · 저장되지 않아요</p>
      </div>
      <button type="button" className="guest-plaza-return" onClick={onReturn}>오늘 화면으로 돌아가기 <span aria-hidden="true">→</span></button>
    </header>
    <section className="guest-plaza-stage" aria-label="체험 광장">
      <WorldRecovery>
        <Suspense fallback={<p className="guest-plaza-loading" role="status">광장을 열고 있어요…</p>}>
          <World presentation="guest" companion={companion} selection={null} preview={false}
            pulse={0} suspended={false} canInteract={false} onInteract={quiet} onTwilight={quiet} />
        </Suspense>
      </WorldRecovery>
    </section>
  </main>;
}
