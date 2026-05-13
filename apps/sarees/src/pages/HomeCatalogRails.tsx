import { useEffect, useId, useState } from "react";
import { Link } from "react-router-dom";
import { CatalogProductVisual } from "../components/CatalogProductVisual.js";
import { ProductCardPrices } from "../components/ProductCardPrices.js";
import {
  formatCommerceApiError,
  listCatalogCategories,
  listCatalogProducts,
  mediaAssetUrl,
  type CatalogCategoryRow,
  type CatalogProductCard,
} from "../lib/commerceApi.js";
import { readRecentVisits, RECENT_VISITS_EVENT } from "../lib/recentVisits.js";

const MAX_CATEGORY_RAILS = 24;
const RAIL_PAGE_SIZE = 12;

/** Merchandising tree roots (treated as departments on the landing page). */
function rootCategories(cats: CatalogCategoryRow[]): CatalogCategoryRow[] {
  return cats
    .filter((c) => c.parentId == null || c.parentId === "")
    .sort((a, b) => a.sortOrder - b.sortOrder || a.slug.localeCompare(b.slug));
}

function directChildren(cats: CatalogCategoryRow[], parentId: string): CatalogCategoryRow[] {
  return cats
    .filter((c) => c.parentId === parentId)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.slug.localeCompare(b.slug));
}

type DepartmentBrowseGroup = {
  department: CatalogCategoryRow;
  categories: CatalogCategoryRow[];
};

/** One group per root: list direct child categories, or the root alone if it has no children. */
function departmentBrowseGroups(cats: CatalogCategoryRow[]): DepartmentBrowseGroup[] {
  return rootCategories(cats).map((department) => {
    const children = directChildren(cats, department.id);
    return {
      department,
      categories: children.length > 0 ? children : [department],
    };
  });
}

/**
 * Product rails: one per “aisle” (direct child of a department). If a root has no children, rail for the root.
 */
function categoriesForProductRails(cats: CatalogCategoryRow[]): CatalogCategoryRow[] {
  const roots = rootCategories(cats);
  const out: CatalogCategoryRow[] = [];
  const seen = new Set<string>();
  for (const r of roots) {
    const ch = directChildren(cats, r.id);
    const targets = ch.length > 0 ? ch : [r];
    for (const c of targets) {
      if (seen.has(c.id)) continue;
      seen.add(c.id);
      out.push(c);
      if (out.length >= MAX_CATEGORY_RAILS) return out;
    }
  }
  return out;
}

function StorefrontProductCard({ product }: { product: CatalogProductCard }) {
  return (
    <Link to={`/p/${encodeURIComponent(product.slug)}`} className="storefront-product-card">
      <div className="storefront-product-card__media">
        <CatalogProductVisual
          storageKey={product.heroStorageKey}
          imageIndicators={product.imageIndicators}
          vendorCode={product.vendorCode}
          skuCodes={product.skuCodes}
        />
      </div>
      <div className="storefront-product-card__body">
        <h3 className="storefront-product-card__title">{product.titleDisplay}</h3>
        <ProductCardPrices
          className="storefront-product-card__prices"
          minPriceMinor={product.minPriceMinor}
          currency={product.currency}
          listPriceMinor={product.listPriceMinor}
          offerPriceMinor={product.offerPriceMinor}
          offerType={product.offerType}
          offerCardText={product.offerCardText}
        />
      </div>
    </Link>
  );
}

function ProductRail({
  title,
  subtitle,
  products,
  emptyHint,
  seeAllHref,
  titleId,
}: {
  title: string;
  subtitle?: string;
  products: CatalogProductCard[];
  emptyHint: string;
  seeAllHref?: string;
  titleId: string;
}) {
  return (
    <section className="storefront-rail-section" aria-labelledby={titleId}>
      <div className="storefront-rail-section__head storefront-rail-section__head--row">
        <div className="storefront-rail-section__titles">
          <h2 className="storefront-rail-section__title" id={titleId}>
            {title}
          </h2>
          {subtitle ? <p className="storefront-rail-section__sub">{subtitle}</p> : null}
        </div>
        {seeAllHref && products.length > 0 ? (
          <Link to={seeAllHref} className="storefront-rail-section__see-all">
            See all
          </Link>
        ) : null}
      </div>
      {products.length === 0 ? (
        <p className="storefront-rail-section__empty">{emptyHint}</p>
      ) : (
        <div className="storefront-rail">
          {products.map((p) => (
            <div key={p.id} className="storefront-rail__cell">
              <StorefrontProductCard product={p} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

type CategoryRail = { category: CatalogCategoryRow; items: CatalogProductCard[] };

export function HomeCatalogRails() {
  const baseId = useId().replace(/:/g, "");
  const [departmentGroups, setDepartmentGroups] = useState<DepartmentBrowseGroup[] | null>(null);
  const [seeAllCatalogSlug, setSeeAllCatalogSlug] = useState<string | null>(null);
  const [categoryRails, setCategoryRails] = useState<CategoryRail[] | null>(null);
  const [recent, setRecent] = useState<CatalogProductCard[] | null>(null);
  const [trending, setTrending] = useState<CatalogProductCard[] | null>(null);
  const [visited, setVisited] = useState<CatalogProductCard[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setVisited(readRecentVisits());
    const onVisits = () => setVisited(readRecentVisits());
    window.addEventListener(RECENT_VISITS_EVENT, onVisits);
    return () => window.removeEventListener(RECENT_VISITS_EVENT, onVisits);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setError(null);
      try {
        const [cats, trendingPage, recentPage] = await Promise.all([
          listCatalogCategories(),
          listCatalogProducts({ page: 1, pageSize: RAIL_PAGE_SIZE, sort: "trending" }),
          listCatalogProducts({ page: 1, pageSize: RAIL_PAGE_SIZE, sort: "published_desc" }),
        ]);
        if (cancelled) return;

        const groups = departmentBrowseGroups(cats);
        const deptRoots = rootCategories(cats);
        const broadSlug =
          deptRoots.find((c) => c.slug === "sarees")?.slug ?? deptRoots[0]?.slug ?? null;
        const railCategories = categoriesForProductRails(cats);
        const railPages = await Promise.all(
          railCategories.map((c) =>
            listCatalogProducts({
              categoryId: c.id,
              includeSubtree: true,
              page: 1,
              pageSize: RAIL_PAGE_SIZE,
              sort: "published_desc",
            })
          )
        );
        if (cancelled) return;
        const rails: CategoryRail[] = railCategories.map((c, i) => ({ category: c, items: railPages[i]!.items }));
        setDepartmentGroups(groups);
        setSeeAllCatalogSlug(broadSlug);
        setTrending(trendingPage.items);
        setRecent(recentPage.items);
        setCategoryRails(rails);
      } catch (e) {
        if (!cancelled) setError(formatCommerceApiError(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <div className="storefront-wrap">
        <div className="storefront-inner">
          <p className="storefront-error" role="alert">
            {error}
          </p>
        </div>
      </div>
    );
  }

  if (departmentGroups === null || recent === null || trending === null || categoryRails === null) {
    return (
      <div className="storefront-wrap">
        <div className="storefront-inner">
          <p className="storefront-loading">Loading catalogue…</p>
        </div>
      </div>
    );
  }

  const browseAllHref = seeAllCatalogSlug
    ? `/browse/${encodeURIComponent(seeAllCatalogSlug)}`
    : undefined;

  return (
    <div className="storefront-wrap">
      <div className="storefront-inner">
        {departmentGroups.length > 0 ? (
          <section
            className="storefront-landing-by-dept"
            aria-labelledby={`${baseId}-dept-heading`}
          >
            <h2 className="storefront-landing-by-dept__page-title" id={`${baseId}-dept-heading`}>
              Shop by department
            </h2>
            {departmentGroups.map(({ department, categories }) => (
              <div key={department.id} className="storefront-landing-dept">
                <h3 className="storefront-landing-dept__title">{department.label}</h3>
                <ul className="storefront-landing-dept__categories">
                  {categories.map((c) => (
                    <li key={c.id} className="storefront-landing-dept__cat-item">
                      <Link
                        to={`/browse/${encodeURIComponent(c.slug)}`}
                        className="storefront-landing-dept__cat-link"
                      >
                        <span className="storefront-landing-dept__cat-visual" aria-hidden="true">
                          {c.imageStorageKey ? (
                            <img
                              src={mediaAssetUrl(c.imageStorageKey)}
                              alt=""
                              className="storefront-landing-dept__cat-img"
                              loading="lazy"
                              decoding="async"
                            />
                          ) : (
                            <span className="storefront-landing-dept__cat-placeholder">
                              {c.label.trim().charAt(0).toUpperCase()}
                            </span>
                          )}
                        </span>
                        <span className="storefront-landing-dept__cat-label">{c.label}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </section>
        ) : null}

        {categoryRails.map(({ category, items }) => (
          <ProductRail
            key={category.id}
            titleId={`${baseId}-cat-${category.id}`}
            title={category.label}
            products={items}
            seeAllHref={`/browse/${encodeURIComponent(category.slug)}`}
            emptyHint={`No listings in ${category.label} yet.`}
          />
        ))}

        <ProductRail
          titleId={`${baseId}-trending`}
          title="Trending sarees"
          subtitle="Popular picks by price and freshness on this storefront."
          products={trending}
          seeAllHref={browseAllHref}
          emptyHint="No trending picks yet."
        />

        <ProductRail
          titleId={`${baseId}-recent`}
          title="Recently added"
          products={recent}
          seeAllHref={browseAllHref}
          emptyHint="No products yet. Check back soon."
        />

        <ProductRail
          titleId={`${baseId}-visited`}
          title="Recently visited"
          products={visited}
          emptyHint="Open a product page to build your history here."
        />
      </div>
    </div>
  );
}
