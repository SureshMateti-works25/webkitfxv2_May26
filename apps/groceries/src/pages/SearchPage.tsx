import { JsonForm } from "@webkitfxv2/react-renderer";
import { getAtPath, type FormDefinition } from "@webkitfxv2/core-engine";
import { useMemo, useState } from "react";
import { CatalogGridProductCard } from "../components/CatalogGridProductCard.js";
import { searchFiltersForm } from "../config/forms/index.js";
import { getShell } from "../config/getShell.js";
import { listCatalogProducts, type CatalogProductCard } from "../lib/commerceApi.js";

type ActiveFilter = { label: string; value: string };

function readFieldMap(form: FormDefinition): Record<string, { label?: string; props?: Record<string, unknown> }> {
  return (form.fields ?? {}) as Record<string, { label?: string; props?: Record<string, unknown> }>;
}

function deriveTextQuery(values: Record<string, unknown>): string {
  const filterObj = (getAtPath(values, "filters") ?? {}) as Record<string, unknown>;
  const formFields = readFieldMap(searchFiltersForm);
  for (const fieldId of Object.keys(formFields)) {
    const field = formFields[fieldId];
    const searchParam = String(field.props?.searchParam ?? "").trim();
    if (searchParam !== "q") continue;
    const value = String(filterObj[fieldId] ?? "").trim();
    if (value) return value;
  }
  return "";
}

function activeFilters(values: Record<string, unknown>): ActiveFilter[] {
  const filterObj = (getAtPath(values, "filters") ?? {}) as Record<string, unknown>;
  const formFields = readFieldMap(searchFiltersForm);
  const out: ActiveFilter[] = [];
  for (const fieldId of Object.keys(formFields)) {
    const raw = filterObj[fieldId];
    const value = raw == null ? "" : String(raw).trim();
    if (!value) continue;
    const label = formFields[fieldId]?.label ?? fieldId;
    out.push({ label, value });
  }
  return out;
}

export function SearchPage() {
  const shell = getShell();
  const copy = shell.screens.search;
  const [appliedValues, setAppliedValues] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<CatalogProductCard[]>([]);

  const filters = useMemo(() => activeFilters(appliedValues), [appliedValues]);

  return (
    <section className="search-page">
      <header className="screen-prose">
        <h1>{copy.title}</h1>
        <p>{copy.body}</p>
      </header>

      <div className="search-page__form-panel">
        <JsonForm
          form={searchFiltersForm}
          onSubmit={async (values) => {
            setError(null);
            setLoading(true);
            setAppliedValues(values);
            try {
              const q = deriveTextQuery(values);
              const page = await listCatalogProducts({ q: q || undefined, page: 1, pageSize: 36 });
              setItems(page.items);
            } catch (e) {
              setError(e instanceof Error ? e.message : "Search failed");
            } finally {
              setLoading(false);
            }
          }}
        >
          <div className="webkitfx-form-actions">
            <button type="submit" disabled={loading} aria-busy={loading}>
              {loading ? "Searching..." : "Search"}
            </button>
          </div>
        </JsonForm>
      </div>

      {filters.length > 0 ? (
        <ul className="search-page__active-filters" aria-label="Active filters">
          {filters.map((f) => (
            <li key={`${f.label}:${f.value}`}>
              <span>{f.label}</span>
              <strong>{f.value}</strong>
            </li>
          ))}
        </ul>
      ) : null}

      {error ? <p className="search-page__error">{error}</p> : null}
      {!loading && !error && filters.length > 0 && items.length === 0 ? (
        <p className="search-page__empty">{copy.noResults}</p>
      ) : null}

      {items.length > 0 ? (
        <ul className="browse-product-grid">
          {items.map((item) => (
            <li key={item.id} className="browse-product-grid__cell">
              <CatalogGridProductCard product={item} />
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
