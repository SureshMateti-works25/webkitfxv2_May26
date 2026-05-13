import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import { Link } from "react-router-dom";
import { useCart, type CartLine } from "../cart/CartContext.js";
import { CatalogProductVisual } from "../components/CatalogProductVisual.js";
import { ProductCardPrices } from "../components/ProductCardPrices.js";
import {
  formatCommerceApiError,
  getCommerceLookupBundle,
  listCatalogCategories,
  listCatalogProducts,
  listCommerceLookupValues,
  mediaAssetUrl,
  PRODUCT_DEPARTMENTS_LOOKUP_TYPE_ID,
  type CatalogCategoryRow,
  type CatalogProductCard,
  type CommerceLookupBundleDto,
  type CommerceLookupValueDto,
} from "../lib/commerceApi.js";
import { sortedCommerceLookupValues } from "../lib/lookupFormBindings.js";
import { readRecentVisits, RECENT_VISITS_EVENT } from "../lib/recentVisits.js";
import { snapshotCardUnitPriceMinor } from "../lib/storefrontCartAccess.js";

const MAX_CATEGORY_RAILS = 24;
const RAIL_PAGE_SIZE = 16;
const DEPT_TONE_COUNT = 4;

/** Shopper-facing department block (merchandising root or `product_departments` lookup row). */
type DepartmentHeader = {
  id: string;
  label: string;
  slug: string;
  imageStorageKey: string | null;
};

function catalogRowToDepartmentHeader(row: CatalogCategoryRow): DepartmentHeader {
  return {
    id: row.id,
    label: row.label.trim() || row.slug,
    slug: row.slug.trim() || row.id,
    imageStorageKey: row.imageStorageKey?.trim() ? row.imageStorageKey.trim() : null,
  };
}

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
  department: DepartmentHeader;
  categories: CatalogCategoryRow[];
};

function departmentBrowseGroupsMerchandising(cats: CatalogCategoryRow[]): DepartmentBrowseGroup[] {
  return rootCategories(cats).map((department) => {
    const children = directChildren(cats, department.id);
    return {
      department: catalogRowToDepartmentHeader(department),
      categories: children.length > 0 ? children : [department],
    };
  });
}

/** One block per `product_departments` row that has at least one category with matching `parentValueId`. */
function departmentBrowseGroupsByDepartments(
  cats: CatalogCategoryRow[],
  deptValues: CommerceLookupValueDto[]
): DepartmentBrowseGroup[] {
  const sorted = [...deptValues].sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code));
  const out: DepartmentBrowseGroup[] = [];
  for (const d of sorted) {
    const id = d.id.trim();
    const categories = cats
      .filter((c) => c.parentValueId?.trim() === id)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.slug.localeCompare(b.slug));
    if (categories.length === 0) continue;
    const code = (d.code ?? "").trim();
    out.push({
      department: {
        id,
        label: (d.label ?? "").trim() || code || id,
        slug: code || id,
        imageStorageKey: d.imageStorageKey?.trim() ? d.imageStorageKey.trim() : null,
      },
      categories,
    });
  }
  return out;
}

/** Bundle keys are lookup type ids (often UUIDs), not always the string `product_departments`. */
function isDepartmentLookupTypeInBundle(lookupTypeId: string, bundle: CommerceLookupBundleDto): boolean {
  const t = bundle.types?.find((x) => x.id === lookupTypeId);
  if (!t) return false;
  const known = new Set(
    [PRODUCT_DEPARTMENTS_LOOKUP_TYPE_ID, "product_departments", "product_department"]
      .map((k) => k.trim())
      .filter((k) => k.length > 0)
  );
  if (known.has(t.id.trim())) return true;
  const prefix = (t.entryIdPrefix ?? "").trim().toLowerCase();
  if (prefix === "dept_") return true;
  const title = (t.title ?? "").trim().toLowerCase();
  return title === "product departments";
}

/** When the values API returns no usable department rows, infer departments from category `parentValueId` + bundle. */
function inferDepartmentRowsFromCategoryParents(
  cats: CatalogCategoryRow[],
  bundle: CommerceLookupBundleDto | null
): CommerceLookupValueDto[] {
  if (!bundle?.valuesByLookupTypeId) return [];
  const parentIds = new Set<string>();
  for (const c of cats) {
    const p = c.parentValueId?.trim();
    if (p) parentIds.add(p);
  }
  if (parentIds.size === 0) return [];
  const byId = new Map<string, CommerceLookupValueDto>();
  for (const [lookupTypeId, slice] of Object.entries(bundle.valuesByLookupTypeId)) {
    if (!isDepartmentLookupTypeInBundle(lookupTypeId, bundle)) continue;
    for (const v of slice ?? []) {
      const row = v as CommerceLookupValueDto;
      const id = row?.id?.trim();
      if (id && parentIds.has(id)) byId.set(id, row);
    }
  }
  return sortedCommerceLookupValues([...byId.values()]);
}

/** Load `product_departments` rows: values API first, then lookup bundle (legacy type id fallback). */
async function loadDepartmentRowsForStorefront(): Promise<CommerceLookupValueDto[]> {
  const keys = [
    PRODUCT_DEPARTMENTS_LOOKUP_TYPE_ID.trim(),
    "product_department",
  ].filter((k, i, a) => k.length > 0 && a.indexOf(k) === i);

  for (const lookupTypeId of keys) {
    try {
      const rows = await listCommerceLookupValues(lookupTypeId);
      if (rows.length > 0) return sortedCommerceLookupValues(rows);
    } catch {
      /* try next */
    }
  }

  try {
    const bundle = await getCommerceLookupBundle();
    for (const lookupTypeId of keys) {
      const slice = bundle.valuesByLookupTypeId[lookupTypeId];
      if (slice && slice.length > 0) return sortedCommerceLookupValues(slice as CommerceLookupValueDto[]);
    }
    for (const t of bundle.types ?? []) {
      if (!isDepartmentLookupTypeInBundle(t.id, bundle)) continue;
      const slice = bundle.valuesByLookupTypeId[t.id];
      if (slice && slice.length > 0) return sortedCommerceLookupValues(slice as CommerceLookupValueDto[]);
    }
  } catch {
    /* ignore */
  }

  return [];
}

function mergeDepartmentLookupRowsById(
  primary: CommerceLookupValueDto[],
  secondary: CommerceLookupValueDto[]
): CommerceLookupValueDto[] {
  const map = new Map<string, CommerceLookupValueDto>();
  for (const r of secondary) {
    const id = (r.id ?? "").trim();
    if (id) map.set(id, r);
  }
  for (const r of primary) {
    const id = (r.id ?? "").trim();
    if (id) map.set(id, r);
  }
  return sortedCommerceLookupValues([...map.values()]);
}

/** Resolve a lookup value anywhere in the bundle (handles UUID lookup type keys). */
function findCommerceLookupValueByIdInBundle(
  bundle: CommerceLookupBundleDto,
  valueId: string
): CommerceLookupValueDto | null {
  const id = valueId.trim();
  if (!id || !bundle.valuesByLookupTypeId) return null;
  for (const [lookupTypeId, slice] of Object.entries(bundle.valuesByLookupTypeId)) {
    for (const raw of slice ?? []) {
      const v = raw as CommerceLookupValueDto;
      if ((v.id ?? "").trim() !== id) continue;
      return {
        id: v.id.trim(),
        lookupTypeId: (v.lookupTypeId ?? lookupTypeId).trim(),
        code: String(v.code ?? ""),
        label: String(v.label ?? ""),
        sortOrder: typeof v.sortOrder === "number" ? v.sortOrder : 0,
        parentValueId: v.parentValueId ?? null,
        imageStorageKey: v.imageStorageKey?.trim() ? v.imageStorageKey.trim() : null,
      };
    }
  }
  return null;
}

/**
 * Department rows for grouping: API list + inferred department types + any parent id on a category
 * resolved from the full bundle so new departments and UUID-backed types still map correctly.
 */
function resolveDepartmentRowsForStorefront(
  cats: CatalogCategoryRow[],
  bundle: CommerceLookupBundleDto,
  deptApiRows: CommerceLookupValueDto[]
): CommerceLookupValueDto[] {
  const inferred = inferDepartmentRowsFromCategoryParents(cats, bundle);
  const merged = mergeDepartmentLookupRowsById(deptApiRows, inferred);
  const byId = new Map<string, CommerceLookupValueDto>(merged.map((r) => [(r.id ?? "").trim(), r]));
  for (const c of cats) {
    const pv = c.parentValueId?.trim();
    if (!pv || byId.has(pv)) continue;
    const found = findCommerceLookupValueByIdInBundle(bundle, pv);
    if (found) {
      byId.set(pv, found);
      continue;
    }
    byId.set(pv, {
      id: pv,
      lookupTypeId: PRODUCT_DEPARTMENTS_LOOKUP_TYPE_ID,
      code: pv,
      label: pv,
      sortOrder: 999999,
      parentValueId: null,
      imageStorageKey: null,
    });
  }
  return sortedCommerceLookupValues([...byId.values()]);
}

function categoriesForProductRailsMerchandising(cats: CatalogCategoryRow[]): CatalogCategoryRow[] {
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

function categoriesForProductRailsByDepartmentParent(
  cats: CatalogCategoryRow[],
  deptValues: CommerceLookupValueDto[]
): CatalogCategoryRow[] {
  const deptOrderedIds = [...deptValues]
    .sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code))
    .map((d) => d.id.trim())
    .filter(Boolean);
  const deptRank = new Map(deptOrderedIds.map((id, i) => [id, i]));
  const pool = cats.filter((c) => {
    const pv = c.parentValueId?.trim();
    return pv && deptRank.has(pv);
  });
  pool.sort((a, b) => {
    const ra = deptRank.get(a.parentValueId!.trim()) ?? 9999;
    const rb = deptRank.get(b.parentValueId!.trim()) ?? 9999;
    if (ra !== rb) return ra - rb;
    return a.sortOrder - b.sortOrder || a.slug.localeCompare(b.slug);
  });
  const out: CatalogCategoryRow[] = [];
  const seen = new Set<string>();
  for (const c of pool) {
    if (seen.has(c.id)) continue;
    seen.add(c.id);
    out.push(c);
    if (out.length >= MAX_CATEGORY_RAILS) break;
  }
  return out;
}

/** Departments with at least one category (browse shows every assigned category, including before first listing). */
function departmentsWithCategoriesForBrowse(groups: DepartmentBrowseGroup[]): DepartmentBrowseGroup[] {
  return groups.filter((g) => g.categories.length > 0);
}

function railsGroupedByDepartment(
  groups: DepartmentBrowseGroup[],
  rails: { category: CatalogCategoryRow; items: CatalogProductCard[] }[]
): { department: DepartmentHeader; rails: { category: CatalogCategoryRow; items: CatalogProductCard[] }[] }[] {
  return groups
    .map((g) => ({
      department: g.department,
      rails: rails.filter((r) => g.categories.some((c) => c.id === r.category.id)),
    }))
    .filter((b) => b.rails.length > 0);
}

function isDealProduct(p: CatalogProductCard): boolean {
  const offerOn = Boolean(p.offerType && p.offerType.toLowerCase() !== "none");
  if (offerOn && p.offerPriceMinor != null && Number.isFinite(p.offerPriceMinor)) return true;
  const list = p.listPriceMinor;
  const min = p.minPriceMinor;
  if (list != null && min != null && Number.isFinite(list) && Number.isFinite(min) && list > min) return true;
  return false;
}

function buyAgainLinesDeduped(lines: CartLine[]): CartLine[] {
  const seen = new Set<string>();
  const out: CartLine[] = [];
  for (let i = lines.length - 1; i >= 0; i--) {
    const l = lines[i]!;
    if (seen.has(l.productId)) continue;
    seen.add(l.productId);
    out.push(l);
  }
  return out;
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Dev grocery aisles: try alternate hero keys if the category tile key fails to load. */
const GROCERY_CATEGORY_IMAGE_FALLBACKS: Record<string, string> = {
  produce: "t1/p_gr_demo_produce/hero.jpg",
  dairy: "t1/p_gr_demo_dairy/hero.jpg",
};

function BrowseCategoryCircleTile({ category }: { category: CatalogCategoryRow }) {
  const primary = category.imageStorageKey?.trim() ?? "";
  const slug = category.slug.trim().toLowerCase();
  const fb = GROCERY_CATEGORY_IMAGE_FALLBACKS[slug] ?? "";
  const unique = [...new Set([primary, fb].filter((x) => x.length > 0))];
  const [idx, setIdx] = useState(0);
  const [showPlaceholder, setShowPlaceholder] = useState(unique.length === 0);

  if (showPlaceholder) {
    return (
      <span className="storefront-category-card__placeholder" aria-hidden="true">
        {category.label.trim().charAt(0).toUpperCase()}
      </span>
    );
  }

  const storageKey = unique[Math.min(idx, unique.length - 1)]!;

  return (
    <img
      key={`${category.id}:${storageKey}`}
      src={mediaAssetUrl(storageKey)}
      alt=""
      className="storefront-category-card__img"
      loading="lazy"
      decoding="async"
      onError={() => {
        if (idx + 1 < unique.length) setIdx((i) => i + 1);
        else setShowPlaceholder(true);
      }}
    />
  );
}

function GroceryLandingProductCard({ product }: { product: CatalogProductCard }) {
  const { addOrMergeLine } = useCart();
  const [addedFlash, setAddedFlash] = useState(false);
  const deal = isDealProduct(product);

  const onAdd = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();
      const codes = (product.skuCodes ?? []).map((c) => c.trim()).filter(Boolean);
      const skuCode = codes.length > 0 ? codes[0]! : null;
      addOrMergeLine({
        productId: product.id,
        slug: product.slug,
        titleDisplay: product.titleDisplay,
        skuId: null,
        skuCode: skuCode,
        quantity: 1,
        unitPriceMinor: snapshotCardUnitPriceMinor(product),
        currency: product.currency,
        heroStorageKey: product.heroStorageKey?.trim() || null,
        vendorCode: product.vendorCode?.trim() || null,
      });
      setAddedFlash(true);
      window.setTimeout(() => setAddedFlash(false), 1400);
    },
    [addOrMergeLine, product]
  );

  return (
    <div className={`grocery-landing-product-card${deal ? " grocery-landing-product-card--deal" : ""}`}>
      {deal ? (
        <span className="grocery-landing-product-card__deal-badge" aria-label="Deal">
          Deal
        </span>
      ) : null}
      <Link to={`/p/${encodeURIComponent(product.slug)}`} className="grocery-landing-product-card__link">
        <div className="grocery-landing-product-card__media">
          <CatalogProductVisual
            storageKey={product.heroStorageKey}
            imageIndicators={product.imageIndicators}
            vendorCode={product.vendorCode}
            skuCodes={product.skuCodes}
          />
        </div>
        <ProductCardPrices
          className="grocery-landing-product-card__prices"
          minPriceMinor={product.minPriceMinor}
          currency={product.currency}
          listPriceMinor={product.listPriceMinor}
          offerPriceMinor={product.offerPriceMinor}
          offerType={product.offerType}
          offerCardText={product.offerCardText}
        />
        <p className="grocery-landing-product-card__title">{product.titleDisplay}</p>
      </Link>
      <button
        type="button"
        className="grocery-landing-product-card__add"
        onClick={onAdd}
        aria-label={`Add ${product.titleDisplay} to cart`}
      >
        {addedFlash ? "Added" : "Add"}
      </button>
    </div>
  );
}

function CartResumeCard({ line }: { line: CartLine }) {
  const { addOrMergeLine } = useCart();
  const [flash, setFlash] = useState(false);
  const onAdd = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();
      addOrMergeLine({
        productId: line.productId,
        slug: line.slug,
        titleDisplay: line.titleDisplay,
        skuId: line.skuId,
        skuCode: line.skuCode,
        quantity: 1,
        unitPriceMinor: line.unitPriceMinor,
        currency: line.currency,
        heroStorageKey: line.heroStorageKey,
        vendorCode: line.vendorCode,
      });
      setFlash(true);
      window.setTimeout(() => setFlash(false), 1400);
    },
    [addOrMergeLine, line]
  );

  const img = line.heroStorageKey?.trim() ? mediaAssetUrl(line.heroStorageKey) : null;

  return (
    <div className="grocery-landing-product-card grocery-landing-product-card--resume">
      <Link to={`/p/${encodeURIComponent(line.slug)}`} className="grocery-landing-product-card__link">
        <div className="grocery-landing-product-card__media grocery-landing-product-card__media--resume">
          {img ? (
            <img src={img} alt="" className="grocery-landing-product-card__resume-img" loading="lazy" decoding="async" />
          ) : (
            <div className="grocery-landing-product-card__resume-placeholder" aria-hidden="true">
              {line.titleDisplay.trim().charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <p className="grocery-landing-product-card__resume-price" aria-label="Last price in cart">
          {line.unitPriceMinor != null && Number.isFinite(line.unitPriceMinor)
            ? new Intl.NumberFormat(undefined, {
                style: "currency",
                currency: (line.currency ?? "INR").trim().toUpperCase() || "INR",
              }).format(line.unitPriceMinor / 100)
            : "—"}
        </p>
        <p className="grocery-landing-product-card__title">{line.titleDisplay}</p>
      </Link>
      <button type="button" className="grocery-landing-product-card__add" onClick={onAdd} aria-label={`Add ${line.titleDisplay} again`}>
        {flash ? "Added" : "Add"}
      </button>
    </div>
  );
}

function GroceryCarouselRail({
  titleId,
  title,
  subtitle,
  seeAllHref,
  products,
  emptyHint,
  renderProduct,
  titleHeading = "h2",
}: {
  titleId: string;
  title: string;
  subtitle?: string;
  seeAllHref?: string;
  products: CatalogProductCard[] | CartLine[];
  emptyHint: string;
  renderProduct: (item: CatalogProductCard | CartLine, index: number) => ReactNode;
  titleHeading?: "h2" | "h3";
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);
  const TitleTag = titleHeading;

  const syncNav = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth - 2;
    setCanPrev(el.scrollLeft > 4);
    setCanNext(el.scrollLeft < max);
  }, []);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    syncNav();
    el.addEventListener("scroll", syncNav, { passive: true });
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(syncNav) : null;
    ro?.observe(el);
    return () => {
      el.removeEventListener("scroll", syncNav);
      ro?.disconnect();
    };
  }, [products, syncNav]);

  const scrollByDir = useCallback((dir: -1 | 1) => {
    const el = trackRef.current;
    if (!el) return;
    const delta = Math.max(220, Math.floor(el.clientWidth * 0.72)) * dir;
    el.scrollBy({ left: delta, behavior: prefersReducedMotion() ? "auto" : "smooth" });
    window.setTimeout(syncNav, prefersReducedMotion() ? 0 : 320);
  }, [syncNav]);

  return (
    <section className="grocery-carousel-rail" aria-labelledby={titleId}>
      <div className="grocery-carousel-rail__head grocery-carousel-rail__head--row">
        <div className="grocery-carousel-rail__titles">
          <TitleTag className="grocery-carousel-rail__title" id={titleId}>
            {title}
          </TitleTag>
          {subtitle ? <p className="grocery-carousel-rail__sub">{subtitle}</p> : null}
        </div>
        {seeAllHref && products.length > 0 ? (
          <Link to={seeAllHref} className="grocery-carousel-rail__see-all">
            See all
          </Link>
        ) : null}
      </div>
      {products.length === 0 ? (
        <p className="grocery-carousel-rail__empty">{emptyHint}</p>
      ) : (
        <div className="grocery-rail-carousel">
          <button
            type="button"
            className="grocery-rail-carousel__btn grocery-rail-carousel__btn--prev"
            onClick={() => scrollByDir(-1)}
            disabled={!canPrev}
            aria-label="Scroll products left"
          >
            <span aria-hidden="true">‹</span>
          </button>
          <div className="grocery-rail-carousel__track" ref={trackRef}>
            {products.map((p, i) => (
              <div key={"lineId" in p ? p.lineId : p.id} className="grocery-rail-carousel__cell">
                {renderProduct(p, i)}
              </div>
            ))}
          </div>
          <button
            type="button"
            className="grocery-rail-carousel__btn grocery-rail-carousel__btn--next"
            onClick={() => scrollByDir(1)}
            disabled={!canNext}
            aria-label="Scroll products right"
          >
            <span aria-hidden="true">›</span>
          </button>
        </div>
      )}
    </section>
  );
}

type CategoryRail = { category: CatalogCategoryRow; items: CatalogProductCard[] };

export function HomeCatalogRails() {
  const baseId = useId().replace(/:/g, "");
  const { lines: cartLines } = useCart();
  const [refreshKey, setRefreshKey] = useState(0);
  const [departmentGroups, setDepartmentGroups] = useState<DepartmentBrowseGroup[] | null>(null);
  const [groupedByDepartment, setGroupedByDepartment] = useState(false);
  const [seeAllCatalogSlug, setSeeAllCatalogSlug] = useState<string | null>(null);
  const [categoryRails, setCategoryRails] = useState<CategoryRail[] | null>(null);
  const [deals, setDeals] = useState<CatalogProductCard[] | null>(null);
  const [recent, setRecent] = useState<CatalogProductCard[] | null>(null);
  const [trending, setTrending] = useState<CatalogProductCard[] | null>(null);
  const [visited, setVisited] = useState<CatalogProductCard[]>([]);
  const [error, setError] = useState<string | null>(null);

  const buyAgain = useMemo(() => buyAgainLinesDeduped(cartLines), [cartLines]);

  useEffect(() => {
    let debounce: ReturnType<typeof setTimeout> | undefined;
    const onVisibility = () => {
      if (document.visibilityState !== "visible") return;
      clearTimeout(debounce);
      debounce = setTimeout(() => setRefreshKey((k) => k + 1), 400);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearTimeout(debounce);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

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
        const [cats, trendingPage, recentPage, widePage, deptRows, bundle] = await Promise.all([
          listCatalogCategories(),
          listCatalogProducts({ page: 1, pageSize: RAIL_PAGE_SIZE, sort: "trending" }),
          listCatalogProducts({ page: 1, pageSize: RAIL_PAGE_SIZE, sort: "published_desc" }),
          listCatalogProducts({ page: 1, pageSize: 96, sort: "published_desc" }),
          loadDepartmentRowsForStorefront(),
          getCommerceLookupBundle(),
        ]);
        if (cancelled) return;

        const resolvedDeptRows = resolveDepartmentRowsForStorefront(cats, bundle, deptRows);
        const deptGroups = departmentBrowseGroupsByDepartments(cats, resolvedDeptRows);
        const useDeptGrouping = deptGroups.length > 0;
        const groups = useDeptGrouping ? deptGroups : departmentBrowseGroupsMerchandising(cats);
        const deptRoots = rootCategories(cats);
        const broadSlug = useDeptGrouping
          ? (groups.find((g) => g.categories.length > 0)?.categories[0]?.slug ?? null)
          : (deptRoots[0]?.slug ?? null);
        const railCategories = useDeptGrouping
          ? categoriesForProductRailsByDepartmentParent(cats, resolvedDeptRows)
          : categoriesForProductRailsMerchandising(cats);
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
        const dealItems = widePage.items.filter(isDealProduct).slice(0, RAIL_PAGE_SIZE);
        setDepartmentGroups(groups);
        setGroupedByDepartment(useDeptGrouping);
        setSeeAllCatalogSlug(broadSlug);
        setTrending(trendingPage.items);
        setRecent(recentPage.items);
        setCategoryRails(rails);
        setDeals(dealItems);
      } catch (e) {
        if (!cancelled) setError(formatCommerceApiError(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const nonEmptyCategoryRails = useMemo(
    () => (categoryRails ? categoryRails.filter((r) => r.items.length > 0) : []),
    [categoryRails]
  );

  const departmentBlocks = useMemo(() => {
    if (!departmentGroups) return [];
    return railsGroupedByDepartment(departmentGroups, nonEmptyCategoryRails);
  }, [departmentGroups, nonEmptyCategoryRails]);

  const browseDepartmentSections = useMemo(() => {
    if (!departmentGroups) return [];
    return departmentsWithCategoriesForBrowse(departmentGroups);
  }, [departmentGroups]);

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

  if (
    departmentGroups === null ||
    recent === null ||
    trending === null ||
    categoryRails === null ||
    deals === null
  ) {
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
    <div className="storefront-wrap grocery-landing-wrap">
      <div className="storefront-inner">
        {browseDepartmentSections.length > 0 ? (
          <section
            className="grocery-landing-browse-by-category storefront-categories--grocery-boxes"
            aria-labelledby={`${baseId}-browse-cat`}
          >
            <h2
              className={`grocery-landing-browse-by-category__page-title${
                groupedByDepartment ? " grocery-landing-browse-by-category__page-title--subtle" : ""
              }`}
              id={`${baseId}-browse-cat`}
            >
              {groupedByDepartment ? "Shop by department" : "Browse by category"}
            </h2>
            {browseDepartmentSections.map(({ department, categories }) => (
              <section
                key={department.id}
                className="grocery-landing-browse-dept grocery-landing-browse-dept--grid-layout"
                aria-labelledby={`${baseId}-browse-dept-${department.id}`}
              >
                <header className="grocery-landing-browse-dept__banner">
                  {department.imageStorageKey ? (
                    <img
                      src={mediaAssetUrl(department.imageStorageKey)}
                      alt=""
                      className="grocery-landing-browse-dept__banner-mark"
                      loading="lazy"
                      decoding="async"
                    />
                  ) : null}
                  <h3 className="grocery-landing-browse-dept__banner-title" id={`${baseId}-browse-dept-${department.id}`}>
                    {department.label}
                  </h3>
                </header>
                <ul
                  className="grocery-landing-browse-dept__category-grid storefront-category-grid--boxes"
                  aria-label={`Categories in ${department.label}`}
                >
                  {categories.map((c) => (
                    <li key={c.id} className="grocery-landing-browse-dept__category-cell">
                      <Link
                        to={`/browse/${encodeURIComponent(c.slug)}`}
                        className="storefront-category-card storefront-category-card--box storefront-category-card--landing-grid"
                        aria-label={`${c.label} — ${department.label}`}
                      >
                        <span className="storefront-category-card__visual">
                          <BrowseCategoryCircleTile category={c} />
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </section>
        ) : null}

        <GroceryCarouselRail
          titleId={`${baseId}-buy-again`}
          title="Buy again"
          subtitle="Quick re-order from your cart."
          seeAllHref="/cart"
          products={buyAgain}
          emptyHint="Your cart is empty. Add items from any product page."
          renderProduct={(item) => <CartResumeCard line={item as CartLine} />}
        />

        <GroceryCarouselRail
          titleId={`${baseId}-deals`}
          title="Deals for you"
          subtitle="Offers and savings across the aisle."
          seeAllHref={browseAllHref}
          products={deals}
          emptyHint="No active deals in the catalogue right now."
          renderProduct={(item) => <GroceryLandingProductCard product={item as CatalogProductCard} />}
        />

        <GroceryCarouselRail
          titleId={`${baseId}-trending`}
          title="Trending picks"
          subtitle="Popular listings on this storefront."
          seeAllHref={browseAllHref}
          products={trending}
          emptyHint="No trending picks yet."
          renderProduct={(item) => <GroceryLandingProductCard product={item as CatalogProductCard} />}
        />

        <GroceryCarouselRail
          titleId={`${baseId}-recent`}
          title="Recently added"
          seeAllHref={browseAllHref}
          products={recent}
          emptyHint="No products yet. Check back soon."
          renderProduct={(item) => <GroceryLandingProductCard product={item as CatalogProductCard} />}
        />

        {departmentBlocks.map(({ department, rails }, blockIdx) => (
          <div
            key={department.id}
            className={`grocery-dept-block grocery-dept-block--tone-${blockIdx % DEPT_TONE_COUNT}`}
            aria-label={department.label}
          >
            <h2 className="grocery-dept-block__title">{department.label}</h2>
            {rails.map(({ category, items }) => (
              <GroceryCarouselRail
                key={category.id}
                titleId={`${baseId}-dept-${department.id}-cat-${category.id}`}
                title={category.label}
                titleHeading="h3"
                seeAllHref={`/browse/${encodeURIComponent(category.slug)}`}
                products={items}
                emptyHint={`No listings in ${category.label} yet.`}
                renderProduct={(item) => <GroceryLandingProductCard product={item as CatalogProductCard} />}
              />
            ))}
          </div>
        ))}

        <GroceryCarouselRail
          titleId={`${baseId}-visited`}
          title="Recently visited"
          subtitle="Pick up where you left off."
          seeAllHref={browseAllHref}
          products={visited}
          emptyHint="Open a product page to build your history here."
          renderProduct={(item) => <GroceryLandingProductCard product={item as CatalogProductCard} />}
        />
      </div>
    </div>
  );
}
