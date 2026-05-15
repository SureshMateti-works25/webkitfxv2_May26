import type { FormDefinition } from "@webkitfxv2/core-engine";
import { vendorProductCoreForm } from "../config/forms/index.js";
import {
  applyLookupResolvedOptionsToForm,
  lookupValuesToFieldOptions,
  type ResolvedLookupSelectPatch,
} from "./lookupFormBindings.js";

export type VendorProductCoreLookupOptions = {
  /** When set, category options prefer rows whose `parent_value_id` equals this department id. */
  productDepartmentId?: string | null;
  /**
   * When categories are parented on `product_types` (legacy), limit categories to this application type id.
   * Ignored when department filtering already applies.
   */
  applicationTypeId?: string | null;
};

function filterCategoryPatch(
  cat: ResolvedLookupSelectPatch,
  predicate: (row: NonNullable<ResolvedLookupSelectPatch["lookupRows"]>[number]) => boolean
): ResolvedLookupSelectPatch {
  const rows = cat.lookupRows ?? [];
  const key = cat.optionValueKey ?? "id";
  const filteredRows = rows.filter(predicate);
  return {
    ...cat,
    options: lookupValuesToFieldOptions(filteredRows, key),
    lookupRows: filteredRows,
  };
}

/**
 * Vendor product core JsonForm with select options filled from
 * {@link ../config/lookups/lookup-form-bindings.json} + Commerce.Api lookup values.
 */
export function vendorProductCoreFormWithResolvedLookups(
  resolved: Record<string, ResolvedLookupSelectPatch>,
  opts?: VendorProductCoreLookupOptions
): FormDefinition {
  const deptId = opts?.productDepartmentId?.trim();
  const appTypeId = opts?.applicationTypeId?.trim();
  let merged = resolved;

  const dept = resolved.productDepartmentId;
  if (appTypeId && dept?.lookupRows?.length) {
    const hasAppLinked = dept.lookupRows.some((r) => r.parentValueId === appTypeId);
    if (hasAppLinked) {
      merged = {
        ...merged,
        productDepartmentId: filterCategoryPatch(dept, (r) => r.parentValueId === appTypeId),
      };
    }
  }

  const cat = resolved.productCategoryId;
  if (cat?.lookupRows?.length) {
    if (deptId) {
      const hasDeptLinked = cat.lookupRows.some((r) => r.parentValueId === deptId);
      if (hasDeptLinked) {
        merged = {
          ...merged,
          productCategoryId: filterCategoryPatch(cat, (r) => r.parentValueId === deptId),
        };
      }
    } else if (appTypeId) {
      const hasTypeLinked = cat.lookupRows.some((r) => r.parentValueId === appTypeId);
      if (hasTypeLinked) {
        merged = {
          ...merged,
          productCategoryId: filterCategoryPatch(cat, (r) => r.parentValueId === appTypeId),
        };
      }
    }
  }

  return applyLookupResolvedOptionsToForm(vendorProductCoreForm, merged);
}

/** Derive department id from a selected category row (parent in `product_departments`). */
export function departmentIdForCategory(
  categoryId: string,
  categoryRows: ResolvedLookupSelectPatch["lookupRows"],
  departmentRows: ResolvedLookupSelectPatch["lookupRows"]
): string {
  const cid = categoryId.trim();
  if (!cid || !categoryRows?.length) return "";
  const cat = categoryRows.find((r) => r.id === cid);
  const parent = cat?.parentValueId?.trim();
  if (!parent) return "";
  if (departmentRows?.some((d) => d.id === parent)) return parent;
  return "";
}
