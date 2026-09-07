import { useState } from "react";

import type { VisualAssetRecord } from "../ui/r2VisualAssets";

type SceneVisualAssetProps = {
  asset: VisualAssetRecord;
  className?: string;
};

export function SceneVisualAsset({ asset, className = "" }: SceneVisualAssetProps) {
  const [failed, setFailed] = useState(false);
  if (!asset.active || !asset.decorative || failed) return null;

  return (
    <img
      className={`scene-visual-asset ${className}`.trim()}
      src={asset.currentUrl}
      alt=""
      aria-hidden="true"
      draggable={false}
      decoding="async"
      loading={asset.loading}
      fetchPriority={asset.fetchPriority}
      data-visual-asset-id={asset.id}
      data-load-state="loading"
      onLoad={(event) => event.currentTarget.setAttribute("data-load-state", "ready")}
      onError={(event) => {
        event.currentTarget.setAttribute("data-load-state", "failed");
        setFailed(true);
      }}
    />
  );
}

type SceneVisualBackgroundProps = {
  desktop: VisualAssetRecord;
  mobile: VisualAssetRecord;
};

export function SceneVisualBackground({ desktop, mobile }: SceneVisualBackgroundProps) {
  const [failed, setFailed] = useState(false);
  if (failed || !desktop.active || !mobile.active) return null;

  return (
    <picture className="scene-visual-background" aria-hidden="true" data-visual-background>
      <source media="(max-width: 580px)" srcSet={mobile.currentUrl} />
      <img
        src={desktop.currentUrl}
        alt=""
        decoding="async"
        loading="lazy"
        fetchPriority="low"
        draggable={false}
        onError={() => setFailed(true)}
      />
    </picture>
  );
}
