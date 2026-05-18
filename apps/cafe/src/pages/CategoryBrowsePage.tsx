import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CatalogGridProductCard } from "../components/CatalogGridProductCard.js";
import {
  formatCommerceApiError,
  listCatalogCategories,
  listCatalogProducts,
  type CatalogCategoryRow,
  type CatalogProductCard,
} from "../lib/commerceApi.js";
import {
  buildStorefrontApplicationScope,
  filterCategoriesForStorefrontApplication,
  filterDepartmentsForStorefrontApplication,
  filterProductsForStorefrontApplication,
  type StorefrontApplicationScope,
} from "../lib/cafeLookupFilters.js";
import {
  loadApplicationTypeRowsForStorefront,
  loadDepartmentRowsForStorefront,
} from "../lib/storefrontDepartmentBrowse.js";

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
  const [scope, setScope] = useState<StorefrontApplicationScope | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setError(null);
      try {
        const [cats, deptRows, appTypeRows] = await Promise.all([
          listCatalogCategories(),
          loadDepartmentRowsForStorefront(),
          loadApplicationTypeRowsForStorefront(),
        ]);
        if (cancelled) return;
        const scopedDepts = filterDepartmentsForStorefrontApplication(deptRows, appTypeRows);
        const scope = buildStorefrontApplicationScope(appTypeRows, scopedDepts);
        setScope(scope);
        setCategories(filterCategoriesForStorefrontApplication(cats, scope));
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
        if (!cancelled) {
          const items = scope ? filterProductsForStorefrontApplication(page.items, scope) : page.items;
          setProducts(items);
        }
      } catch (e) {
        if (!cancelled) setError(formatCommerceApiError(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [categories, slug, scope]);

  const cat = slug && categories ? categories.find((c) => c.slug === slug) : undefined;
  const categoryTitle = cat?.label?.trim() || displayTitleFromSlug(slug);

  if (!slug) {
    return (
      <div className="browse-page browse-page--fullwidth">
        <p className="browse-page__error">Missing category.</p>
        <Link to="/">Back to home</Link>
      </div>
    );
  }

  if (error) {
    return (
      <div className="browse-page browse-page--fullwidth">
        <p className="browse-page__error" role="alert">
          {error}
        </p>
        <Link to="/">Back to home</Link>
      </div>
    );
  }

  if (categories !== null && !categories.some((c) => c.slug === slug)) {
    return (
      <div className="browse-page browse-page--fullwidth">
        <p className="browse-page__error">Category not found.</p>
        <Link to="/">Back to home</Link>
      </div>
    );
  }

  return (
    <div className="browse-page browse-page--fullwidth">
      <nav className="browse-page__crumb">
        <Link to="/">Home</Link>
        <span aria-hidden="true"> / </span>
        <span>{categoryTitle}</span>
      </nav>
      <header className="browse-page__header">
        <h1 className="browse-page__title">{categoryTitle}</h1>
        <p className="browse-page__lede">Menu items in this category.</p>
      </header>

      {products === null ? (
        <p className="browse-page__loading">Loading products…</p>
      ) : products.length === 0 ? (
        <p className="browse-page__empty">No products in this category yet.</p>
      ) : (
        <ul className="browse-product-grid">
          {products.map((p) => (
            <li key={p.id} className="browse-product-grid__cell">
              <CatalogGridProductCard product={p} skin="storefront" />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
