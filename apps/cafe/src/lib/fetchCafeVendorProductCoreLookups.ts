import { listCommerceLookupValues } from "./commerceApi.js";
import {
  APPLICATION_TYPE_LOOKUP_TYPE_ID,
  resolveApplicationTypeLookupTypeIds,
} from "./applicationTypeLookup.js";
import {
  getLookupBindingsForForm,
  lookupValuesToFieldOptions,
  sortedCommerceLookupValues,
  type ResolvedLookupSelectPatch,
} from "./lookupFormBindings.js";

const PRODUCT_DEPARTMENTS_LOOKUP_TYPE_ID = "product_departments";

function bindingLookupTypeId(fieldId: string, fallback: string): string {
  if (fieldId === "applicationTypeId") return APPLICATION_TYPE_LOOKUP_TYPE_ID;
  if (fieldId === "productDepartmentId") return PRODUCT_DEPARTMENTS_LOOKUP_TYPE_ID;
  if (fieldId === "productCategoryId") return "product_categories";
  return fallback;
}

async function loadLookupValuesForBinding(fieldId: string, fallbackTypeId: string) {
  if (fieldId === "applicationTypeId") {
    for (const typeId of resolveApplicationTypeLookupTypeIds()) {
      try {
        const rows = await listCommerceLookupValues(typeId);
        if (rows.length > 0) return rows;
      } catch {
        /* try next */
      }
    }
    return [];
  }
  return listCommerceLookupValues(bindingLookupTypeId(fieldId, fallbackTypeId));
}

export async function fetchCafeVendorProductCoreLookups(): Promise<
  Record<string, ResolvedLookupSelectPatch>
> {
  const out: Record<string, ResolvedLookupSelectPatch> = {};
  for (const b of getLookupBindingsForForm("vendor-product-core")) {
    const rows = await loadLookupValuesForBinding(b.fieldId, b.lookupTypeId);
    const optionValueKey = (b.optionValueKey ?? "id") as "id" | "code";
    const sorted = sortedCommerceLookupValues(rows);
    out[b.fieldId] = {
      options: lookupValuesToFieldOptions(sorted, optionValueKey),
      label: b.label,
      description: b.description,
      placeholderOption: b.placeholderOption,
      lookupRows: sorted,
      optionValueKey,
    };
  }
  return out;
}
