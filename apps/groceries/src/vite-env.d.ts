/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_COMMERCE_API_URL?: string;
  /** @deprecated Use VITE_COMMERCE_API_URL */
  readonly VITE_CATALOG_API_URL?: string;
  readonly VITE_COMMERCE_TENANT_ID?: string;
  /** Commerce.Api catalog filter; default in app is pt_grocery. */
  readonly VITE_CATALOG_PRODUCT_TYPE_ID?: string;
  /** Lookup type id for department rows; default `product_departments`. Legacy: `VITE_PRODUCT_DEPARTMENT_LOOKUP_TYPE_ID`. */
  readonly VITE_PRODUCT_DEPARTMENTS_LOOKUP_TYPE_ID?: string;
  /** @deprecated Prefer `VITE_PRODUCT_DEPARTMENTS_LOOKUP_TYPE_ID`. */
  readonly VITE_PRODUCT_DEPARTMENT_LOOKUP_TYPE_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
