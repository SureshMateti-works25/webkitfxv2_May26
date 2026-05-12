import type { FormDefinition } from "@webkitfxv2/core-engine";
import { vendorProductCoreForm } from "../config/forms/index.js";
import {
  applyLookupResolvedOptionsToForm,
  type ResolvedLookupSelectPatch,
} from "./lookupFormBindings.js";

/**
 * Vendor product core JsonForm with select options filled from
 * {@link ../config/lookups/lookup-form-bindings.json} + Commerce.Api lookup values.
 */
export function vendorProductCoreFormWithResolvedLookups(
  resolved: Record<string, ResolvedLookupSelectPatch>
): FormDefinition {
  return applyLookupResolvedOptionsToForm(vendorProductCoreForm, resolved);
}
