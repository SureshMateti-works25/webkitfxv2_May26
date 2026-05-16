import {
  fetchShopperRecentProductViews,
  recordShopperProductView,
  type CatalogProductCard,
} from "./commerceApi.js";

export const RECENT_VISITS_EVENT = "groceries-recent-visits";

const LEGACY_STORAGE_KEY = "webkitfx.groceries.recentVisits";

function purgeLegacyRecentVisitsStorage(): void {
  try {
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    /* private mode */
  }
}

purgeLegacyRecentVisitsStorage();

/** Records a PDP view for signed-in shoppers (Postgres via Commerce.Api). */
export async function recordProductVisit(
  product: CatalogProductCard,
  accessToken: string | null | undefined
): Promise<void> {
  if (!accessToken?.trim() || !product.id?.trim()) return;
  try {
    await recordShopperProductView(accessToken, product.id);
    window.dispatchEvent(new CustomEvent(RECENT_VISITS_EVENT));
  } catch {
    /* non-blocking */
  }
}

/** Recently viewed products from the API (empty when not signed in as shopper). */
export async function fetchRecentProductVisits(
  accessToken: string | null | undefined
): Promise<CatalogProductCard[]> {
  if (!accessToken?.trim()) return [];
  try {
    return await fetchShopperRecentProductViews(accessToken);
  } catch {
    return [];
  }
}

/** @deprecated Use {@link fetchRecentProductVisits}. */
export function readRecentVisits(): CatalogProductCard[] {
  return [];
}
