/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_COMMERCE_API_URL?: string;
  /** @deprecated Use VITE_COMMERCE_API_URL */
  readonly VITE_CATALOG_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
