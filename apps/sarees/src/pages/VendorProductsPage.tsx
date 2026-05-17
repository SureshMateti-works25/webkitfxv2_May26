import { useEffect, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.js";
import { CatalogProductVisual } from "../components/CatalogProductVisual.js";
import { ProductCardPrices } from "../components/ProductCardPrices.js";
import { formatCommerceApiError, listVendorProducts, type VendorProductListItem } from "../lib/commerceApi.js";

const SIGNIN_NOTICES: Record<string, string> = {
  "vendor-submitted":
    "Your vendor account is ready. Add products below — drafts stay private until you mark them active.",
  "member-signed-in": "Signed in successfully.",
};

export function VendorProductsPage() {
  const { auth, getAccessToken } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [notice, setNotice] = useState<string | null>(null);
  const [items, setItems] = useState<VendorProductListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const key = (location.state as { notice?: string } | null)?.notice;
    if (!key) return;
    setNotice(SIGNIN_NOTICES[key] ?? key);
    navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, location.state, navigate]);

  useEffect(() => {
    if (auth.status !== "signedIn" || auth.role !== "vendor") return;
    const token = getAccessToken();
    if (!token) return;
    let cancelled = false;
    (async () => {
      setError(null);
      try {
        const page = await listVendorProducts(token, 1, 48);
        if (!cancelled) setItems(page.items);
      } catch (e) {
        if (!cancelled) setError(formatCommerceApiError(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [auth, getAccessToken]);

  if (auth.status !== "signedIn") {
    return <Navigate to="/login" replace />;
  }
  if (auth.role !== "vendor") {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="vendor-products-page">
      {notice ? (
        <div className="home-signin-notice" role="status" aria-live="polite">
          <p className="home-signin-notice__text">{notice}</p>
          <button
            type="button"
            className="home-signin-notice__dismiss"
            aria-label="Dismiss"
            onClick={() => setNotice(null)}
          >
            ×
          </button>
        </div>
      ) : null}

      <header className="vendor-products-page__header">
        <div>
          <h1 className="vendor-products-page__title">My products</h1>
          <p className="vendor-products-page__lede">
            Draft products are visible only to you. Set status to <strong>Active</strong> to publish to the storefront
            catalogue.
          </p>
        </div>
        <div className="vendor-products-page__header-actions">
          <Link to="/vendor/orders" className="shell-btn shell-btn--secondary">
            Orders
          </Link>
          <Link to="/vendor/products/new" className="shell-btn shell-btn--primary vendor-products-page__add">
            Add new product
          </Link>
        </div>
      </header>

      {error ? (
        <p className="vendor-products-page__error" role="alert">
          {error}
        </p>
      ) : null}

      {items === null && !error ? <p className="vendor-products-page__loading">Loading your catalogue…</p> : null}

      {items && items.length === 0 ? (
        <p className="vendor-products-page__empty">No products yet. Use &ldquo;Add new product&rdquo; to create one.</p>
      ) : null}

      {items && items.length > 0 ? (
        <ul className="vendor-product-grid">
          {items.map((p) => (
            <li key={p.id}>
              <article className="vendor-product-card">
                <Link to={`/vendor/products/${p.id}/storefront`} className="vendor-product-card__media-link">
                  <div className="vendor-product-card__media" aria-hidden="true">
                    <CatalogProductVisual
                      storageKey={p.heroStorageKey}
                      imageIndicators={p.imageIndicators}
                      vendorCode={p.vendorCode}
                      skuCodes={p.skuCodes}
                    />
                  </div>
                </Link>
                <div className="vendor-product-card__body">
                  <h2 className="vendor-product-card__title">
                    <Link to={`/vendor/products/${p.id}/storefront`}>{p.titleDisplay}</Link>
                  </h2>
                  <p className="vendor-product-card__meta">
                    <span className={`vendor-product-card__status vendor-product-card__status--${p.status}`}>
                      {p.status}
                    </span>
                  </p>
                  <ProductCardPrices
                    className="vendor-product-card__prices"
                    minPriceMinor={p.minPriceMinor}
                    currency={p.currency}
                    listPriceMinor={p.listPriceMinor}
                    offerPriceMinor={p.offerPriceMinor}
                    offerType={p.offerType}
                    offerCardText={p.offerCardText}
                  />
                  <p className="vendor-product-card__slug">{p.slug}</p>
                  <p className="vendor-product-card__actions">
                    <Link to={`/vendor/products/${p.id}/storefront`}>Storefront</Link>
                    <span aria-hidden="true"> · </span>
                    <Link to={`/vendor/products/${p.id}`}>Edit</Link>
                  </p>
                </div>
              </article>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
