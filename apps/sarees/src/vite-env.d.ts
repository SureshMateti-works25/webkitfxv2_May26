/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_COMMERCE_API_URL?: string;
  /** @deprecated Use VITE_COMMERCE_API_URL */
  readonly VITE_CATALOG_API_URL?: string;
  /** Storefront catalog scope: only this product type (default `pt_saree`). */
  readonly VITE_CATALOG_PRODUCT_TYPE_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
