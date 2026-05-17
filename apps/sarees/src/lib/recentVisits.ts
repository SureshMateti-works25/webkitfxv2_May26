import {
  CATALOG_PRODUCT_TYPE_ID,
  getCatalogProductDetail,
  normalizeCatalogProductCard,
  type CatalogProductCard,
} from "./commerceApi.js";

const STORAGE_KEY = "webkitfx.sarees.recentVisits";
const MAX_ITEMS = 16;

export const RECENT_VISITS_EVENT = "sarees-recent-visits";

/** Legacy demo / broken listings that should not appear in recent visits. */
const STALE_RECENT_VISIT_PRODUCT_IDS = new Set(["p_kj001"]);

const STALE_RECENT_VISIT_SLUGS = new Set([
  "royal-kanjeevaram-zari",
  "kalamkari-sarees",
  "kalamkari-2-saree",
  "kalamkari-2",
]);

const STALE_RECENT_VISIT_SKU_PREFIXES = ["sku2001", "sku2501", "kj-mrn-g3"];

function normalizeVisitTitle(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, " ");
}

function isStaleDemoRecentVisit(card: CatalogProductCard): boolean {
  const id = card.id.trim();
  if (id && STALE_RECENT_VISIT_PRODUCT_IDS.has(id)) return true;

  const slug = card.slug.trim().toLowerCase();
  if (slug && STALE_RECENT_VISIT_SLUGS.has(slug)) return true;

  const title = normalizeVisitTitle(card.titleDisplay);
  if (title === "kalamkari sarees") return true;
  if (/^kalamkari\s*-?\s*2\b/.test(title)) return true;
  if (title.includes("royal kanjeevaram") || title.includes("kanjeevaram zari")) return true;

  for (const code of card.skuCodes) {
    const sku = code.trim().toLowerCase();
    if (!sku) continue;
    if (STALE_RECENT_VISIT_SKU_PREFIXES.some((prefix) => sku.startsWith(prefix) || sku.includes(prefix)))
      return true;
  }
  return false;
}

function isStorefrontProductVisit(card: CatalogProductCard): boolean {
  const scope = CATALOG_PRODUCT_TYPE_ID.trim();
  if (!scope) return true;
  const typeId = card.productTypeId?.trim();
  if (!typeId) return true;
  return typeId === scope;
}

function isRetainedRecentVisit(card: CatalogProductCard): boolean {
  return isStorefrontProductVisit(card) && !isStaleDemoRecentVisit(card);
}

function persistRecentVisits(items: CatalogProductCard[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_ITEMS)));
  window.dispatchEvent(new CustomEvent(RECENT_VISITS_EVENT));
}

/** Same shape as catalog cards; stored locally for guests and shoppers. */
export function recordProductVisit(product: CatalogProductCard): void {
  try {
    const normalized = normalizeCatalogProductCard(product as unknown as Record<string, unknown>);
    if (!isRetainedRecentVisit(normalized)) return;
    const prev = readRecentVisits();
    const next = [normalized, ...prev.filter((x) => x.slug !== normalized.slug)].slice(0, MAX_ITEMS);
    persistRecentVisits(next);
  } catch {
    /* quota / private mode */
  }
}

export function clearRecentVisits(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new CustomEvent(RECENT_VISITS_EVENT));
  } catch {
    /* private mode */
  }
}

export function readRecentVisits(): CatalogProductCard[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const items = parsed
      .filter((x): x is Record<string, unknown> => x != null && typeof x === "object")
      .map((row) => normalizeCatalogProductCard(row))
      .filter(isRetainedRecentVisit);
    if (items.length !== parsed.length) persistRecentVisits(items);
    return items;
  } catch {
    return [];
  }
}

/** Drop stale demo rows and visits for products no longer in the catalog. */
export async function reconcileRecentVisitsWithCatalog(): Promise<CatalogProductCard[]> {
  const cached = readRecentVisits();
  if (cached.length === 0) return [];

  const kept: CatalogProductCard[] = [];
  await Promise.all(
    cached.map(async (card) => {
      if (isStaleDemoRecentVisit(card)) return;
      const slug = card.slug.trim();
      if (!slug) return;
      try {
        const live = await getCatalogProductDetail({ slug });
        if (live) kept.push(live);
      } catch {
        /* offline — keep only if not on blocklist */
        if (!isStaleDemoRecentVisit(card)) kept.push(card);
      }
    })
  );

  const order = new Map(cached.map((c, i) => [c.slug, i]));
  kept.sort((a, b) => (order.get(a.slug) ?? 99) - (order.get(b.slug) ?? 99));

  if (kept.length !== cached.length) persistRecentVisits(kept);
  return kept;
}
