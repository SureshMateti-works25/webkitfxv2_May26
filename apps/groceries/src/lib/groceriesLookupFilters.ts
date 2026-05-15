import type { CommerceLookupValueDto } from "./commerceApi.js";

/**
 * Seeded saree **demo** category ids only. We do not walk `merchandisingParentId`:
 * real grocery rows sometimes share or mis-point parents, which would hide valid
 * categories (e.g. atta, oil, ice cream) from Admin / vendor selects.
 */
const KNOWN_SAREE_DEMO_CATEGORY_IDS = new Set([
  "cat_saree",
  "cat_silk",
  "cat_kan",
  "pcat_kalamkari",
]);

/**
 * Groceries admin / vendor: hide only the fixed saree demo rows from `product_categories`.
 * Everything else from Commerce.Api stays visible.
 */
export function filterProductCategoryLookupRowsForGroceries(rows: CommerceLookupValueDto[]): CommerceLookupValueDto[] {
  return rows.filter((r) => !KNOWN_SAREE_DEMO_CATEGORY_IDS.has(r.id));
}

/**
 * Groceries storefront / admin: hide saree product type so category parent and
 * vendor "Product type" selects only show types relevant to this vertical.
 */
export function shouldHideProductTypeForGroceriesApp(row: CommerceLookupValueDto): boolean {
  const id = row.id.trim().toLowerCase();
  const code = (row.code ?? "").trim().toLowerCase();
  const label = (row.label ?? "").trim().toLowerCase();
  if (id === "pt_saree" || code === "pt_saree") return true;
  if (id.includes("saree") || code.includes("saree")) return true;
  if (label.includes("saree")) return true;
  return false;
}

export function filterProductTypeLookupRowsForGroceries(rows: CommerceLookupValueDto[]): CommerceLookupValueDto[] {
  return rows.filter((r) => !shouldHideProductTypeForGroceriesApp(r));
}
