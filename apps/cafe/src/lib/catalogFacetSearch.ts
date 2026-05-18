import type { CatalogFacetGroup, CatalogFacetValueOption } from "./commerceApi.js";

/** Build Commerce.Api `filters` query (`defId:valueId,…`). */
export function buildFacetFiltersParam(selections: Record<string, string>): string {
  return Object.entries(selections)
    .filter(([, valueId]) => valueId.trim().length > 0)
    .map(([defId, valueId]) => `${defId.trim()}:${valueId.trim()}`)
    .join(",");
}

const DEF_LABELS: Record<string, string> = {
  dietary: "Dietary",
  spice: "Spice level",
  spicy: "Spice level",
  course: "Course",
  cuisine: "Cuisine",
  portion: "Portion",
  serving: "Serving",
  temperature: "Temperature",
  beverage: "Beverage type",
  allergen: "Allergens",
  organic: "Organic",
  vegan: "Vegan",
  vegetarian: "Vegetarian",
};

function titleCaseWords(s: string): string {
  return s
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

export function facetDefDisplayLabel(group: CatalogFacetGroup): string {
  const code = group.code.trim().toLowerCase();
  if (code && DEF_LABELS[code]) return DEF_LABELS[code]!;
  const fromKey = group.labelKey.split(".").pop()?.replace(/^attr\.?/i, "") ?? "";
  if (fromKey) return titleCaseWords(fromKey.replace(/^attr_?/i, ""));
  return titleCaseWords(group.code || group.attributeDefId);
}

export function facetValueDisplayLabel(value: CatalogFacetValueOption): string {
  const tail = value.labelKey.split(".").pop() ?? "";
  if (tail && !tail.startsWith("attr")) return titleCaseWords(tail);
  return titleCaseWords(value.code.replace(/-/g, " "));
}
