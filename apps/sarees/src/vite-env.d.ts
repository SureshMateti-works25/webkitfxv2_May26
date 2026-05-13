/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_COMMERCE_API_URL?: string;
  /** @deprecated Use VITE_COMMERCE_API_URL */
  readonly VITE_CATALOG_API_URL?: string;
  /** Omit this product type from Nistta storefront catalog (default `pt_grocery`). */
  readonly VITE_STOREFRONT_EXCLUDE_CATALOG_PRODUCT_TYPE_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
