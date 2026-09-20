import type { ScreenId } from "../ui/journey";

export type JourneySkeletonFamily = "today" | "records" | "workspace";

const recordScreens = new Set<ScreenId>(["S07", "S08", "S09", "S10"]);

export function journeySkeletonFamily(screen: ScreenId): JourneySkeletonFamily {
  if (screen === "S02") return "today";
  if (recordScreens.has(screen)) return "records";
  return "workspace";
}

function SkeletonBlock({ className = "" }: { className?: string }) {
  return <span className={`journey-skeleton-block ${className}`.trim()} />;
}

function TodaySkeleton() {
  return <>
    <div className="journey-skeleton-primary">
      <SkeletonBlock className="journey-skeleton-primary-copy" />
      <SkeletonBlock className="journey-skeleton-primary-action" />
    </div>
    <div className="journey-skeleton-week">
      <SkeletonBlock className="journey-skeleton-section-title" />
      <div className="journey-skeleton-days">
        {Array.from({ length: 7 }, (_, index) => <SkeletonBlock key={index} className="journey-skeleton-day" />)}
      </div>
    </div>
    <div className="journey-skeleton-facts">
      <SkeletonBlock />
      <SkeletonBlock />
    </div>
  </>;
}

function RecordsSkeleton() {
  return <>
    <div className="journey-skeleton-period">
      <SkeletonBlock />
      <SkeletonBlock className="journey-skeleton-period-range" />
      <SkeletonBlock />
    </div>
    <div className="journey-skeleton-reading">
      <SkeletonBlock className="journey-skeleton-section-title" />
      <SkeletonBlock className="journey-skeleton-record" />
      <SkeletonBlock className="journey-skeleton-record" />
      <SkeletonBlock className="journey-skeleton-record journey-skeleton-record-short" />
    </div>
  </>;
}

function WorkspaceSkeleton() {
  return <div className="journey-skeleton-workspace">
    <SkeletonBlock className="journey-skeleton-workspace-intro" />
    <div className="journey-skeleton-workspace-panel">
      <SkeletonBlock />
      <SkeletonBlock />
      <SkeletonBlock className="journey-skeleton-workspace-wide" />
    </div>
  </div>;
}

export function JourneySkeleton({ screen }: { screen: ScreenId }) {
  const family = journeySkeletonFamily(screen);

  return <>
    <p className="journey-loading-status" role="status" aria-live="polite">
      선택한 7일의 기록을 불러오는 중이에요.
    </p>
    <section
      className="loading-scene journey-skeleton"
      data-journey-skeleton="true"
      data-journey-skeleton-family={family}
      aria-busy="true"
      aria-label="기록을 불러오는 중"
    >
      <div className="journey-skeleton-layout" aria-hidden="true">
        <div className="journey-skeleton-heading">
          <SkeletonBlock className="journey-skeleton-eyebrow" />
          <SkeletonBlock className="journey-skeleton-title" />
          <SkeletonBlock className="journey-skeleton-support" />
        </div>
        {family === "today" ? <TodaySkeleton /> : family === "records" ? <RecordsSkeleton /> : <WorkspaceSkeleton />}
      </div>
    </section>
  </>;
}
