type UiObjectName = "notebook" | "book" | "plant" | "mug" | "lamp" | "paper-plane";
type UiObjectProps = { name: UiObjectName; className?: string };

/** Small static render of a project-owned GLB. No canvas, status inference, preload or retry. */
export function UiObject({ name, className = "" }: UiObjectProps) {
  const src = `/assets/ui/v1/objects/${name}-320.webp`;
  return (
    <span className={`ui-object ${className}`.trim()} aria-hidden="true" data-ui-object={name}>
      <img key={src} src={src} srcSet={`/assets/ui/v1/objects/${name}-160.webp 160w, ${src} 320w`}
        sizes="(max-width: 580px) 80px, 144px" width={320} height={320}
        alt="" aria-hidden="true" draggable={false} loading="lazy" decoding="async" fetchPriority="low"
        onError={event => { event.currentTarget.hidden = true; }} />
    </span>
  );
}
