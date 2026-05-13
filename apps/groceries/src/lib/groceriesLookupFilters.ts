import type { CommerceLookupValueDto } from "./commerceApi.js";

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
