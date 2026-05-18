import { useEffect, useId, useState } from "react";
import { Link } from "react-router-dom";
import { CatalogGridProductCard } from "../components/CatalogGridProductCard.js";
import {
  formatCommerceApiError,
  getCommerceLookupBundle,
  listCatalogCategories,
  listCatalogProducts,
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
  loadApplicationTypeRowsForStorefront,
  loadDepartmentRowsForStorefront,
  resolveStorefrontDepartmentGroups,
  type DepartmentBrowseGroup,
} from "../lib/storefrontDepartmentBrowse.js";

const MENU_PRODUCTS_PAGE_SIZE = 24;
const RAIL_PAGE_SIZE = 12;

type CategoryMenuRow = {
  category: CatalogCategoryRow;
  products: CatalogProductCard[];
};

type DepartmentMenuSection = {
  department: DepartmentBrowseGroup["department"];
  categories: CategoryMenuRow[];
};

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

async function loadDepartmentMenuSections(
  groups: DepartmentBrowseGroup[],
  scope: ReturnType<typeof buildStorefrontApplicationScope>
): Promise<DepartmentMenuSection[]> {
  const categoryById = new Map<string, CatalogCategoryRow>();
  for (const g of groups) {
    for (const c of g.categories) categoryById.set(c.id, c);
  }
  const uniqueCategories = [...categoryById.values()];
  const pages = await Promise.all(
    uniqueCategories.map((c) =>
      listCatalogProducts({
        categoryId: c.id,
        includeSubtree: true,
        page: 1,
        pageSize: MENU_PRODUCTS_PAGE_SIZE,
        sort: "published_desc",
      })
    )
  );
  const productsByCategoryId = new Map<string, CatalogProductCard[]>();
  uniqueCategories.forEach((c, i) => {
    productsByCategoryId.set(
      c.id,
      filterProductsForStorefrontApplication(pages[i]!.items, scope)
    );
  });

  return groups.map((g) => ({
    department: g.department,
    categories: g.categories.map((category) => ({
      category,
      products: productsByCategoryId.get(category.id) ?? [],
    })),
  }));
}

export function HomeCatalogRails() {
  const homeCopy = getScreenConfig("home");
  const menuLabel = String(homeCopy.menuRailTitle ?? "Our menu");
  const menuIntro = String(
    homeCopy.menuIntro ?? "Browse by section — add items straight from the menu."
  );
  const baseId = useId().replace(/:/g, "");
  const [menuSections, setMenuSections] = useState<DepartmentMenuSection[] | null>(null);
  const [seeAllCatalogSlug, setSeeAllCatalogSlug] = useState<string | null>(null);
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
        const { groups } = resolveStorefrontDepartmentGroups(scopedCats, bundle, deptRows, appTypeRows);
        const broadSlug = groups.find((g) => g.categories.length > 0)?.categories[0]?.slug ?? null;
        const sections = await loadDepartmentMenuSections(groups, scope);
        if (cancelled) return;

        setMenuSections(sections);
        setSeeAllCatalogSlug(broadSlug);
        setTrending(filterProductsForStorefrontApplication(trendingPage.items, scope));
        setRecent(filterProductsForStorefrontApplication(recentPage.items, scope));
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

  if (menuSections === null || recent === null || trending === null) {
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
  const hasMenuItems = menuSections.some((s) =>
    s.categories.some((row) => row.products.length > 0)
  );

  return (
    <div className="storefront-wrap">
      <div className="storefront-inner">
        <header className="storefront-cafe-hero">
          <h1 className="storefront-cafe-hero__title">{menuLabel}</h1>
          <p className="storefront-cafe-hero__intro">{menuIntro}</p>
          {browseAllHref ? (
            <Link to={browseAllHref} className="storefront-cafe-hero__cta">
              View full menu
            </Link>
          ) : null}
        </header>

        {menuSections.length > 0 ? (
          <div className="storefront-cafe-menu" aria-label={menuLabel}>
            {menuSections.map(({ department, categories }) => (
              <div key={department.id} className="storefront-cafe-menu__dept">
                <h2 className="storefront-cafe-menu__dept-title">{department.label}</h2>
                {categories.map(({ category, products }) => (
                  <div
                    key={category.id}
                    className="storefront-cafe-menu__category"
                    aria-labelledby={`${baseId}-cat-${category.id}`}
                  >
                    <div className="storefront-cafe-menu__category-head">
                      <h3
                        className="storefront-cafe-menu__category-title"
                        id={`${baseId}-cat-${category.id}`}
                      >
                        <Link to={`/browse/${encodeURIComponent(category.slug)}`}>
                          {category.label}
                        </Link>
                      </h3>
                      <Link
                        to={`/browse/${encodeURIComponent(category.slug)}`}
                        className="storefront-cafe-menu__category-see-all"
                      >
                        See all
                      </Link>
                    </div>
                    {products.length === 0 ? (
                      <p className="storefront-cafe-menu__empty">
                        No items listed in {category.label} yet.
                      </p>
                    ) : (
                      <ul className="storefront-cafe-menu__products">
                        {products.map((p) => (
                          <li key={p.id} className="storefront-cafe-menu__product">
                            <CatalogGridProductCard
                              product={p}
                              compactAddLabel
                              skin="storefront"
                            />
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        ) : !hasMenuItems ? (
          <p className="storefront-cafe-menu__empty storefront-cafe-menu__empty--page">
            Your menu sections will appear here once categories and products are published in Admin.
          </p>
        ) : null}

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
