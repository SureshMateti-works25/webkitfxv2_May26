import { useEffect, useId, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CatalogGridProductCard } from "../components/CatalogGridProductCard.js";
import {
  formatCommerceApiError,
  getCommerceLookupBundle,
  listCatalogCategories,
  listCatalogProducts,
  mediaAssetUrl,
  type CatalogCategoryRow,
  type CatalogProductCard,
} from "../lib/commerceApi.js";
import {
  readRecentVisits,
  reconcileRecentVisitsWithCatalog,
  RECENT_VISITS_EVENT,
} from "../lib/recentVisits.js";
import { getScreenConfig } from "../config/getScreenConfig.js";
import {
  buildStorefrontApplicationScope,
  filterCategoriesForStorefrontApplication,
  filterProductsForStorefrontApplication,
} from "../lib/cafeLookupFilters.js";
import {
  categoriesForProductRailsByDepartmentParent,
  categoriesForProductRailsMerchandising,
  loadApplicationTypeRowsForStorefront,
  loadDepartmentRowsForStorefront,
  resolveStorefrontDepartmentGroups,
} from "../lib/storefrontDepartmentBrowse.js";

const MAX_CATEGORY_RAILS = 24;
const RAIL_PAGE_SIZE = 12;

function CategoryTile({ category }: { category: CatalogCategoryRow }) {
  const initial = category.label.trim().charAt(0).toUpperCase() || "?";
  return (
    <Link
      to={`/browse/${encodeURIComponent(category.slug)}`}
      className="storefront-category-card storefront-category-card--cafe-tile"
      aria-label={category.label}
    >
      <span className="storefront-category-card__visual">
        {category.imageStorageKey ? (
          <img
            src={mediaAssetUrl(category.imageStorageKey)}
            alt=""
            className="storefront-category-card__img"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <span className="storefront-category-card__placeholder" aria-hidden="true">
            {initial}
          </span>
        )}
      </span>
      <span className="storefront-category-card__name">{category.label}</span>
    </Link>
  );
}

function CategoryBrowseBox({
  categories,
  title,
  titleId,
}: {
  categories: CatalogCategoryRow[];
  title: string;
  titleId: string;
}) {
  if (categories.length === 0) return null;
  return (
    <section
      className="storefront-rail-section storefront-rail-section--category-browse"
      aria-labelledby={titleId}
    >
      <div className="storefront-rail-section__head">
        <div className="storefront-rail-section__titles">
          <h2 className="storefront-rail-section__title" id={titleId}>
            {title}
          </h2>
        </div>
      </div>
      <ul className="storefront-category-grid storefront-category-grid--cafe-box">
        {categories.map((category) => (
          <li key={category.id}>
            <CategoryTile category={category} />
          </li>
        ))}
      </ul>
    </section>
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
              <CatalogGridProductCard product={p} compactAddLabel skin="storefront" />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

type CategoryRail = { category: CatalogCategoryRow; items: CatalogProductCard[] };

function flattenBrowseCategories(groups: { categories: CatalogCategoryRow[] }[]): CatalogCategoryRow[] {
  const seen = new Set<string>();
  const out: CatalogCategoryRow[] = [];
  for (const g of groups) {
    for (const c of g.categories) {
      if (seen.has(c.id)) continue;
      seen.add(c.id);
      out.push(c);
    }
  }
  return out;
}

export function HomeCatalogRails() {
  const homeCopy = getScreenConfig("home");
  const baseId = useId().replace(/:/g, "");
  const [browseCategories, setBrowseCategories] = useState<CatalogCategoryRow[] | null>(null);
  const [seeAllCatalogSlug, setSeeAllCatalogSlug] = useState<string | null>(null);
  const [categoryRails, setCategoryRails] = useState<CategoryRail[] | null>(null);
  const [recent, setRecent] = useState<CatalogProductCard[] | null>(null);
  const [trending, setTrending] = useState<CatalogProductCard[] | null>(null);
  const [visited, setVisited] = useState<CatalogProductCard[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setVisited(readRecentVisits());
    void reconcileRecentVisitsWithCatalog().then((items) => {
      if (!cancelled) setVisited(items);
    });
    const onVisits = () => setVisited(readRecentVisits());
    window.addEventListener(RECENT_VISITS_EVENT, onVisits);
    return () => {
      cancelled = true;
      window.removeEventListener(RECENT_VISITS_EVENT, onVisits);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setError(null);
      try {
        const [cats, trendingPage, recentPage, deptRows, bundle, appTypeRows] = await Promise.all([
          listCatalogCategories(),
          listCatalogProducts({ page: 1, pageSize: RAIL_PAGE_SIZE, sort: "trending" }),
          listCatalogProducts({ page: 1, pageSize: RAIL_PAGE_SIZE, sort: "published_desc" }),
          loadDepartmentRowsForStorefront(),
          getCommerceLookupBundle(),
          loadApplicationTypeRowsForStorefront(),
        ]);
        if (cancelled) return;

        const scope = buildStorefrontApplicationScope(appTypeRows, deptRows);
        const scopedCats = filterCategoriesForStorefrontApplication(cats, scope);
        const { groups, groupedByDepartment, departmentRows } = resolveStorefrontDepartmentGroups(
          scopedCats,
          bundle,
          deptRows,
          appTypeRows
        );
        const broadSlug = groups.find((g) => g.categories.length > 0)?.categories[0]?.slug ?? null;
        const railCategories = groupedByDepartment
          ? categoriesForProductRailsByDepartmentParent(scopedCats, departmentRows, MAX_CATEGORY_RAILS)
          : categoriesForProductRailsMerchandising(scopedCats, MAX_CATEGORY_RAILS);
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

        const rails: CategoryRail[] = railCategories
          .map((c, i) => ({
            category: c,
            items: filterProductsForStorefrontApplication(railPages[i]!.items, scope),
          }))
          .filter((rail) => rail.items.length > 0);

        setBrowseCategories(flattenBrowseCategories(groups));
        setSeeAllCatalogSlug(broadSlug);
        setCategoryRails(rails);
        setTrending(filterProductsForStorefrontApplication(trendingPage.items, scope));
        setRecent(filterProductsForStorefrontApplication(recentPage.items, scope));
      } catch (e) {
        if (!cancelled) {
          setError(formatCommerceApiError(e));
          setBrowseCategories([]);
          setCategoryRails([]);
          setTrending([]);
          setRecent([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const categoryTiles = useMemo(() => {
    if (!browseCategories) return [];
    const fromRails = categoryRails?.map((r) => r.category.id) ?? [];
    const railOrder = new Map(fromRails.map((id, i) => [id, i]));
    return [...browseCategories].sort((a, b) => {
      const ai = railOrder.get(a.id) ?? 9999;
      const bi = railOrder.get(b.id) ?? 9999;
      if (ai !== bi) return ai - bi;
      return a.sortOrder - b.sortOrder || a.slug.localeCompare(b.slug);
    });
  }, [browseCategories, categoryRails]);

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

  if (browseCategories === null || recent === null || trending === null || categoryRails === null) {
    return (
      <div className="storefront-wrap">
        <div className="storefront-inner">
          <p className="storefront-loading">Loading menu…</p>
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
        <CategoryBrowseBox
          titleId={`${baseId}-categories`}
          title={String(homeCopy.categoriesRailTitle ?? "Browse by category")}
          categories={categoryTiles}
        />

        {categoryRails.map(({ category, items }) => (
          <ProductRail
            key={category.id}
            titleId={`${baseId}-cat-${category.id}`}
            title={category.label}
            products={items}
            seeAllHref={`/browse/${encodeURIComponent(category.slug)}`}
            emptyHint={`No items in ${category.label} yet.`}
          />
        ))}

        <ProductRail
          titleId={`${baseId}-trending`}
          title={String(homeCopy.featuredTitle ?? "Chef's picks")}
          subtitle="Popular items right now."
          products={trending}
          seeAllHref={browseAllHref}
          emptyHint="No featured items yet."
        />

        <ProductRail
          titleId={`${baseId}-recent`}
          title="New on the menu"
          products={recent}
          seeAllHref={browseAllHref}
          emptyHint="No new items yet."
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
