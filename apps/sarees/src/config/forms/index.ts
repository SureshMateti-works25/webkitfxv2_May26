import type { FormDefinition } from "@webkitfxv2/core-engine";
import login from "./login.json";
import shopperSignup from "./shopper-signup.json";
import vendorSignup from "./vendor-signup.json";
import searchFilters from "./search-filters.json";
import chromeNotice from "./chrome-notice.json";
import productEngagement from "./product-engagement.json";
import vendorProductCollections from "./vendor-product/collections.json";
import vendorProductEnquiries from "./vendor-product/enquiries.json";
import vendorProductFacets from "./vendor-product/facets.json";
import vendorProductOrders from "./vendor-product/orders.json";
import vendorProductPricing from "./vendor-product/pricing.json";
import vendorProductCore from "./vendor-product/product-core.json";
import vendorProductTax from "./vendor-product/tax.json";
import vendorProductTypeSaree from "./vendor-product/type-saree.json";
import tenantRoleEntry from "./tenant-role-entry.json";
import userRoleAssignment from "./user-role-assignment.json";

export const loginForm = login as FormDefinition;
export const vendorSignupForm = vendorSignup as FormDefinition;
export const shopperSignupForm = shopperSignup as FormDefinition;
export const searchFiltersForm = searchFilters as FormDefinition;
export const chromeNoticeForm = chromeNotice as FormDefinition;
export const productEngagementForm = productEngagement as FormDefinition;

export const vendorProductCoreForm = vendorProductCore as FormDefinition;
export const vendorProductPricingForm = vendorProductPricing as FormDefinition;
export const vendorProductTaxForm = vendorProductTax as FormDefinition;
export const vendorProductCollectionsForm = vendorProductCollections as FormDefinition;
export const vendorProductFacetsForm = vendorProductFacets as FormDefinition;
export const vendorProductEnquiriesForm = vendorProductEnquiries as FormDefinition;
export const vendorProductOrdersForm = vendorProductOrders as FormDefinition;
export const vendorProductTypeSareeForm = vendorProductTypeSaree as FormDefinition;
export const tenantRoleEntryForm = tenantRoleEntry as FormDefinition;
export const userRoleAssignmentForm = userRoleAssignment as FormDefinition;

const formById: Record<string, FormDefinition> = {
  login: loginForm,
  vendorSignup: vendorSignupForm,
  shopperSignup: shopperSignupForm,
  searchFilters: searchFiltersForm,
  chromeNotice: chromeNoticeForm,
  productEngagement: productEngagementForm,
  vendorProductCore: vendorProductCoreForm,
  vendorProductPricing: vendorProductPricingForm,
  vendorProductTax: vendorProductTaxForm,
  vendorProductCollections: vendorProductCollectionsForm,
  vendorProductFacets: vendorProductFacetsForm,
  vendorProductEnquiries: vendorProductEnquiriesForm,
  vendorProductOrders: vendorProductOrdersForm,
  vendorProductTypeSaree: vendorProductTypeSareeForm,
  tenantRoleEntry: tenantRoleEntryForm,
  userRoleAssignment: userRoleAssignmentForm,
};

export function getForm(formId: string): FormDefinition {
  const form = formById[formId];
  if (!form) throw new Error(`Unknown form id: ${formId}`);
  return form;
}
