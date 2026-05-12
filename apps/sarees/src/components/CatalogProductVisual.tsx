import { CatalogThumbnail } from "./CatalogThumbnail.js";
import { ProductImageOverlays } from "./ProductImageOverlays.js";
import type { ProductImageIndicator } from "../lib/commerceApi.js";

export type CatalogProductVisualProps = {
  storageKey: string | null | undefined;
  alt?: string;
  className?: string;
  mediaClassName?: string;
  imageIndicators?: ProductImageIndicator[] | null;
  vendorCode?: string | null;
  skuCodes?: readonly string[] | null;
};

function formatSkuOverlayLine(codes: readonly string[] | null | undefined): string {
  if (!codes || codes.length === 0) return "";
  return codes.join(" · ");
}

/** Card / rail media cell: hero image + merchandising overlay badges + optional vendor/SKU chips. */
export function CatalogProductVisual({
  storageKey,
  alt = "",
  className = "",
  mediaClassName = "",
  imageIndicators,
  vendorCode,
  skuCodes,
}: CatalogProductVisualProps) {
  const v = vendorCode?.trim() ?? "";
  const skuLine = formatSkuOverlayLine(skuCodes ?? undefined);

  return (
    <div className={`catalog-product-visual ${className}`.trim()}>
      <CatalogThumbnail storageKey={storageKey} alt={alt} mediaClassName={mediaClassName} />
      <ProductImageOverlays indicators={imageIndicators} variant="card" />
      {v || skuLine ? (
        <div className="catalog-product-visual__codes" aria-label="Vendor and SKU">
          {v ? (
            <span className="catalog-product-visual__code" title={v}>
              {v.length > 20 ? `${v.slice(0, 18)}…` : v}
            </span>
          ) : null}
          {skuLine ? (
            <span className="catalog-product-visual__code" title={skuLine}>
              SKU: {skuLine.length > 28 ? `${skuLine.slice(0, 26)}…` : skuLine}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
