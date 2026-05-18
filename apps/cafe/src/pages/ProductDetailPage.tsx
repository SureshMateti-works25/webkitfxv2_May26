import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.js";
import { AddToCartButton } from "../components/AddToCartButton.js";
import { ProductStorefrontGallery, type ProductStorefrontWhatsappProps } from "../components/ProductStorefrontGallery.js";
import { ProductImageFullView } from "../components/ProductImageFullView.js";
import { ProductCardPrices } from "../components/ProductCardPrices.js";
import { ProductEngagementPanel } from "../components/ProductEngagementPanel.js";
import { getCatalogScreen } from "../config/getScreenConfig.js";
import { getShell } from "../config/getShell.js";
import {
  getProductEngagement,
  trackProductView,
  formatCommerceApiError,
  resolveCatalogProductDetail,
  type CatalogProductDetail,
  type ProductEngagement,
} from "../lib/commerceApi.js";
import { recordProductVisit } from "../lib/recentVisits.js";
import { buildQrMenuPath } from "../lib/qrOrderUrls.js";
import { useQrOrderSession } from "../lib/qrOrderSession.js";
import { canUseStorefrontCart } from "../lib/storefrontCartAccess.js";

type ScreenConfig = {
  version?: string;
  copy: {
    screenTitle?: string;
    screenDescription?: string;
    backLink: string;
    backPrevious?: string;
    loading: string;
    notFound: string;
    trustNote: string;
  };
  sections: string[];
};

const screen = getCatalogScreen("productDetail") as ScreenConfig;

function safeDecodePathParam(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

function categorySlugToLabel(slug: string | null | undefined): string | null {
  if (!slug?.trim()) return null;
  return slug
    .split(/[-_/]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function formatMinor(minor: number | null, currency: string | null): string {
  if (minor == null) return "—";
  const unit = (currency ?? "INR").toUpperCase();
  const major = minor / 100;
  return `${unit} ${major.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function offerTypeLabel(offerType: string | null | undefined): string | null {
  if (!offerType || offerType === "none") return null;
  const t = offerType.toLowerCase();
  if (t === "flat") return "Flat off";
  if (t === "percent") return "% off";
  if (t === "bogo") return "Buy 2 get 1";
  return offerType;
}

export function ProductDetailPage() {
  const { productSlug, productKey } = useParams<{ productSlug?: string; productKey?: string }>();
  const navigate = useNavigate();
  const qrSession = useQrOrderSession();
  const menuHomeTo = qrSession ? buildQrMenuPath(qrSession.tableCode) : "/";
  const { auth } = useAuth();
  const shell = getShell();
  const rawKey = productSlug ?? productKey ?? "";
  const key = rawKey ? safeDecodePathParam(rawKey) : "";

  const [product, setProduct] = useState<CatalogProductDetail | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [engagement, setEngagement] = useState<ProductEngagement | null>(null);
  const [engagementLoading, setEngagementLoading] = useState(false);
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
    if (product.heroStorageKey?.trim())
      return [{ storageKey: product.heroStorageKey.trim() }];
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

  useEffect(() => {
    if (!key) {
      setProduct(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setError(null);
      try {
        const detail = await resolveCatalogProductDetail(key);
        if (cancelled) return;
        setProduct(detail);
      } catch (e) {
        if (!cancelled) setError(formatCommerceApiError(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [key]);

  useEffect(() => {
    if (product && product.id) {
      recordProductVisit(product);
    }
  }, [product]);

  const refreshEngagement = useCallback(async () => {
    if (!product?.id) return;
    setEngagementLoading(true);
    try {
      const e = await getProductEngagement(product.id);
      setEngagement(e);
    } catch (e) {
      setError(formatCommerceApiError(e));
    } finally {
      setEngagementLoading(false);
    }
  }, [product?.id]);

  useEffect(() => {
    if (!product?.id) return;
    let cancelled = false;
    (async () => {
      try {
        await trackProductView(product.id);
      } catch {
        /* non-blocking */
      }
      if (cancelled) return;
      await refreshEngagement();
    })();
    return () => {
      cancelled = true;
    };
  }, [product?.id, refreshEngagement]);

  const showConsumerCart = canUseStorefrontCart(auth);

  const productUrl = useMemo(() => {
    if (!product?.slug) return "";
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/p/${encodeURIComponent(product.slug)}`;
  }, [product]);

  const waShell = shell.storefront?.whatsapp;
  const whatsappProps = useMemo((): ProductStorefrontWhatsappProps | null => {
    if (!waShell || product === undefined || product === null) return null;
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
      productUrl: productUrl || (origin ? `${origin}/` : ""),
      vendorCode: product.vendorCode,
      skuLine,
    };
  }, [product, productUrl, skuFocus.skuCode, skuFocus.skuId, waShell]);

  if (!key) {
    return (
      <div className="pdp-page">
        <p>Invalid product link.</p>
        <Link to="/">Home</Link>
      </div>
    );
  }

  if (error) {
    return (
      <div className="pdp-page">
        <p className="pdp-page__error" role="alert">
          {error}
        </p>
        <Link to="/">Home</Link>
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
        <Link to="/">Home</Link>
      </div>
    );
  }

  const showGallery = screen.sections.includes("gallery");
  const categoryLabel = categorySlugToLabel(product.primaryCategorySlug);
  const vendorName = product.vendorDisplayName?.trim() || null;
  const offerLabel = offerTypeLabel(product.offerType);
  const offerValueLabel = (product.offerCardText ?? "").trim() || offerLabel;
  const salePrice =
    product.offerType &&
    product.offerType.toLowerCase() !== "none" &&
    product.offerPriceMinor != null &&
    Number.isFinite(product.offerPriceMinor)
      ? product.offerPriceMinor
      : product.minPriceMinor;
  const mrpPrice =
    product.listPriceMinor != null &&
    salePrice != null &&
    Number.isFinite(product.listPriceMinor) &&
    product.listPriceMinor > salePrice
      ? product.listPriceMinor
      : null;

  return (
    <article className="pdp-page pdp-page--storefront">
      <header className="pdp-screen-header" aria-label="Product detail header">
        <div className="pdp-screen-header__copy">
          <h2 className="pdp-screen-header__title">{product.titleDisplay || (screen.copy.screenTitle ?? "Product details")}</h2>
          <p className="pdp-screen-header__desc pdp-screen-header__pricing">
            {offerValueLabel ? <span className="pdp-screen-header__offer">{offerValueLabel}</span> : null}
            <span className="pdp-screen-header__sale">{formatMinor(salePrice, product.currency)}</span>
            {mrpPrice != null ? (
              <span className="pdp-screen-header__mrp">
                <s>{formatMinor(mrpPrice, product.currency)}</s>
              </span>
            ) : null}
          </p>
        </div>
        <div className="pdp-screen-header__actions">
          <button
            type="button"
            className="pdp-screen-header__action"
            onClick={() => navigate(-1)}
            aria-label={screen.copy.backPrevious ?? "Back to previous"}
            title={screen.copy.backPrevious ?? "Back to previous"}
          >
            ←
          </button>
          <Link
            to={menuHomeTo}
            className="pdp-screen-header__action pdp-screen-header__action--home"
            aria-label={qrSession ? "Back to table menu" : screen.copy.backLink}
            title={qrSession ? "Back to table menu" : screen.copy.backLink}
          >
            ⌂
          </Link>
        </div>
      </header>
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
          {screen.sections.includes("title") ? (
            <h1 className="pdp-page__title pdp-page__title--hero">{product.titleDisplay}</h1>
          ) : null}
          {vendorName ? <p className="pdp-page__vendor-name">{vendorName}</p> : null}
          {screen.sections.includes("prices") || (screen.sections.includes("addToCart") && showConsumerCart) ? (
            <div className="pdp-page__prices-cart-block">
              <div className="pdp-page__prices-cart-row">
                {screen.sections.includes("prices") ? (
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
                {screen.sections.includes("addToCart") && showConsumerCart ? (
                  <AddToCartButton product={product} skuFocus={skuFocus} />
                ) : null}
              </div>
            </div>
          ) : null}
          {screen.sections.includes("meta") ? (
            <>
              <dl className="pdp-page__meta-block" id="pdp-about">
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
                  <span className="pdp-page__gallery-note-label">Gallery</span> — pick a colour to see pallu, drape,
                  and full views for that shade (each colour is a SKU with its own images).
                </p>
              ) : product.colorImages.length > 0 ? (
                <p className="pdp-page__gallery-note">
                  <span className="pdp-page__gallery-note-label">Gallery</span> — colour options below the main photo.
                </p>
              ) : null}
              <p className="pdp-page__slug">Slug: {product.slug}</p>
              <p className="pdp-page__note">{screen.copy.trustNote}</p>
              <ProductEngagementPanel
                productId={product.id}
                engagement={engagement}
                loading={engagementLoading}
                onRefresh={refreshEngagement}
              />
            </>
          ) : null}
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
