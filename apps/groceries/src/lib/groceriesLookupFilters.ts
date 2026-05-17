import type { CommerceLookupValueDto } from "./commerceApi.js";
import { CATALOG_PRODUCT_TYPE_ID } from "./commerceApi.js";
import {
  applicationLookupValueIdFromProductTypeId,
  resolveApplicationTypeLookupTypeIds,
} from "./groceriesLookupConfig.js";
import { listCommerceLookupValues } from "./commerceApi.js";

let cachedApplicationTypeRows: CommerceLookupValueDto[] | null = null;

async function loadApplicationTypeRows(): Promise<CommerceLookupValueDto[]> {
  if (cachedApplicationTypeRows) return cachedApplicationTypeRows;
  for (const typeId of resolveApplicationTypeLookupTypeIds()) {
    try {
      const rows = await listCommerceLookupValues(typeId);
      if (rows.length > 0) {
        cachedApplicationTypeRows = rows;
        return rows;
      }
    } catch {
      /* try next */
    }
  }
  return [];
}

/**
 * Groceries admin: hide categories parented on another application/product type (legacy product_types parent).
 */
export function filterProductCategoryLookupRowsForGroceries(
  rows: CommerceLookupValueDto[],
  applicationTypeRows: CommerceLookupValueDto[]
): CommerceLookupValueDto[] {
  const ownApp = applicationLookupValueIdFromProductTypeId(CATALOG_PRODUCT_TYPE_ID, applicationTypeRows);
  const ownPt = CATALOG_PRODUCT_TYPE_ID.trim();
  const otherAppIds = new Set(
    applicationTypeRows.map((r) => r.id.trim()).filter((id) => id.length > 0 && id !== ownApp)
  );
  const otherPtIds = new Set(
    applicationTypeRows
      .map((r) => (r.parentValueId ?? "").trim())
      .filter((pv) => pv.startsWith("pt_") && pv !== ownPt)
  );
  return rows.filter((r) => {
    const pv = (r.parentValueId ?? "").trim();
    if (!pv) return true;
    if (otherAppIds.has(pv) || otherPtIds.has(pv)) return false;
    return true;
  });
}

export async function loadApplicationTypeRowsForGroceriesAdmin(): Promise<CommerceLookupValueDto[]> {
  return loadApplicationTypeRows();
}

export function filterProductTypeLookupRowsForGroceries(
  rows: CommerceLookupValueDto[],
  configuredProductTypeId: string
): CommerceLookupValueDto[] {
  const ownType = configuredProductTypeId.trim();
  if (!ownType) return rows;
  return rows.filter((r) => r.id.trim() === ownType);
}
