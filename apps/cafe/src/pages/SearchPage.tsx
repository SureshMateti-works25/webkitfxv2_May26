import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { CatalogGridProductCard } from "../components/CatalogGridProductCard.js";
import { getShell } from "../config/getShell.js";
import {
  buildFacetFiltersParam,
  facetDefDisplayLabel,
  facetValueDisplayLabel,
} from "../lib/catalogFacetSearch.js";
import {
  listCatalogCategories,
  listCatalogFacetOptions,
  listCatalogProducts,
  type CatalogCategoryRow,
  type CatalogFacetGroup,
  type CatalogProductCard,
} from "../lib/commerceApi.js";
import {
  buildStorefrontApplicationScope,
  filterCategoriesForStorefrontApplication,
  filterProductsForStorefrontApplication,
} from "../lib/cafeLookupFilters.js";
import {
  categoriesForProductRailsMerchandising,
  loadApplicationTypeRowsForStorefront,
  loadDepartmentRowsForStorefront,
} from "../lib/storefrontDepartmentBrowse.js";

type ActiveFilter = { label: string; value: string };

export function SearchPage() {
  const shell = getShell();
  const copy = shell.screens.search;

  const [facetGroups, setFacetGroups] = useState<CatalogFacetGroup[]>([]);
  const [categories, setCategories] = useState<CatalogCategoryRow[]>([]);
  const [facetsLoading, setFacetsLoading] = useState(true);
  const [facetsError, setFacetsError] = useState<string | null>(null);

  const [productName, setProductName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [facetSelections, setFacetSelections] = useState<Record<string, string>>({});
  const [applied, setApplied] = useState<{
    productName: string;
    categoryId: string;
    facetSelections: Record<string, string>;
  } | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<CatalogProductCard[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setFacetsLoading(true);
      setFacetsError(null);
      try {
        const [facets, cats, deptRows, appTypeRows] = await Promise.all([
          listCatalogFacetOptions(),
          listCatalogCategories(),
          loadDepartmentRowsForStorefront(),
          loadApplicationTypeRowsForStorefront(),
        ]);
        if (cancelled) return;
        const scope = buildStorefrontApplicationScope(appTypeRows, deptRows);
        const scopedCats = filterCategoriesForStorefrontApplication(cats, scope);
        const menuCategories = categoriesForProductRailsMerchandising(scopedCats, 48);
        setFacetGroups(facets.filter((g) => g.values.some((v) => v.productCount > 0) || g.values.length > 0));
        setCategories(menuCategories);
      } catch (e) {
        if (!cancelled) setFacetsError(e instanceof Error ? e.message : "Could not load menu filters");
      } finally {
        if (!cancelled) setFacetsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const activeFilters = useMemo((): ActiveFilter[] => {
    if (!applied) return [];
    const out: ActiveFilter[] = [];
    const name = applied.productName.trim();
    if (name) out.push({ label: "Dish or item", value: name });
    if (applied.categoryId) {
      const cat = categories.find((c) => c.id === applied.categoryId);
      out.push({ label: "Menu section", value: cat?.label ?? applied.categoryId });
    }
    for (const group of facetGroups) {
      const valueId = applied.facetSelections[group.attributeDefId]?.trim();
      if (!valueId) continue;
      const val = group.values.find((v) => v.id === valueId);
      out.push({
        label: facetDefDisplayLabel(group),
        value: val ? facetValueDisplayLabel(val) : valueId,
      });
    }
    return out;
  }, [applied, categories, facetGroups]);

  const runSearch = useCallback(
    async (next: { productName: string; categoryId: string; facetSelections: Record<string, string> }) => {
      setError(null);
      setLoading(true);
      setApplied(next);
      try {
        const filters = buildFacetFiltersParam(next.facetSelections);
        const [page, deptRows, appTypeRows] = await Promise.all([
          listCatalogProducts({
            q: next.productName.trim() || undefined,
            categoryId: next.categoryId.trim() || undefined,
            includeSubtree: Boolean(next.categoryId.trim()),
            filters: filters || undefined,
            page: 1,
            pageSize: 36,
          }),
          loadDepartmentRowsForStorefront(),
          loadApplicationTypeRowsForStorefront(),
        ]);
        const scope = buildStorefrontApplicationScope(appTypeRows, deptRows);
        setItems(filterProductsForStorefrontApplication(page.items, scope));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Search failed");
        setItems([]);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void runSearch({ productName, categoryId, facetSelections });
  };

  const setFacet = (defId: string, valueId: string) => {
    setFacetSelections((prev) => ({ ...prev, [defId]: valueId }));
  };

  return (
    <section className="search-page">
      <header className="screen-prose">
        <h1>{copy.title}</h1>
        <p>{copy.body}</p>
      </header>

      <form className="search-page__form-panel search-attribute-form" onSubmit={onSubmit}>
        <div className="search-attribute-form__row">
          <label className="search-attribute-form__field search-attribute-form__field--grow">
            <span className="search-attribute-form__label">Dish or item</span>
            <input
              type="search"
              className="search-attribute-form__input"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder="e.g. masala dosa, filter coffee, biryani"
              autoComplete="off"
            />
          </label>
          <label className="search-attribute-form__field">
            <span className="search-attribute-form__label">Menu section</span>
            <select
              className="search-attribute-form__select"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              disabled={facetsLoading}
            >
              <option value="">All sections</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {facetsError ? <p className="search-page__error">{facetsError}</p> : null}

        {facetGroups.length > 0 ? (
          <fieldset className="search-attribute-form__attributes" disabled={facetsLoading}>
            <legend className="search-attribute-form__legend">Menu attributes</legend>
            <div className="search-attribute-form__attr-grid">
              {facetGroups.map((group) => (
                <label key={group.attributeDefId} className="search-attribute-form__field">
                  <span className="search-attribute-form__label">{facetDefDisplayLabel(group)}</span>
                  <select
                    className="search-attribute-form__select"
                    value={facetSelections[group.attributeDefId] ?? ""}
                    onChange={(e) => setFacet(group.attributeDefId, e.target.value)}
                  >
                    <option value="">Any</option>
                    {group.values.map((val) => (
                      <option key={val.id} value={val.id} disabled={val.productCount === 0}>
                        {facetValueDisplayLabel(val)}
                        {val.productCount > 0 ? ` (${val.productCount})` : ""}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          </fieldset>
        ) : !facetsLoading && !facetsError ? (
          <p className="search-attribute-form__hint">
            {copy.noAttributesHint ??
              "No menu attribute filters are configured yet. Search by dish name or menu section."}
          </p>
        ) : null}

        <div className="webkitfx-form-actions">
          <button type="submit" disabled={loading || facetsLoading} aria-busy={loading}>
            {loading ? "Searching…" : "Search menu"}
          </button>
        </div>
      </form>

      {activeFilters.length > 0 ? (
        <ul className="search-page__active-filters" aria-label="Active filters">
          {activeFilters.map((f) => (
            <li key={`${f.label}:${f.value}`}>
              <span>{f.label}</span>
              <strong>{f.value}</strong>
            </li>
          ))}
        </ul>
      ) : null}

      {error ? <p className="search-page__error">{error}</p> : null}
      {!loading && !error && applied && items.length === 0 ? (
        <p className="search-page__empty">{copy.noResults}</p>
      ) : null}

      {items.length > 0 ? (
        <ul className="browse-product-grid">
          {items.map((item) => (
            <li key={item.id} className="browse-product-grid__cell">
              <CatalogGridProductCard product={item} skin="storefront" />
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
