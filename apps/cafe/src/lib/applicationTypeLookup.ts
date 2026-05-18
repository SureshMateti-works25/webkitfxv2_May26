import { CATALOG_APPLICATION_TYPE_LOOKUP_ID } from "./commerceApi.js";
import type { CommerceLookupValueDto } from "./commerceApi.js";

/** Lookup type id for application-type rows in Commerce.Api. */
export const APPLICATION_TYPE_LOOKUP_TYPE_ID =
  (import.meta.env.VITE_APPLICATION_TYPE_LOOKUP_TYPE_ID as string | undefined)?.trim() || "application_type";

export function resolveApplicationTypeLookupTypeIds(): string[] {
  return [APPLICATION_TYPE_LOOKUP_TYPE_ID];
}

/** Stored `products.product_type_id` — same as the selected application_type row id (`app_*`). */
export function productTypeIdFromApplicationLookupValue(
  lookupValueId: string,
  _rows: CommerceLookupValueDto[] = []
): string {
  const id = lookupValueId.trim();
  if (!id) return CATALOG_APPLICATION_TYPE_LOOKUP_ID;
  if (id.startsWith("app_")) return id;
  if (id.startsWith("pt_")) {
    if (id === "pt_cafe") return "app_cafe";
    if (id === "pt_grocery") return "app_gr";
    if (id === "pt_saree") return "app_sr";
  }
  return id;
}

/** Form select value from stored `product_type_id`. */
export function applicationLookupValueIdFromProductTypeId(
  productTypeId: string,
  rows: CommerceLookupValueDto[]
): string {
  const raw = productTypeId.trim();
  if (!raw) return "";
  const direct = rows.find((r) => r.id === raw);
  if (direct) return direct.id;
  if (raw.startsWith("app_")) return raw;
  if (raw === "pt_cafe") return "app_cafe";
  if (raw === "pt_grocery") return "app_gr";
  if (raw === "pt_saree") return "app_sr";
  return CATALOG_APPLICATION_TYPE_LOOKUP_ID;
}

export function resolveStorefrontProductTypeId(rows: CommerceLookupValueDto[] = []): string {
  return productTypeIdFromApplicationLookupValue(CATALOG_APPLICATION_TYPE_LOOKUP_ID, rows);
}
