import type { CatalogProductDetail } from "./commerceApi.js";
import { snapshotStorefrontUnitPriceMinor } from "./storefrontCartAccess.js";
import type { PackagingVariant, ProductSpec } from "./productSpec.js";

export type StorefrontSku = {
  id: string;
  skuCode: string;
  listPriceMinor: number | null;
  compareAtPriceMinor: number | null;
};

function normCode(s: string): string {
  return s.trim().toLowerCase().replace(/[\s_-]+/g, "");
}

/** Score how well a SKU code matches a packaging variant (higher = better). */
function variantSkuMatchScore(variant: PackagingVariant, sku: StorefrontSku): number {
  const code = sku.skuCode.toLowerCase();
  const norm = normCode(sku.skuCode);
  const linked = variant.skuCode?.trim();
  if (linked) {
    if (normCode(linked) === norm) return 100;
    if (code.includes(linked.toLowerCase())) return 80;
  }

  const q = variant.quantity;
  const ut = variant.unitType;

  if (ut === "KILOGRAM") {
    if (q < 1) {
      const g = Math.round(q * 1000);
      if (code.includes(String(g)) || norm.includes(`${g}g`) || code.includes("0.5") || code.includes("half"))
        return 50;
    } else if (q === 1) {
      if (code.includes("1kg") || code.includes("1-kg") || norm.endsWith("1kg") || code.includes("1000g")) return 50;
    } else if (code.includes(`${q}kg`) || code.includes(`${q}-kg`)) return 45;
  }

  if (ut === "GRAM" && q >= 1) {
    if (code.includes(String(Math.round(q))) || norm.includes(`${Math.round(q)}g`)) return 45;
  }

  if (ut === "LITER") {
    if (q === 1 && (code.includes("1l") || code.includes("1ltr") || code.includes("1000ml"))) return 45;
    if (q < 1 && code.includes(String(Math.round(q * 1000)))) return 45;
  }

  if (ut === "PIECE" || ut === "PACK") {
    if (code.includes(String(Math.round(q)))) return 30;
  }

  return 0;
}

/** Resolve the sellable SKU for a packaging variant (explicit skuCode, fuzzy code, then index). */
export function resolveVariantStorefrontSku(
  variant: PackagingVariant,
  variantIndex: number,
  skus: StorefrontSku[]
): StorefrontSku | null {
  if (skus.length === 0) return null;

  const linked = variant.skuCode?.trim();
  if (linked) {
    const exact = skus.find((s) => normCode(s.skuCode) === normCode(linked));
    if (exact) return exact;
  }

  let best: StorefrontSku | null = null;
  let bestScore = 0;
  for (const sku of skus) {
    const score = variantSkuMatchScore(variant, sku);
    if (score > bestScore) {
      bestScore = score;
      best = sku;
    }
  }
  if (best && bestScore >= 30) return best;

  const byPrice = [...skus].sort(
    (a, b) => (a.listPriceMinor ?? Number.MAX_SAFE_INTEGER) - (b.listPriceMinor ?? Number.MAX_SAFE_INTEGER)
  );
  if (variantIndex >= 0 && variantIndex < byPrice.length) return byPrice[variantIndex] ?? null;
  return byPrice[0] ?? null;
}

export function defaultPackVariantIndex(spec: ProductSpec | null | undefined): number {
  if (!spec?.packagingVariants.length) return 0;
  const i = spec.packagingVariants.findIndex((v) => v.isDefault);
  return i >= 0 ? i : 0;
}

export function storefrontUnitPriceMinor(
  sku: StorefrontSku | null,
  product: CatalogProductDetail
): number | null {
  if (sku?.listPriceMinor != null && Number.isFinite(sku.listPriceMinor)) return sku.listPriceMinor;
  return snapshotStorefrontUnitPriceMinor(product);
}

export function storefrontComparePriceMinor(
  sku: StorefrontSku | null,
  product: CatalogProductDetail
): number | null {
  if (sku?.compareAtPriceMinor != null && Number.isFinite(sku.compareAtPriceMinor)) return sku.compareAtPriceMinor;
  const sale = storefrontUnitPriceMinor(sku, product);
  const list = product.listPriceMinor;
  if (list != null && sale != null && list > sale) return list;
  return null;
}

export function lineTotalMinor(unitMinor: number | null, quantity: number): number | null {
  if (unitMinor == null || !Number.isFinite(unitMinor) || quantity < 1) return null;
  return unitMinor * quantity;
}

/** SKU for the currently selected pack index (packaging variant or bare SKU list). */
export function resolveSelectionStorefrontSku(
  spec: ProductSpec | null | undefined,
  selectionIndex: number,
  skus: StorefrontSku[]
): StorefrontSku | null {
  const variants = spec?.packagingVariants ?? [];
  if (variants.length > 0) {
    const v = variants[selectionIndex] ?? variants[0];
    if (!v) return skus[0] ?? null;
    return resolveVariantStorefrontSku(v, selectionIndex, skus);
  }
  if (skus.length > 0) return skus[selectionIndex] ?? skus[0] ?? null;
  return null;
}

export function packSelectionCount(spec: ProductSpec | null | undefined, skus: StorefrontSku[]): number {
  const variants = spec?.packagingVariants ?? [];
  if (variants.length > 0) return variants.length;
  return skus.length;
}
