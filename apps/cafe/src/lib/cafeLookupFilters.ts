import {
  CATALOG_APPLICATION_TYPE_LOOKUP_ID,
  type CatalogCategoryRow,
  type CatalogProductCard,
  type CommerceLookupValueDto,
} from "./commerceApi.js";
import {
  applicationLookupValueIdFromProductTypeId,
  resolveStorefrontProductTypeId,
} from "./applicationTypeLookup.js";

export type StorefrontApplicationScope = {
  applicationTypeIds: Set<string>;
  allowedCategoryParentIds: Set<string>;
  blockedCategoryParentIds: Set<string>;
  allowedDepartmentIds: Set<string>;
};

function isCafeApplicationRow(row: CommerceLookupValueDto): boolean {
  const code = row.code.trim().toLowerCase();
  const label = row.label.trim().toLowerCase();
  return (
    code === "cafe" ||
    code.includes("cafe") ||
    label.includes("café") ||
    label.includes("cafe")
  );
}

/** All application_type row ids for this café storefront (seeded `app_cafe` + Admin-created Café rows). */
export function resolveApplicationTypeIdsForStorefront(
  applicationTypeRows: CommerceLookupValueDto[]
): string[] {
  const configured = CATALOG_APPLICATION_TYPE_LOOKUP_ID.trim();
  const ids = new Set<string>();

  if (configured) ids.add(configured);

  for (const row of applicationTypeRows) {
    const id = row.id.trim();
    if (!id) continue;
    if (configured.startsWith("app_") && id === configured) ids.add(id);
    if (configured === "app_cafe" || configured === "pt_cafe") {
      if (isCafeApplicationRow(row)) ids.add(id);
    }
  }

  if (ids.size === 0 && configured) ids.add(configured);

  return [...ids];
}

/** @deprecated Use {@link resolveApplicationTypeIdsForStorefront}. */
export function resolveOwnApplicationTypeId(
  applicationTypeRows: CommerceLookupValueDto[]
): string {
  const ids = resolveApplicationTypeIdsForStorefront(applicationTypeRows);
  const configured = CATALOG_APPLICATION_TYPE_LOOKUP_ID.trim();
  if (configured && ids.includes(configured)) return configured;
  return ids[0] ?? applicationLookupValueIdFromProductTypeId(configured, applicationTypeRows);
}

export function buildStorefrontApplicationScope(
  applicationTypeRows: CommerceLookupValueDto[],
  departmentRows: CommerceLookupValueDto[]
): StorefrontApplicationScope {
  const applicationTypeIds = new Set(resolveApplicationTypeIdsForStorefront(applicationTypeRows));
  const storefrontVerticalId = resolveStorefrontProductTypeId(applicationTypeRows);

  const allowedCategoryParentIds = new Set<string>();
  const blockedCategoryParentIds = new Set<string>();

  for (const appId of applicationTypeIds) allowedCategoryParentIds.add(appId);
  if (storefrontVerticalId) allowedCategoryParentIds.add(storefrontVerticalId);

  const allowedDepartmentIds = new Set<string>();
  for (const d of departmentRows) {
    const id = d.id.trim();
    const parent = (d.parentValueId ?? "").trim();
    if (!id || !parent) continue;
    if (applicationTypeIds.has(parent)) {
      allowedDepartmentIds.add(id);
      allowedCategoryParentIds.add(id);
    }
  }

  for (const row of applicationTypeRows) {
    const id = row.id.trim();
    if (!id || applicationTypeIds.has(id)) continue;
    blockedCategoryParentIds.add(id);
  }

  for (const legacy of ["pt_saree", "pt_grocery", "pt_cafe", "app_sr", "app_gr"]) {
    if (!applicationTypeIds.has(legacy)) blockedCategoryParentIds.add(legacy);
  }

  return {
    applicationTypeIds,
    allowedCategoryParentIds,
    blockedCategoryParentIds,
    allowedDepartmentIds,
  };
}

/** Keep only categories for this café vertical (application types + their departments). */
export function filterCategoriesForStorefrontApplication(
  cats: CatalogCategoryRow[],
  scope: StorefrontApplicationScope
): CatalogCategoryRow[] {
  if (scope.applicationTypeIds.size === 0) return cats;

  return cats.filter((c) => {
    const pv = (c.parentValueId ?? "").trim();
    if (!pv) {
      const slug = c.slug.trim().toLowerCase();
      const label = c.label.trim().toLowerCase();
      if (slug.includes("saree") || label.includes("saree")) return false;
      if (slug.includes("grocery") || label.includes("grocery")) return false;
      return true;
    }
    if (scope.blockedCategoryParentIds.has(pv)) return false;
    if (scope.allowedCategoryParentIds.has(pv)) return true;
    if (scope.allowedDepartmentIds.has(pv)) return true;
    return false;
  });
}

export function filterDepartmentsForStorefrontApplication(
  deptRows: CommerceLookupValueDto[],
  applicationTypeRows: CommerceLookupValueDto[]
): CommerceLookupValueDto[] {
  const appIds = new Set(resolveApplicationTypeIdsForStorefront(applicationTypeRows));
  if (appIds.size === 0) return deptRows;
  return deptRows.filter((d) => appIds.has((d.parentValueId ?? "").trim()));
}

export function filterProductsForStorefrontApplication(
  items: CatalogProductCard[],
  scope: StorefrontApplicationScope
): CatalogProductCard[] {
  const matchIds = new Set(scope.applicationTypeIds);
  if (scope.applicationTypeIds.has("app_cafe")) matchIds.add("pt_cafe");

  return items.filter((p) => {
    const id = (p.productTypeId ?? "").trim();
    if (!id) return false;
    if (matchIds.has(id)) return true;
    if (scope.applicationTypeIds.has("app_cafe") && id.startsWith("at_")) return true;
    return false;
  });
}
