import type { ProductImageIndicator } from "../lib/commerceApi.js";

export type ProductImageOverlaysProps = {
  indicators: ProductImageIndicator[] | null | undefined;
  variant: "card" | "detail";
};

/**
 * Corner / edge badges on product imagery (reference-style overlays on cards + PDP).
 */
export function ProductImageOverlays({ indicators, variant }: ProductImageOverlaysProps) {
  const list = indicators?.filter((x) => x.kind?.trim()) ?? [];
  if (list.length === 0) return null;

  return (
    <div
      className={`product-image-overlays product-image-overlays--${variant}`}
      aria-hidden={variant === "card" ? true : undefined}
    >
      {list.map((x, i) => (
        <span
          key={`${x.placement}-${x.kind}-${i}`}
          className={`product-image-overlays__badge product-image-overlays__badge--${escapeKind(x.kind)}`}
          data-placement={x.placement}
          data-kind={x.kind}
        >
          {x.label?.trim() || x.kind}
        </span>
      ))}
    </div>
  );
}

function escapeKind(kind: string): string {
  return kind.replace(/[^a-z0-9-]+/gi, "").toLowerCase() || "tag";
}
