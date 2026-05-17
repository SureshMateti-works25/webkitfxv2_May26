import type { FormDefinition } from "@webkitfxv2/core-engine";
import vendorOrderManageForm from "../config/forms/vendor-order-manage.json";
import {
  applyLookupResolvedOptionsToForm,
  fetchResolvedLookupFieldOptions,
} from "./lookupFormBindings.js";

export const vendorOrderManageFormId = "vendor-order-manage";

export async function buildVendorOrderManageForm(): Promise<FormDefinition> {
  const resolved = await fetchResolvedLookupFieldOptions(vendorOrderManageFormId);
  return applyLookupResolvedOptionsToForm(vendorOrderManageForm as FormDefinition, resolved);
}
