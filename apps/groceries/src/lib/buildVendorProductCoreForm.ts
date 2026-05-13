import type { FormDefinition } from "@webkitfxv2/core-engine";
import { vendorProductCoreForm } from "../config/forms/index.js";
import {
  applyLookupResolvedOptionsToForm,
  lookupValuesToFieldOptions,
  type ResolvedLookupSelectPatch,
} from "./lookupFormBindings.js";

export type VendorProductCoreLookupOptions = {
  /**
   * When set, primary category options are limited to rows whose `parent_value_id` equals this id
   * when the lookup type still parents categories on `product_types`. If no category row uses that
   * parent (e.g. parent type is `product_departments`), options stay unfiltered by this id.
   */
  primaryCategoryParentTypeId?: string | null;
};

/**
 * Vendor product core JsonForm with select options filled from
 * {@link ../config/lookups/lookup-form-bindings.json} + Commerce.Api lookup values.
 */
export function vendorProductCoreFormWithResolvedLookups(
  resolved: Record<string, ResolvedLookupSelectPatch>,
  opts?: VendorProductCoreLookupOptions
): FormDefinition {
  const pid = opts?.primaryCategoryParentTypeId?.trim();
  let merged = resolved;
  if (pid && resolved.primaryCategoryId?.lookupRows?.length) {
    const cat = resolved.primaryCategoryId;
    const key = cat.optionValueKey ?? "id";
    const hasLinked = cat.lookupRows.some((r) => r.parentValueId === pid);
    if (hasLinked) {
      const filteredRows = cat.lookupRows.filter((r) => r.parentValueId === pid);
      merged = {
        ...resolved,
        primaryCategoryId: {
          ...cat,
          options: lookupValuesToFieldOptions(filteredRows, key),
          lookupRows: filteredRows,
        },
      };
    }
  }

  return applyLookupResolvedOptionsToForm(vendorProductCoreForm, merged);
}
