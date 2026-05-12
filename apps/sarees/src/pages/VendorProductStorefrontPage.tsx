import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.js";
import { ProductStorefrontGallery, type ProductStorefrontWhatsappProps } from "../components/ProductStorefrontGallery.js";
import { ProductImageFullView } from "../components/ProductImageFullView.js";
import { ProductCardPrices } from "../components/ProductCardPrices.js";
import productDetailScreen from "../config/screens/product-detail.json";
import { getShell } from "../config/getShell.js";
import {
  formatCommerceApiError,
  getVendorProductStorefrontDetail,
  type CatalogProductDetail,
} from "../lib/commerceApi.js";

type ScreenConfig = {
  copy: { backLink: string; loading: string; notFound: string; trustNote: string };
  sections: string[];
};

const screen = productDetailScreen as ScreenConfig;

/** Vendor preview uses the same screen JSON as PDP but omits shopper cart. */
const vendorScreenSections = screen.sections.filter((s) => s !== "addToCart");

function categorySlugToLabel(slug: string | null | undefined): string | null {
  if (!slug?.trim()) return null;
  return slug
    .split(/[-_/]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

export function VendorProductStorefrontPage() {
  const { auth, getAccessToken } = useAuth();
  const shell = getShell();
  const { productId } = useParams<{ productId: string }>();
  const id = productId?.trim() ?? "";

  const [product, setProduct] = useState<CatalogProductDetail | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [fullViewOpen, setFullViewOpen] = useState(false);
  const [fullViewIndex, setFullViewIndex] = useState(0);
  const [fullViewSlidesOverride, setFullViewSlidesOverride] = useState<readonly { storageKey: string }[] | null>(null);
  const [skuFocus, setSkuFocus] = useState<{ skuId: string | null; skuCode: string | null }>({
    skuId: null,
    skuCode: null,
  });

  const closeFullView = useCallback(() => {
    setFullViewOpen(false);
    setFullViewSlidesOverride(null);
  }, []);

  const defaultFullViewSlides = useMemo(() => {
    if (!product) return [];
    if (product.gallery.length > 0)
      return product.gallery.map((g) => ({ storageKey: g.storageKey })).filter((s) => s.storageKey.length > 0);
    if (product.heroStorageKey?.trim()) return [{ storageKey: product.heroStorageKey.trim() }];
    return [];
  }, [product]);

  const fullViewSlides = fullViewSlidesOverride ?? defaultFullViewSlides;

  useEffect(() => {
    setFullViewSlidesOverride(null);
  }, [product?.id]);

  useEffect(() => {
    if (!product) return;
    const f = product.skuGalleryFacets[0];
    if (f) {
      setSkuFocus({ skuId: f.skuId, skuCode: (f.skuCode ?? "").trim() || null });
      return;
    }
    const c = product.skuCodes[0]?.trim();
    setSkuFocus({ skuId: null, skuCode: c || null });
  }, [product?.id, product]);

  const publicProductUrl = useMemo(() => {
    if (!product?.slug) return "";
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/p/${encodeURIComponent(product.slug)}`;
  }, [product]);

  const waShell = shell.storefront?.whatsapp;
  const whatsappProps = useMemo((): ProductStorefrontWhatsappProps | null => {
    if (!waShell || !product) return null;
    const skuLine =
      (skuFocus.skuCode ?? "").trim() ||
      (product.skuCodes.length ? product.skuCodes.join(" · ") : "") ||
      (skuFocus.skuId ? skuFocus.skuId.slice(0, 14) : "");
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return {
      enabled: waShell.enabled,
      phoneDigits: waShell.phoneDigits,
      messageTemplate: waShell.messageTemplate,
      productTitle: product.titleDisplay,
      productUrl: publicProductUrl || (origin ? `${origin}/` : ""),
      vendorCode: product.vendorCode,
      skuLine,
    };
  }, [product, publicProductUrl, skuFocus.skuCode, skuFocus.skuId, waShell]);

  useEffect(() => {
    if (auth.status !== "signedIn" || auth.role !== "vendor") return;
    if (!id) {
      setProduct(null);
      return;
    }
    const token = getAccessToken();
    if (!token) return;
    let cancelled = false;
    (async () => {
      setError(null);
      try {
        const detail = await getVendorProductStorefrontDetail(token, id);
        if (cancelled) return;
        setProduct(detail);
      } catch (e) {
        if (!cancelled) setError(formatCommerceApiError(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [auth, getAccessToken, id]);

  if (auth.status !== "signedIn") {
    return <Navigate to="/login" replace />;
  }
  if (auth.role !== "vendor") {
    return <Navigate to="/" replace />;
  }

  if (!id) {
    return (
      <div className="pdp-page">
        <p>Invalid product.</p>
        <Link to="/vendor/products">My products</Link>
      </div>
    );
  }

  if (error) {
    return (
      <div className="pdp-page">
        <p className="pdp-page__error" role="alert">
          {error}
        </p>
        <Link to="/vendor/products">My products</Link>
      </div>
    );
  }

  if (product === undefined) {
    return (
      <div className="pdp-page">
        <p className="pdp-page__loading">{screen.copy.loading}</p>
      </div>
    );
  }

  if (product === null) {
    return (
      <div className="pdp-page">
        <p className="pdp-page__error">{screen.copy.notFound}</p>
        <Link to="/vendor/products">My products</Link>
      </div>
    );
  }

  const showGallery = vendorScreenSections.includes("gallery");
  const categoryLabel = categorySlugToLabel(product.primaryCategorySlug);
  const vendorName = product.vendorDisplayName?.trim() || null;

  return (
    <article className="pdp-page pdp-page--storefront">
      <div className="pdp-page__toolbar">
        <Link to="/vendor/products" className="pdp-page__back">
          ← My products
        </Link>
        <Link to={`/vendor/products/${encodeURIComponent(id)}`} className="pdp-page__edit-link">
          Edit product
        </Link>
      </div>
      <div className="pdp-page__layout pdp-page__layout--storefront">
        {showGallery ? (
          <div className="pdp-page__visual">
            <ProductStorefrontGallery
              product={product}
              imageIndicators={product.imageIndicators}
              title={product.titleDisplay}
              onSkuSelectionChange={setSkuFocus}
              whatsapp={whatsappProps}
              onRequestFullView={(i, slides) => {
                if (slides && slides.length > 0) setFullViewSlidesOverride(slides);
                else setFullViewSlidesOverride(null);
                setFullViewIndex(i);
                setFullViewOpen(true);
              }}
            />
          </div>
        ) : null}
        <div className="pdp-page__copy pdp-page__copy--storefront">
          {vendorScreenSections.includes("title") ? (
            <h1 className="pdp-page__title pdp-page__title--hero">{product.titleDisplay}</h1>
          ) : null}
          {vendorName ? <p className="pdp-page__vendor-name">{vendorName}</p> : null}
          {vendorScreenSections.includes("prices") ? (
            <ProductCardPrices
              variant="detail"
              className="pdp-page__prices"
              minPriceMinor={product.minPriceMinor}
              currency={product.currency}
              listPriceMinor={product.listPriceMinor}
              offerPriceMinor={product.offerPriceMinor}
              offerType={product.offerType}
              offerCardText={product.offerCardText}
            />
          ) : null}
          <dl className="pdp-page__meta-block">
            {product.vendorCode?.trim() ? (
              <div className="pdp-page__meta-row">
                <dt>Vendor code</dt>
                <dd>{product.vendorCode.trim()}</dd>
              </div>
            ) : null}
            {product.skuCodes.length > 0 ? (
              <div className="pdp-page__meta-row">
                <dt>SKU</dt>
                <dd>{product.skuCodes.join(" · ")}</dd>
              </div>
            ) : null}
            {categoryLabel ? (
              <div className="pdp-page__meta-row">
                <dt>Category</dt>
                <dd>{categoryLabel}</dd>
              </div>
            ) : null}
          </dl>
          {product.skuGalleryFacets.length > 0 &&
          product.gallery.some((g) => (g.skuId ?? "").trim().length > 0) ? (
            <p className="pdp-page__gallery-note">
              <span className="pdp-page__gallery-note-label">Gallery</span> — pick a colour to see that SKU’s angle
              photos (pallu, drape, full).
            </p>
          ) : product.colorImages.length > 0 ? (
            <p className="pdp-page__gallery-note">
              <span className="pdp-page__gallery-note-label">Gallery</span> — colour options below the main photo.
            </p>
          ) : null}
          <p className="pdp-page__note">{screen.copy.trustNote}</p>
        </div>
      </div>
      <ProductImageFullView
        open={fullViewOpen && fullViewSlides.length > 0}
        onClose={closeFullView}
        slides={fullViewSlides}
        startIndex={fullViewIndex}
        title={product.titleDisplay}
        minPriceMinor={product.minPriceMinor}
        currency={product.currency}
        listPriceMinor={product.listPriceMinor}
        offerPriceMinor={product.offerPriceMinor}
        offerType={product.offerType}
        offerCardText={product.offerCardText}
        vendorCode={product.vendorCode}
        skuCodes={product.skuCodes}
        whatsapp={whatsappProps}
      />
    </article>
  );
}
