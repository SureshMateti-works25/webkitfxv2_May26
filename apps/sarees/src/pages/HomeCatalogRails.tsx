import { useEffect, useId, useState } from "react";
import { Link } from "react-router-dom";
import { CatalogProductVisual } from "../components/CatalogProductVisual.js";
import { ProductCardPrices } from "../components/ProductCardPrices.js";
import {
  formatCommerceApiError,
  listCatalogCategories,
  listCatalogProducts,
  type CatalogCategoryRow,
  type CatalogProductCard,
} from "../lib/commerceApi.js";
import { readRecentVisits, RECENT_VISITS_EVENT } from "../lib/recentVisits.js";

const MAX_CATEGORY_RAILS = 8;
const RAIL_PAGE_SIZE = 12;

function displayTitleFromSlug(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/** Root categories (department-level). */
function rootCategories(cats: CatalogCategoryRow[]): CatalogCategoryRow[] {
  return cats
    .filter((c) => c.parentId == null || c.parentId === "")
    .sort((a, b) => a.sortOrder - b.sortOrder || a.slug.localeCompare(b.slug));
}

/**
 * Tiles for "Shop by category" and per-category rails.
 * When there is a single root (e.g. "Sarees"), show real browse categories (children / descendants),
 * not only that one department node.
 */
function categoryShowcaseTiles(cats: CatalogCategoryRow[]): CatalogCategoryRow[] {
  const roots = rootCategories(cats);
  if (roots.length === 0) return [];

  if (roots.length === 1) {
    const descendants = cats
      .filter((c) => c.parentId != null && c.parentId !== "")
      .sort((a, b) => a.sortOrder - b.sortOrder || a.slug.localeCompare(b.slug));
    if (descendants.length > 0) return descendants.slice(0, MAX_CATEGORY_RAILS);
  }

  return roots.slice(0, MAX_CATEGORY_RAILS);
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
  /** Browse tiles (subcategories when a single department root exists, else top-level categories). */
  const [categoryTiles, setCategoryTiles] = useState<CatalogCategoryRow[] | null>(null);
  /** Broad "See all" target: department root slug (e.g. `sarees`), not a leaf category. */
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

        const deptRoots = rootCategories(cats);
        const tiles = categoryShowcaseTiles(cats);
        const broadSlug =
          deptRoots.find((c) => c.slug === "sarees")?.slug ?? deptRoots[0]?.slug ?? null;
        const railPages = await Promise.all(
          tiles.map((c) =>
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
        const rails: CategoryRail[] = tiles.map((c, i) => ({ category: c, items: railPages[i]!.items }));
        setCategoryTiles(tiles);
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

  if (categoryTiles === null || recent === null || trending === null || categoryRails === null) {
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
        {categoryTiles.length > 0 ? (
          <section className="storefront-categories" aria-labelledby={`${baseId}-cat-heading`}>
            <h2 className="storefront-categories__title" id={`${baseId}-cat-heading`}>
              Shop by category
            </h2>
            <ul className="storefront-category-grid">
              {categoryTiles.map((c) => (
                <li key={c.id}>
                  <Link to={`/browse/${encodeURIComponent(c.slug)}`} className="storefront-category-card">
                    <span className="storefront-category-card__name">{displayTitleFromSlug(c.slug)}</span>
                    <span className="storefront-category-card__cta">
                      Browse {displayTitleFromSlug(c.slug)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

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

        {categoryRails.map(({ category, items }) => (
          <ProductRail
            key={category.id}
            titleId={`${baseId}-cat-${category.id}`}
            title={displayTitleFromSlug(category.slug)}
            products={items}
            seeAllHref={`/browse/${encodeURIComponent(category.slug)}`}
            emptyHint={`No listings in ${displayTitleFromSlug(category.slug)} yet.`}
          />
        ))}
      </div>
    </div>
  );
}
