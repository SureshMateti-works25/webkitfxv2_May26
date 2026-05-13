import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CatalogThumbnail } from "./CatalogThumbnail.js";
import { ProductImageOverlays } from "./ProductImageOverlays.js";
import { WhatsAppFab } from "./WhatsAppFab.js";
import type {
  CatalogProductDetail,
  CatalogProductGalleryImage,
  ProductImageIndicator,
  SkuGalleryFacet,
} from "../lib/commerceApi.js";

export type StorefrontGallerySkuDetail = { skuId: string | null; skuCode: string | null };

export type ProductStorefrontWhatsappProps = {
  enabled: boolean;
  phoneDigits: string;
  messageTemplate: string;
  productTitle: string;
  productUrl: string;
  vendorCode: string | null;
  skuLine: string;
} | null;

export type ProductStorefrontGalleryProps = {
  product: CatalogProductDetail;
  imageIndicators: ProductImageIndicator[] | null | undefined;
  title: string;
  /** Optional second arg: lightbox uses only these slides (e.g. current SKU angles). */
  onRequestFullView: (startIndex: number, slidesForLightbox?: readonly { storageKey: string }[]) => void;
  /** Fired when the visible colour / SKU context changes (matrix, legacy slide `skuId`, or single-SKU hint). */
  onSkuSelectionChange?: (detail: StorefrontGallerySkuDetail) => void;
  /** Shell-driven WhatsApp deep link; FAB sits on the main image frame when enabled. */
  whatsapp?: ProductStorefrontWhatsappProps;
};

function isColorRole(role: string): boolean {
  const r = role.trim().toLowerCase();
  return r === "color" || r === "colour" || r === "swatch";
}

function useSkuMatrixMode(product: CatalogProductDetail) {
  return useMemo(() => {
    const facets = product.skuGalleryFacets ?? [];
    const hasSkuMedia = product.gallery.some((g) => (g.skuId ?? "").trim().length > 0);
    const active = facets.length > 0 && hasSkuMedia;
    return { active, facets };
  }, [product.gallery, product.skuGalleryFacets]);
}

function useAnglesAndColors(product: CatalogProductDetail) {
  return useMemo(() => {
    const angleFromApi = (product.angleImages ?? []).filter((x) => x.storageKey?.trim());
    const colorFromApi = (product.colorImages ?? []).filter((x) => x.storageKey?.trim());
    const gallery = (product.gallery ?? []).filter((x) => x.storageKey?.trim());

    if (angleFromApi.length > 0 || colorFromApi.length > 0) {
      let angles = angleFromApi;
      let colors = colorFromApi;
      if (angles.length === 0 && colors.length > 0) {
        angles = colors;
        colors = [];
      }
      return { angles, colors };
    }

    const colors = gallery.filter((x) => isColorRole(x.role));
    const angles = gallery.filter((x) => !isColorRole(x.role));
    if (angles.length === 0 && colors.length > 0)
      return { angles: colors, colors: [] as CatalogProductGalleryImage[] };
    return { angles, colors };
  }, [product.angleImages, product.colorImages, product.gallery]);
}

function ThumbnailRail(props: {
  label?: string;
  items: CatalogProductGalleryImage[];
  activeIndex: number;
  onSelect: (index: number) => void;
  variant: "angle" | "color";
  getItemAriaLabel?: (index: number) => string | undefined;
}) {
  const { label, items, activeIndex, onSelect, variant, getItemAriaLabel } = props;
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);

  const updateScrollButtons = useCallback(() => {
    const el = scrollRef.current;
    if (!el) {
      setCanScrollPrev(false);
      setCanScrollNext(false);
      return;
    }
    const maxLeft = el.scrollWidth - el.clientWidth;
    const left = el.scrollLeft;
    setCanScrollPrev(left > 2);
    setCanScrollNext(maxLeft - left > 2);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => updateScrollButtons();
    const onResize = () => updateScrollButtons();
    updateScrollButtons();
    el.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    return () => {
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
  }, [items.length, updateScrollButtons]);

  const scrollBy = useCallback((dx: number) => {
    scrollRef.current?.scrollBy({ left: dx, behavior: "smooth" });
  }, []);

  if (items.length === 0) return null;

  const labelText = label?.trim() ?? "";

  return (
    <div className={`pdp-storefront-rail pdp-storefront-rail--${variant}`}>
      {labelText ? <p className="pdp-storefront-rail__label">{labelText}</p> : null}
      <div className="pdp-storefront-rail__row">
        {canScrollPrev ? (
          <button
            type="button"
            className="pdp-storefront-rail__nav"
            aria-label="Scroll thumbnails left"
            onClick={() => scrollBy(-140)}
          >
            ‹
          </button>
        ) : null}
        <div ref={scrollRef} className="pdp-storefront-rail__scroll" role="list">
          {items.map((img, i) => (
            <button
              key={`${variant}-${img.storageKey}-${img.role}-${i}`}
              type="button"
              role="listitem"
              className={
                "pdp-storefront-rail__thumb" +
                (activeIndex >= 0 && i === activeIndex ? " pdp-storefront-rail__thumb--active" : "")
              }
              aria-current={activeIndex >= 0 && i === activeIndex ? "true" : undefined}
              aria-label={getItemAriaLabel?.(i) ?? `${variant === "angle" ? "View" : "Colour"} ${i + 1}`}
              onClick={() => onSelect(i)}
            >
              <CatalogThumbnail storageKey={img.storageKey} alt="" mediaClassName="pdp-storefront-rail__media" />
            </button>
          ))}
        </div>
        {canScrollNext ? (
          <button
            type="button"
            className="pdp-storefront-rail__nav"
            aria-label="Scroll thumbnails right"
            onClick={() => scrollBy(140)}
          >
            ›
          </button>
        ) : null}
      </div>
    </div>
  );
}

function SkuMatrixProductGallery({
  product,
  facets,
  imageIndicators,
  title,
  onRequestFullView,
  onSkuSelectionChange,
  whatsapp,
}: {
  product: CatalogProductDetail;
  facets: SkuGalleryFacet[];
  imageIndicators: ProductImageIndicator[] | null | undefined;
  title: string;
  onRequestFullView: (startIndex: number, slidesForLightbox?: readonly { storageKey: string }[]) => void;
  onSkuSelectionChange?: (detail: StorefrontGallerySkuDetail) => void;
  whatsapp?: ProductStorefrontWhatsappProps;
}) {
  const facetKey = facets.map((f) => f.skuId).join("|");
  const [selectedSkuId, setSelectedSkuId] = useState(facets[0]?.skuId ?? "");
  const [angleIdx, setAngleIdx] = useState(0);

  useEffect(() => {
    const first = facets[0]?.skuId ?? "";
    setSelectedSkuId(first);
    setAngleIdx(0);
  }, [product.id, facetKey, facets]);

  useEffect(() => {
    setAngleIdx(0);
  }, [selectedSkuId]);

  const anglesForSku = useMemo(() => {
    const g = product.gallery.filter((x) => x.storageKey?.trim());
    const nonColor = g.filter((img) => !isColorRole(img.role));
    const forSku = nonColor.filter((img) => {
      const sid = (img.skuId ?? "").trim();
      return sid.length === 0 || sid === selectedSkuId;
    });
    if (forSku.length > 0) return forSku;
    return g.filter((img) => {
      if (!isColorRole(img.role)) return false;
      const sid = (img.skuId ?? "").trim();
      return sid === selectedSkuId;
    });
  }, [product.gallery, selectedSkuId]);

  const safeAngleIdx = anglesForSku.length > 0 ? Math.min(angleIdx, anglesForSku.length - 1) : 0;
  const mainSlide = anglesForSku[safeAngleIdx];

  const colorRailItems: CatalogProductGalleryImage[] = useMemo(() => {
    return facets.map((f, i) => {
      const sw = (f.swatchStorageKey ?? "").trim();
      const slide =
        product.gallery.find(
          (g) => g.skuId === f.skuId && g.storageKey === sw && isColorRole(g.role)
        ) ??
        product.gallery.find((g) => g.skuId === f.skuId && isColorRole(g.role)) ??
        product.gallery.find((g) => g.skuId === f.skuId && !isColorRole(g.role)) ??
        product.gallery.find((g) => g.skuId === f.skuId);
      const storageKey = sw || slide?.storageKey?.trim() || "";
      return { storageKey, role: "swatch", sortOrder: i, skuId: f.skuId };
    });
  }, [facets, product.gallery]);

  const selectedFacetIndex = facets.findIndex((f) => f.skuId === selectedSkuId);
  const bottomActive = selectedFacetIndex >= 0 ? selectedFacetIndex : 0;

  const lightboxSlides = useMemo(
    () => anglesForSku.map((g) => ({ storageKey: g.storageKey.trim() })).filter((s) => s.storageKey.length > 0),
    [anglesForSku]
  );

  const goMain = useCallback(
    (delta: number) => {
      if (anglesForSku.length === 0) return;
      setAngleIdx((i) => (i + delta + anglesForSku.length) % anglesForSku.length);
    },
    [anglesForSku.length]
  );

  const selectedSkuCode = facets.find((f) => f.skuId === selectedSkuId)?.skuCode ?? "";

  useEffect(() => {
    onSkuSelectionChange?.({
      skuId: selectedSkuId.trim() || null,
      skuCode: selectedSkuCode?.trim() || null,
    });
  }, [onSkuSelectionChange, selectedSkuCode, selectedSkuId]);

  if (!mainSlide?.storageKey) {
    return (
      <div className="product-storefront-gallery product-storefront-gallery--empty">
        <div className="product-storefront-gallery__frame" />
      </div>
    );
  }

  const vendorLine = product.vendorCode?.trim() ?? "";
  const skuText =
    selectedSkuCode?.trim() ||
    (product.skuCodes?.length ? product.skuCodes.filter((c) => c.trim()).join(" · ") : "");
  const showTopRail = anglesForSku.length > 0 && (anglesForSku.length > 1 || facets.length > 1);

  return (
    <div className="product-storefront-gallery">
      {showTopRail ? (
        <ThumbnailRail
          variant="angle"
          items={anglesForSku}
          activeIndex={safeAngleIdx}
          onSelect={(i) => setAngleIdx(i)}
          getItemAriaLabel={(i) => {
            const r = anglesForSku[i]?.role?.trim();
            return r ? `View ${r} (${i + 1} of ${anglesForSku.length})` : `View ${i + 1} of ${anglesForSku.length}`;
          }}
        />
      ) : null}

      <div className="product-storefront-gallery__frame">
        <button
          type="button"
          className="product-storefront-gallery__expand"
          aria-label="View product photos full screen"
          onClick={(e) => {
            e.stopPropagation();
            onRequestFullView(
              lightboxSlides.length > 0 ? safeAngleIdx : 0,
              lightboxSlides.length > 0 ? lightboxSlides : undefined
            );
          }}
        >
          Full screen
        </button>
        {anglesForSku.length > 1 ? (
          <button
            type="button"
            className="product-storefront-gallery__nav product-storefront-gallery__nav--prev"
            onClick={() => goMain(-1)}
            aria-label="Previous image"
          >
            ‹
          </button>
        ) : null}
        {anglesForSku.length > 1 ? (
          <button
            type="button"
            className="product-storefront-gallery__nav product-storefront-gallery__nav--next"
            onClick={() => goMain(1)}
            aria-label="Next image"
          >
            ›
          </button>
        ) : null}
        <div
          className="product-storefront-gallery__hit product-storefront-gallery__hit--zoomable"
          onClick={() =>
            onRequestFullView(
              lightboxSlides.length > 0 ? safeAngleIdx : 0,
              lightboxSlides.length > 0 ? lightboxSlides : undefined
            )
          }
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onRequestFullView(
                lightboxSlides.length > 0 ? safeAngleIdx : 0,
                lightboxSlides.length > 0 ? lightboxSlides : undefined
              );
            }
          }}
          role="button"
          tabIndex={0}
          aria-label="Open full screen gallery"
        >
          <CatalogThumbnail
            key={mainSlide.storageKey + String(safeAngleIdx) + selectedSkuId}
            storageKey={mainSlide.storageKey}
            alt={title}
            mediaClassName="product-storefront-gallery__media"
          />
        </div>
        <ProductImageOverlays indicators={imageIndicators} variant="detail" />
        {whatsapp && whatsapp.enabled && whatsapp.phoneDigits.replace(/\D/g, "").length > 0 ? (
          <WhatsAppFab
            className="product-storefront-gallery__whatsapp"
            phoneDigits={whatsapp.phoneDigits}
            messageTemplate={whatsapp.messageTemplate}
            vars={{
              title: whatsapp.productTitle,
              url: whatsapp.productUrl,
              vendor: whatsapp.vendorCode?.trim() ?? "",
              sku: whatsapp.skuLine,
            }}
          />
        ) : null}
        {vendorLine || skuText ? (
          <div className="product-storefront-gallery__codes" aria-label="Product codes">
            {vendorLine ? (
              <span className="product-storefront-gallery__code" title={vendorLine}>
                {vendorLine.length > 22 ? `${vendorLine.slice(0, 20)}…` : vendorLine}
              </span>
            ) : null}
            {skuText ? (
              <span className="product-storefront-gallery__code" title={skuText}>
                SKU: {skuText.length > 28 ? `${skuText.slice(0, 26)}…` : skuText}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      {facets.length > 0 ? (
        <ThumbnailRail
          label="Colours"
          variant="color"
          items={colorRailItems}
          activeIndex={bottomActive}
          onSelect={(j) => {
            const f = facets[j];
            if (f) setSelectedSkuId(f.skuId);
          }}
          getItemAriaLabel={(i) => {
            const code = facets[i]?.skuCode ?? "";
            return code ? `Show photos for ${code}` : `Colour option ${i + 1}`;
          }}
        />
      ) : null}
    </div>
  );
}

function LegacyProductStorefrontGallery({
  product,
  imageIndicators,
  title,
  onRequestFullView,
  onSkuSelectionChange,
  whatsapp,
}: {
  product: CatalogProductDetail;
  imageIndicators: ProductImageIndicator[] | null | undefined;
  title: string;
  onRequestFullView: (startIndex: number, slidesForLightbox?: readonly { storageKey: string }[]) => void;
  onSkuSelectionChange?: (detail: StorefrontGallerySkuDetail) => void;
  whatsapp?: ProductStorefrontWhatsappProps;
}) {
  const { angles, colors } = useAnglesAndColors(product);
  const unified = useMemo(() => [...angles, ...colors], [angles, colors]);

  const [mainIdx, setMainIdx] = useState(0);
  useEffect(() => {
    setMainIdx(0);
  }, [product.id]);

  const safeIdx = unified.length > 0 ? Math.min(mainIdx, unified.length - 1) : 0;
  const mainSlide = unified[safeIdx];

  const galleryOrdered = useMemo(() => {
    const g = product.gallery?.filter((x) => x.storageKey?.trim()) ?? [];
    if (g.length > 0) return g;
    return unified;
  }, [product.gallery, unified]);

  const fullViewGalleryIndex = useMemo(() => {
    if (!mainSlide?.storageKey) return 0;
    const i = galleryOrdered.findIndex(
      (x) => x.storageKey === mainSlide.storageKey && x.role === mainSlide.role
    );
    return i >= 0 ? i : safeIdx;
  }, [galleryOrdered, mainSlide, safeIdx]);

  const topActive = safeIdx < angles.length ? safeIdx : -1;
  const bottomActive = safeIdx >= angles.length ? safeIdx - angles.length : -1;

  const goMain = useCallback(
    (delta: number) => {
      if (unified.length === 0) return;
      setMainIdx((i) => (i + delta + unified.length) % unified.length);
    },
    [unified.length]
  );

  const legacySkuDetail = useMemo((): StorefrontGallerySkuDetail => {
    const sid = (mainSlide?.skuId ?? "").trim();
    if (sid) {
      const facet = (product.skuGalleryFacets ?? []).find((f) => f.skuId === sid);
      return {
        skuId: sid,
        skuCode: facet?.skuCode?.trim() || null,
      };
    }
    const codes = (product.skuCodes ?? []).map((c) => c.trim()).filter(Boolean);
    if (codes.length === 1) return { skuId: null, skuCode: codes[0]! };
    return { skuId: null, skuCode: null };
  }, [mainSlide?.skuId, product.skuCodes, product.skuGalleryFacets]);

  useEffect(() => {
    onSkuSelectionChange?.(legacySkuDetail);
  }, [legacySkuDetail, onSkuSelectionChange]);

  if (!mainSlide?.storageKey) {
    return (
      <div className="product-storefront-gallery product-storefront-gallery--empty">
        <div className="product-storefront-gallery__frame" />
      </div>
    );
  }

  const vendorLine = product.vendorCode?.trim() ?? "";
  const skuLine = product.skuCodes?.length ? product.skuCodes.join(" · ") : "";

  return (
    <div className="product-storefront-gallery">
      {angles.length > 0 && (angles.length > 1 || colors.length > 0) ? (
        <ThumbnailRail variant="angle" items={angles} activeIndex={topActive} onSelect={(i) => setMainIdx(i)} />
      ) : null}

      <div className="product-storefront-gallery__frame">
        <button
          type="button"
          className="product-storefront-gallery__expand"
          aria-label="View product photos full screen"
          onClick={(e) => {
            e.stopPropagation();
            onRequestFullView(fullViewGalleryIndex);
          }}
        >
          Full screen
        </button>
        {unified.length > 1 ? (
          <button
            type="button"
            className="product-storefront-gallery__nav product-storefront-gallery__nav--prev"
            onClick={() => goMain(-1)}
            aria-label="Previous image"
          >
            ‹
          </button>
        ) : null}
        {unified.length > 1 ? (
          <button
            type="button"
            className="product-storefront-gallery__nav product-storefront-gallery__nav--next"
            onClick={() => goMain(1)}
            aria-label="Next image"
          >
            ›
          </button>
        ) : null}
        <div
          className="product-storefront-gallery__hit product-storefront-gallery__hit--zoomable"
          onClick={() => onRequestFullView(fullViewGalleryIndex)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onRequestFullView(fullViewGalleryIndex);
            }
          }}
          role="button"
          tabIndex={0}
          aria-label="Open full screen gallery"
        >
          <CatalogThumbnail
            key={mainSlide.storageKey + String(safeIdx)}
            storageKey={mainSlide.storageKey}
            alt={title}
            mediaClassName="product-storefront-gallery__media"
          />
        </div>
        <ProductImageOverlays indicators={imageIndicators} variant="detail" />
        {whatsapp && whatsapp.enabled && whatsapp.phoneDigits.replace(/\D/g, "").length > 0 ? (
          <WhatsAppFab
            className="product-storefront-gallery__whatsapp"
            phoneDigits={whatsapp.phoneDigits}
            messageTemplate={whatsapp.messageTemplate}
            vars={{
              title: whatsapp.productTitle,
              url: whatsapp.productUrl,
              vendor: whatsapp.vendorCode?.trim() ?? "",
              sku: whatsapp.skuLine,
            }}
          />
        ) : null}
        {vendorLine || skuLine ? (
          <div className="product-storefront-gallery__codes" aria-label="Product codes">
            {vendorLine ? (
              <span className="product-storefront-gallery__code" title={vendorLine}>
                {vendorLine.length > 22 ? `${vendorLine.slice(0, 20)}…` : vendorLine}
              </span>
            ) : null}
            {skuLine ? (
              <span className="product-storefront-gallery__code" title={skuLine}>
                {skuLine}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      {colors.length > 0 ? (
        <ThumbnailRail
          label="Colours"
          variant="color"
          items={colors}
          activeIndex={bottomActive}
          onSelect={(j) => setMainIdx(angles.length + j)}
        />
      ) : null}
    </div>
  );
}

/**
 * Storefront gallery: angle rail on top, colour rail below, or SKU matrix (colour = SKU → angles filtered by SKU).
 */
export function ProductStorefrontGallery(props: ProductStorefrontGalleryProps) {
  const { product, imageIndicators, title, onRequestFullView, onSkuSelectionChange, whatsapp } = props;
  const matrix = useSkuMatrixMode(product);
  if (matrix.active) {
    return (
      <SkuMatrixProductGallery
        product={product}
        facets={matrix.facets}
        imageIndicators={imageIndicators}
        title={title}
        onRequestFullView={onRequestFullView}
        onSkuSelectionChange={onSkuSelectionChange}
        whatsapp={whatsapp}
      />
    );
  }
  return (
    <LegacyProductStorefrontGallery
      product={product}
      imageIndicators={imageIndicators}
      title={title}
      onRequestFullView={onRequestFullView}
      onSkuSelectionChange={onSkuSelectionChange}
      whatsapp={whatsapp}
    />
  );
}
