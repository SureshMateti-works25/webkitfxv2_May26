import type { FormDefinition } from "@webkitfxv2/core-engine";
import vendorOrderManageForm from "../config/forms/vendor-order-manage.json";
import { getCafeOrderWorkflowsConfig, getCafeVendorAssignableCodes } from "./cafeOrderWorkflows.js";
import {
  applyLookupResolvedOptionsToForm,
  fetchResolvedLookupFieldOptions,
} from "./lookupFormBindings.js";

export const vendorOrderManageFormId = "vendor-order-manage";

function kitchenAssignableStatusCodes(): Set<string> {
  const codes = new Set<string>(getCafeOrderWorkflowsConfig().terminalStatuses);
  for (const ch of getCafeOrderWorkflowsConfig().channels) {
    for (const code of getCafeVendorAssignableCodes(ch.id)) codes.add(code);
  }
  return codes;
}

export async function buildVendorOrderManageForm(): Promise<FormDefinition> {
  const resolved = await fetchResolvedLookupFieldOptions(vendorOrderManageFormId);
  const patch = resolved.fulfillmentStatus;
  if (patch?.options) {
    const allowed = kitchenAssignableStatusCodes();
    patch.options = patch.options.filter((o) => allowed.has(String(o.value)));
  }
  return applyLookupResolvedOptionsToForm(vendorOrderManageForm as FormDefinition, resolved);
}
