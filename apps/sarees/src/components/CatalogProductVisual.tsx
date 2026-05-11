import { CatalogThumbnail } from "./CatalogThumbnail.js";
import { ProductImageOverlays } from "./ProductImageOverlays.js";
import type { ProductImageIndicator } from "../lib/commerceApi.js";

export type CatalogProductVisualProps = {
  storageKey: string | null | undefined;
  alt?: string;
  className?: string;
  mediaClassName?: string;
  imageIndicators?: ProductImageIndicator[] | null;
};

/** Card / rail media cell: hero image + merchandising overlay badges. */
export function CatalogProductVisual({
  storageKey,
  alt = "",
  className = "",
  mediaClassName = "",
  imageIndicators,
}: CatalogProductVisualProps) {
  return (
    <div className={`catalog-product-visual ${className}`.trim()}>
      <CatalogThumbnail storageKey={storageKey} alt={alt} mediaClassName={mediaClassName} />
      <ProductImageOverlays indicators={imageIndicators} variant="card" />
    </div>
  );
}
