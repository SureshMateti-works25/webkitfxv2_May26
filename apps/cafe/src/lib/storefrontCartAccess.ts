import type { AuthState } from "../auth/AuthContext.js";
import type { CatalogProductCard, CatalogProductDetail } from "./commerceApi.js";

/** Server cart requires a signed-in shopper (Commerce.Api /api/v1/cart). */
export function canUseStorefrontCart(auth: AuthState): boolean {
  return auth.status === "signedIn" && auth.role === "shopper";
}

export function snapshotStorefrontUnitPriceMinor(product: CatalogProductDetail): number | null {
  const sale =
    product.offerType &&
    product.offerType.toLowerCase() !== "none" &&
    product.offerPriceMinor != null &&
    Number.isFinite(product.offerPriceMinor)
      ? product.offerPriceMinor
      : product.minPriceMinor;
  return sale != null && Number.isFinite(sale) ? sale : null;
}

/** Same pricing rule as PDP, for catalogue cards (rails / browse / search). */
export function snapshotCardUnitPriceMinor(product: CatalogProductCard): number | null {
  const sale =
    product.offerType &&
    product.offerType.toLowerCase() !== "none" &&
    product.offerPriceMinor != null &&
    Number.isFinite(product.offerPriceMinor)
      ? product.offerPriceMinor
      : product.minPriceMinor;
  return sale != null && Number.isFinite(sale) ? sale : null;
}

export function buildCartSkuSelectOptions(product: CatalogProductDetail): { value: string; label: string }[] {
  const facets = product.skuGalleryFacets ?? [];
  if (facets.length > 0) {
    return facets.map((f) => ({
      value: f.skuId,
      label: (f.skuCode ?? "").trim() || f.skuId.slice(0, 14),
    }));
  }
  const codes = (product.skuCodes ?? []).map((c) => c.trim()).filter(Boolean);
  return codes.map((c) => ({ value: c, label: c }));
}

export function resolveCartSkuFromKey(
  product: CatalogProductDetail,
  key: string
): { skuId: string | null; skuCode: string | null } {
  const k = key.trim();
  if (!k) return { skuId: null, skuCode: null };
  const facets = product.skuGalleryFacets ?? [];
  if (facets.length > 0) {
    const byId = facets.find((f) => f.skuId === k);
    if (byId) return { skuId: byId.skuId, skuCode: (byId.skuCode ?? "").trim() || null };
    const byCode = facets.find((f) => (f.skuCode ?? "").trim() === k);
    if (byCode) return { skuId: byCode.skuId, skuCode: (byCode.skuCode ?? "").trim() || null };
  }
  if ((product.skuCodes ?? []).some((c) => c.trim() === k)) return { skuId: null, skuCode: k };
  return { skuId: null, skuCode: k };
}
