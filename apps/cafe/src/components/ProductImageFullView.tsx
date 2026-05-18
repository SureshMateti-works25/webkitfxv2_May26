import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { mediaAssetUrl } from "../lib/commerceApi.js";
import { ProductCardPrices } from "./ProductCardPrices.js";
import { WhatsAppFab } from "./WhatsAppFab.js";

export type ProductImageFullViewWhatsapp = {
  enabled: boolean;
  phoneDigits: string;
  messageTemplate: string;
  productTitle: string;
  productUrl: string;
  vendorCode: string | null;
  skuLine: string;
};

export type ProductImageFullViewProps = {
  open: boolean;
  onClose: () => void;
  slides: readonly { storageKey: string }[];
  startIndex: number;
  title: string;
  minPriceMinor: number | null;
  currency: string | null;
  listPriceMinor: number | null;
  offerPriceMinor: number | null;
  offerType: string | null;
  offerCardText: string | null;
  vendorCode: string | null;
  skuCodes: readonly string[];
  /** Floating WhatsApp on the image stage (same shell template as PDP gallery). */
  whatsapp?: ProductImageFullViewWhatsapp | null;
};

/**
 * Full-view lightbox: image-only stage with prev/next, pricing, offer caption, vendor code, SKUs.
 */
export function ProductImageFullView({
  open,
  onClose,
  slides,
  startIndex,
  title,
  minPriceMinor,
  currency,
  listPriceMinor,
  offerPriceMinor,
  offerType,
  offerCardText,
  vendorCode,
  skuCodes,
  whatsapp,
}: ProductImageFullViewProps) {
  const [active, setActive] = useState(0);
  const [broken, setBroken] = useState(false);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  const go = useCallback(
    (delta: number) => {
      setActive((i) => {
        if (slides.length === 0) return i;
        return (i + delta + slides.length) % slides.length;
      });
    },
    [slides.length]
  );

  useEffect(() => {
    if (!open) return;
    const max = Math.max(0, slides.length - 1);
    const s = Math.min(Math.max(0, startIndex), max);
    setActive(s);
    setBroken(false);
  }, [open, startIndex, slides]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    queueMicrotask(() => closeBtnRef.current?.focus());
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose, go]);

  useEffect(() => {
    setBroken(false);
  }, [active, open]);

  if (!open || slides.length === 0) return null;

  const cur = slides[active];
  if (!cur?.storageKey) return null;

  const src = mediaAssetUrl(cur.storageKey.trim());
  const offerOn = Boolean(offerType && offerType.toLowerCase() !== "none");
  const caption = offerCardText?.trim() ?? "";

  const ui = (
    <div className="product-image-fullview" role="dialog" aria-modal="true" aria-labelledby="product-image-fullview-title">
      <button type="button" className="product-image-fullview__backdrop" aria-label="Close gallery" onClick={onClose} />
      <button
        ref={closeBtnRef}
        type="button"
        className="product-image-fullview__close"
        onClick={onClose}
        aria-label="Close"
      >
        ×
      </button>
      {slides.length > 1 ? (
        <button
          type="button"
          className="product-image-fullview__nav product-image-fullview__nav--prev"
          onClick={() => go(-1)}
          aria-label="Previous image"
        >
          ‹
        </button>
      ) : null}
      {slides.length > 1 ? (
        <button
          type="button"
          className="product-image-fullview__nav product-image-fullview__nav--next"
          onClick={() => go(1)}
          aria-label="Next image"
        >
          ›
        </button>
      ) : null}
      <div className="product-image-fullview__stage">
        {!broken ? (
          <img
            key={String(active) + src}
            src={src}
            alt=""
            className="product-image-fullview__img"
            onError={() => setBroken(true)}
          />
        ) : (
          <p className="product-image-fullview__img-fallback">Image unavailable</p>
        )}
        {vendorCode?.trim() || skuCodes.length > 0 ? (
          <div className="product-image-fullview__codes" aria-label="Vendor and SKU">
            {vendorCode?.trim() ? (
              <span className="product-image-fullview__code" title={vendorCode.trim()}>
                {vendorCode.trim().length > 22 ? `${vendorCode.trim().slice(0, 20)}…` : vendorCode.trim()}
              </span>
            ) : null}
            {skuCodes.length > 0 ? (
              <span className="product-image-fullview__code" title={skuCodes.join(" · ")}>
                SKU:{" "}
                {skuCodes.join(" · ").length > 28
                  ? `${skuCodes.join(" · ").slice(0, 26)}…`
                  : skuCodes.join(" · ")}
              </span>
            ) : null}
          </div>
        ) : null}
        {whatsapp && whatsapp.enabled && whatsapp.phoneDigits.replace(/\D/g, "").length > 0 ? (
          <WhatsAppFab
            className="product-image-fullview__whatsapp"
            phoneDigits={whatsapp.phoneDigits}
            messageTemplate={whatsapp.messageTemplate}
            vars={{
              title: whatsapp.productTitle,
              url: whatsapp.productUrl,
              vendor: whatsapp.vendorCode?.trim() ?? "",
              sku: whatsapp.skuLine,
            }}
            ariaLabel="Chat on WhatsApp about this product (opens in a new tab)"
          />
        ) : null}
      </div>
      <footer className="product-image-fullview__dock">
        <h2 id="product-image-fullview-title" className="product-image-fullview__title">
          {title}
        </h2>
        <ProductCardPrices
          variant="detail"
          className="product-image-fullview__prices"
          minPriceMinor={minPriceMinor}
          currency={currency}
          listPriceMinor={listPriceMinor}
          offerPriceMinor={offerPriceMinor}
          offerType={offerType}
          offerCardText={offerCardText}
        />
        {offerOn && caption ? <p className="product-image-fullview__caption">{caption}</p> : null}
        <dl className="product-image-fullview__meta">
          <div className="product-image-fullview__meta-row">
            <dt>Vendor code</dt>
            <dd>{vendorCode?.trim() || "—"}</dd>
          </div>
          <div className="product-image-fullview__meta-row">
            <dt>SKU</dt>
            <dd>{skuCodes.length > 0 ? skuCodes.join(" · ") : "—"}</dd>
          </div>
        </dl>
        {slides.length > 1 ? (
          <p className="product-image-fullview__counter" aria-live="polite">
            {active + 1} / {slides.length}
          </p>
        ) : null}
      </footer>
    </div>
  );

  return createPortal(ui, document.body);
}
