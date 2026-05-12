import { useCallback, useEffect, useState } from "react";
import { CatalogThumbnail } from "./CatalogThumbnail.js";
import { ProductImageOverlays } from "./ProductImageOverlays.js";
import type { CatalogProductGalleryImage, ProductImageIndicator } from "../lib/commerceApi.js";

export type ProductGalleryStageProps = {
  heroStorageKey: string | null;
  gallery: CatalogProductGalleryImage[];
  imageIndicators: ProductImageIndicator[] | null | undefined;
  title: string;
  variant?: "detail";
  /** When set, shows full-screen control and opens the lightbox at the given index. */
  onRequestFullView?: (index: number) => void;
};

/**
 * PDP hero: main image, overlay badges, bottom dot indicators when multiple gallery slots exist.
 */
export function ProductGalleryStage({
  heroStorageKey,
  gallery,
  imageIndicators,
  title,
  variant = "detail",
  onRequestFullView,
}: ProductGalleryStageProps) {
  const slides =
    gallery.length > 0
      ? gallery
      : heroStorageKey
        ? [{ storageKey: heroStorageKey, role: "hero", sortOrder: 0 }]
        : [];

  const [active, setActive] = useState(0);

  useEffect(() => {
    setActive(0);
  }, [gallery, heroStorageKey]);

  const safeIndex = slides.length > 0 ? Math.min(active, slides.length - 1) : 0;
  const current = slides[safeIndex];
  const showDots = slides.length > 1;

  const go = useCallback(
    (i: number) => {
      if (slides.length === 0) return;
      const next = ((i % slides.length) + slides.length) % slides.length;
      setActive(next);
    },
    [slides.length]
  );

  if (!current?.storageKey) {
    return (
      <div className="product-gallery-stage product-gallery-stage--empty">
        <div className="product-gallery-stage__frame" />
      </div>
    );
  }

  return (
    <div className={`product-gallery-stage product-gallery-stage--${variant}`}>
      <div className="product-gallery-stage__frame">
        {onRequestFullView ? (
          <button
            type="button"
            className="product-gallery-stage__expand"
            aria-label="View product photos full screen"
            onClick={(e) => {
              e.stopPropagation();
              onRequestFullView(safeIndex);
            }}
          >
            Full screen
          </button>
        ) : null}
        <div
          className={
            "product-gallery-stage__hit" + (onRequestFullView ? " product-gallery-stage__hit--zoomable" : "")
          }
          onClick={() => onRequestFullView?.(safeIndex)}
        >
          <CatalogThumbnail
            key={current.storageKey + String(safeIndex)}
            storageKey={current.storageKey}
            alt={title}
            mediaClassName="product-gallery-stage__media"
          />
        </div>
        <ProductImageOverlays indicators={imageIndicators} variant="detail" />
      </div>
      {showDots ? (
        <div className="product-gallery-stage__dots" role="tablist" aria-label="Product photos">
          {slides.map((_, i) => (
            <button
              key={String(i)}
              type="button"
              role="tab"
              aria-selected={i === safeIndex}
              aria-label={`Photo ${i + 1} of ${slides.length}`}
              className={
                "product-gallery-stage__dot" + (i === safeIndex ? " product-gallery-stage__dot--active" : "")
              }
              onClick={() => go(i)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
