import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CatalogProductVisual } from "../components/CatalogProductVisual.js";
import { ProductCardPrices } from "../components/ProductCardPrices.js";
import {
  formatCommerceApiError,
  listCatalogCategories,
  listCatalogProducts,
  type CatalogCategoryRow,
  type CatalogProductCard,
} from "../lib/commerceApi.js";

function displayTitleFromSlug(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

export function CategoryBrowsePage() {
  const { categorySlug } = useParams<{ categorySlug: string }>();
  const slug = categorySlug ? decodeURIComponent(categorySlug) : "";

  const [categories, setCategories] = useState<CatalogCategoryRow[] | null>(null);
  const [products, setProducts] = useState<CatalogProductCard[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setError(null);
      try {
        const cats = await listCatalogCategories();
        if (cancelled) return;
        setCategories(cats);
      } catch (e) {
        if (!cancelled) setError(formatCommerceApiError(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (categories === null) {
      setProducts(null);
      return;
    }
    const cat = slug ? categories.find((c) => c.slug === slug) : null;
    if (!cat) {
      setProducts([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const page = await listCatalogProducts({
          categoryId: cat.id,
          includeSubtree: true,
          page: 1,
          pageSize: 48,
          sort: "published_desc",
        });
        if (!cancelled) setProducts(page.items);
      } catch (e) {
        if (!cancelled) setError(formatCommerceApiError(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [categories, slug]);

  if (!slug) {
    return (
      <div className="browse-page">
        <p className="browse-page__error">Missing category.</p>
        <Link to="/">Back to home</Link>
      </div>
    );
  }

  if (error) {
    return (
      <div className="browse-page">
        <p className="browse-page__error" role="alert">
          {error}
        </p>
        <Link to="/">Back to home</Link>
      </div>
    );
  }

  if (categories !== null && !categories.some((c) => c.slug === slug)) {
    return (
      <div className="browse-page">
        <p className="browse-page__error">Category not found.</p>
        <Link to="/">Back to home</Link>
      </div>
    );
  }

  return (
    <div className="browse-page">
      <nav className="browse-page__crumb">
        <Link to="/">Home</Link>
        <span aria-hidden="true"> / </span>
        <span>{displayTitleFromSlug(slug)}</span>
      </nav>
      <header className="browse-page__header">
        <h1 className="browse-page__title">{displayTitleFromSlug(slug)}</h1>
        <p className="browse-page__lede">Sarees in this category and subcategories.</p>
      </header>

      {products === null ? (
        <p className="browse-page__loading">Loading products…</p>
      ) : products.length === 0 ? (
        <p className="browse-page__empty">No products in this category yet.</p>
      ) : (
        <ul className="browse-product-grid">
          {products.map((p) => {
            return (
              <li key={p.id}>
                <Link to={`/p/${encodeURIComponent(p.slug)}`} className="browse-product-card">
                  <div className="browse-product-card__media">
                    <CatalogProductVisual storageKey={p.heroStorageKey} imageIndicators={p.imageIndicators} />
                  </div>
                  <div className="browse-product-card__body">
                    <h2 className="browse-product-card__title">{p.titleDisplay}</h2>
                    <ProductCardPrices
                      className="browse-product-card__prices"
                      minPriceMinor={p.minPriceMinor}
                      currency={p.currency}
                      listPriceMinor={p.listPriceMinor}
                      offerPriceMinor={p.offerPriceMinor}
                      offerType={p.offerType}
                      offerCardText={p.offerCardText}
                    />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
