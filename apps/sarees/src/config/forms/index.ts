import type { FormDefinition } from "@webkitfxv2/core-engine";
import login from "./login.json";
import shopperSignup from "./shopper-signup.json";
import vendorSignup from "./vendor-signup.json";
import vendorProductCollections from "./vendor-product/collections.json";
import vendorProductEnquiries from "./vendor-product/enquiries.json";
import vendorProductFacets from "./vendor-product/facets.json";
import vendorProductOrders from "./vendor-product/orders.json";
import vendorProductPricing from "./vendor-product/pricing.json";
import vendorProductCore from "./vendor-product/product-core.json";
import vendorProductTax from "./vendor-product/tax.json";
import vendorProductTypeSaree from "./vendor-product/type-saree.json";

export const loginForm = login as FormDefinition;
export const vendorSignupForm = vendorSignup as FormDefinition;
export const shopperSignupForm = shopperSignup as FormDefinition;

export const vendorProductCoreForm = vendorProductCore as FormDefinition;
export const vendorProductPricingForm = vendorProductPricing as FormDefinition;
export const vendorProductTaxForm = vendorProductTax as FormDefinition;
export const vendorProductCollectionsForm = vendorProductCollections as FormDefinition;
export const vendorProductFacetsForm = vendorProductFacets as FormDefinition;
export const vendorProductEnquiriesForm = vendorProductEnquiries as FormDefinition;
export const vendorProductOrdersForm = vendorProductOrders as FormDefinition;
export const vendorProductTypeSareeForm = vendorProductTypeSaree as FormDefinition;
