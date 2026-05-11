import { normalizeCatalogProductCard, type CatalogProductCard } from "./commerceApi.js";

const STORAGE_KEY = "webkitfx.sarees.recentVisits";
const MAX_ITEMS = 16;

export const RECENT_VISITS_EVENT = "sarees-recent-visits";

/** Same shape as catalog cards; stored locally for guests and shoppers. */
export function recordProductVisit(product: CatalogProductCard): void {
  try {
    const normalized = normalizeCatalogProductCard(product as unknown as Record<string, unknown>);
    const raw = localStorage.getItem(STORAGE_KEY);
    const prevRaw = raw ? (JSON.parse(raw) as unknown) : [];
    const prev: CatalogProductCard[] = Array.isArray(prevRaw)
      ? prevRaw
          .filter((x): x is Record<string, unknown> => x != null && typeof x === "object")
          .map((row) => normalizeCatalogProductCard(row))
      : [];
    const next = [normalized, ...prev.filter((x) => x.slug !== normalized.slug)].slice(0, MAX_ITEMS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent(RECENT_VISITS_EVENT));
  } catch {
    /* quota / private mode */
  }
}

export function readRecentVisits(): CatalogProductCard[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((x): x is Record<string, unknown> => x != null && typeof x === "object")
      .map((row) => normalizeCatalogProductCard(row));
  } catch {
    return [];
  }
}
