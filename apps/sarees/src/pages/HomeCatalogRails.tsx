import { useEffect, useId, useState } from "react";
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
import {
  categoriesForProductRailsByDepartmentParent,
  categoriesForProductRailsMerchandising,
  loadApplicationTypeRowsForStorefront,
  loadDepartmentRowsForStorefront,
  resolveStorefrontDepartmentGroups,
  type DepartmentBrowseGroup,
} from "../lib/storefrontDepartmentBrowse.js";

const MAX_CATEGORY_RAILS = 24;
const RAIL_PAGE_SIZE = 12;

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

        const { groups, groupedByDepartment, departmentRows: scopedDeptRows } =
          resolveStorefrontDepartmentGroups(cats, bundle, deptRows, appTypeRows);
        const broadSlug = groupedByDepartment
          ? (groups.find((g) => g.categories.length > 0)?.categories[0]?.slug ?? null)
          : (groups[0]?.categories[0]?.slug ?? null);
        const railCategories = groupedByDepartment
          ? categoriesForProductRailsByDepartmentParent(cats, scopedDeptRows, MAX_CATEGORY_RAILS)
          : categoriesForProductRailsMerchandising(cats, MAX_CATEGORY_RAILS);
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
          .map((c, i) => ({ category: c, items: railPages[i]!.items }))
          .filter((rail) => rail.items.length > 0);
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
