/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_COMMERCE_API_URL?: string;
  /** @deprecated Use VITE_COMMERCE_API_URL */
  readonly VITE_CATALOG_API_URL?: string;
  /** Storefront catalog scope: `application_type` lookup row id (default `app_cafe`). */
  readonly VITE_CATALOG_APPLICATION_TYPE_ID?: string;
  /** @deprecated Use VITE_CATALOG_APPLICATION_TYPE_ID */
  readonly VITE_CATALOG_PRODUCT_TYPE_ID?: string;
  /** Canonical products.product_type_id for orders (default `pt_cafe`). Usually parent of application_type row. */
  readonly VITE_STOREFRONT_PRODUCT_TYPE_ID?: string;
  readonly VITE_APPLICATION_TYPE_LOOKUP_TYPE_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
