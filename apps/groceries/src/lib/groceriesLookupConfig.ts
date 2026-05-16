import { CATALOG_PRODUCT_TYPE_ID } from "./commerceApi.js";
import type { CommerceLookupValueDto } from "./commerceApi.js";

/** Lookup type id for application-type rows in Commerce.Api (`application_type` in groceries admin). */
export const APPLICATION_TYPE_LOOKUP_TYPE_ID =
  (import.meta.env.VITE_APPLICATION_TYPE_LOOKUP_TYPE_ID as string | undefined)?.trim() || "application_type";

/** Older seeds / docs; tried after primary when loading vendor dropdowns. */
const LEGACY_APPLICATION_TYPE_LOOKUP_TYPE_IDS = ["app_type", "product_types"] as const;

export function resolveApplicationTypeLookupTypeIds(): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const add = (id: string) => {
    const key = id.trim();
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push(key);
  };
  add(APPLICATION_TYPE_LOOKUP_TYPE_ID);
  for (const legacy of LEGACY_APPLICATION_TYPE_LOOKUP_TYPE_IDS) add(legacy);
  return out;
}

/**
 * Storefront `Product.ProductTypeId` (e.g. `pt_grocery`) from an application-type lookup row id.
 */
export function productTypeIdFromApplicationLookupValue(
  lookupValueId: string,
  rows: CommerceLookupValueDto[]
): string {
  const id = lookupValueId.trim();
  if (!id) return CATALOG_PRODUCT_TYPE_ID;
  if (id.startsWith("pt_")) return id;
  const row = rows.find((r) => r.id === id);
  if (!row) return id;
  const code = row.code.trim().toLowerCase();
  const label = row.label.trim().toLowerCase();
  if (code === "gr" || code.includes("grocery") || label.includes("grocery")) return CATALOG_PRODUCT_TYPE_ID;
  if (code === "sr" || code.includes("saree") || label.includes("saree")) return "pt_saree";
  return CATALOG_PRODUCT_TYPE_ID;
}

/** Form select value (lookup row id) from stored `productTypeId`. */
export function applicationLookupValueIdFromProductTypeId(
  productTypeId: string,
  rows: CommerceLookupValueDto[]
): string {
  const pt = productTypeId.trim();
  if (!pt) return "";
  const direct = rows.find((r) => r.id === pt);
  if (direct) return direct.id;
  const isGrocery = pt === CATALOG_PRODUCT_TYPE_ID || pt.toLowerCase().includes("grocery");
  const isSaree = pt.toLowerCase().includes("saree");
  const match = rows.find((r) => {
    const code = r.code.trim().toLowerCase();
    const label = r.label.trim().toLowerCase();
    if (isGrocery) return code === "gr" || code.includes("grocery") || label.includes("grocery");
    if (isSaree) return code === "sr" || code.includes("saree") || label.includes("saree");
    return false;
  });
  return match?.id ?? "";
}
