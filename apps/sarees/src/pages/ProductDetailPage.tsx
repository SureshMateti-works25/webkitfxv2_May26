import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ProductGalleryStage } from "../components/ProductGalleryStage.js";
import { ProductCardPrices } from "../components/ProductCardPrices.js";
import productDetailScreen from "../config/screens/product-detail.json";
import {
  formatCommerceApiError,
  getCatalogProductDetail,
  type CatalogProductDetail,
} from "../lib/commerceApi.js";
import { recordProductVisit } from "../lib/recentVisits.js";

type ScreenConfig = {
  version?: string;
  copy: {
    backLink: string;
    loading: string;
    notFound: string;
    trustNote: string;
  };
  sections: string[];
};

const screen = productDetailScreen as ScreenConfig;

export function ProductDetailPage() {
  const { productSlug, productKey } = useParams<{ productSlug?: string; productKey?: string }>();
  const rawKey = productSlug ?? productKey ?? "";
  const key = rawKey ? decodeURIComponent(rawKey) : "";

  const [product, setProduct] = useState<CatalogProductDetail | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!key) {
      setProduct(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setError(null);
      try {
        let detail = await getCatalogProductDetail({ slug: key });
        if (!detail) detail = await getCatalogProductDetail({ id: key });
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

  return (
    <article className="pdp-page">
      <Link to="/" className="pdp-page__back">
        ← {screen.copy.backLink}
      </Link>
      <div className="pdp-page__layout">
        {showGallery ? (
          <div className="pdp-page__visual">
            <ProductGalleryStage
              heroStorageKey={product.heroStorageKey}
              gallery={product.gallery}
              imageIndicators={product.imageIndicators}
              title={product.titleDisplay}
            />
          </div>
        ) : null}
        <div className="pdp-page__copy">
          {screen.sections.includes("title") ? (
            <h1 className="pdp-page__title">{product.titleDisplay}</h1>
          ) : null}
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
          {screen.sections.includes("meta") ? (
            <>
              <p className="pdp-page__slug">Slug: {product.slug}</p>
              <p className="pdp-page__note">{screen.copy.trustNote}</p>
            </>
          ) : null}
        </div>
      </div>
    </article>
  );
}
