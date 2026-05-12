/**
 * Datamodel for **lookups**: a catalog of lookup *types* and *values* per type.
 *
 * **Parent–child between types** — `LookupTypeDef.parentLookupId` (JSON registry) matches
 * Commerce.Api `parentLookupTypeId` on persisted types. Child types expect each value row to set
 * `parentId` to a parent type row’s `id`.
 *
 * **Parent–child between values** — only on types that declare `parentLookupId`.
 * Root types omit `parentId` or use `null`.
 *
 * **Identifiers** — `LookupTypeDef.id` and `LookupEntry.code` are stable keys (often slug-style).
 * `LookupEntry.id` is a surrogate row id (prefix from `entryIdPrefix` + entropy in demos).
 */

/** Declares one lookup dimension (standalone or child of another lookup type). */
export type LookupTypeDef = {
  /** Stable key, e.g. `regions`, `cities`, `product_categories`. */
  id: string;
  /** Human title for admin UI and docs. */
  title: string;
  description?: string;
  /**
   * When non-null, this type is **dependent**: each `LookupEntry` must carry `parentId`
   * referencing a row in the lookup type with this id.
   */
  parentLookupId: string | null;
  /** Label for the parent selector (e.g. `"Region"`). Meaningful when `parentLookupId` is set. */
  parentFieldLabel?: string;
  /** Prefix for generated row ids in admin flows, e.g. `reg_`, `city_`. */
  entryIdPrefix: string;
};

/** Registry file: ordered list of lookup types (shipped with app or loaded from API). */
export type LookupRegistryFile = {
  version: string;
  lookupTypes: LookupTypeDef[];
};

/**
 * One value row inside a lookup type. Persisted keyed by lookup type id
 * (see `LookupStore`).
 */
export type LookupEntry = {
  /** Surrogate id (unique within tenant / store scope). */
  id: string;
  /** Stable business key; unique per lookup type; often slug or enum code. */
  code: string;
  /** Display label. */
  label: string;
  sortOrder: number;
  /**
   * When the row’s lookup type has `parentLookupId`, this must be the `id` of a row
   * in that parent lookup type. Otherwise omit or `null`.
   */
  parentId?: string | null;
};

/** All value rows for a tenant or scope, keyed by `LookupTypeDef.id`. */
export type LookupStore = Record<string, LookupEntry[]>;

/** Optional metadata bundled with registry + values (seed, export, API). */
export type LookupDataBundleMeta = {
  schemaVersion?: string;
  description?: string;
  tenantId?: string;
};

/**
 * Full snapshot: type definitions plus every lookup’s values.
 * Suitable for fixtures, migrations, or a future `GET /api/v1/lookups/bundle`.
 */
export type LookupDataBundle = {
  meta?: LookupDataBundleMeta;
  registry: LookupRegistryFile;
  valuesByLookupTypeId: LookupStore;
};

/**
 * Same contract as rows in `apps/sarees/src/config/lookups/lookup-form-bindings.json`.
 * Maps a JsonForm (`formId` matches `FormDefinition.id`) + `fieldId` to a Commerce.Api lookup type
 * whose `GET /api/v1/lookups/types/{lookupTypeId}/values` rows populate that `<select>`.
 */
export type LookupFormDropdownBinding = {
  formId: string;
  fieldId: string;
  lookupTypeId: string;
  /** Stored submitted value: row `id` (surrogate) or `code` (slug-style). */
  optionValueKey: "id" | "code";
  placeholderOption?: string;
  label?: string;
  description?: string;
};

export type LookupFormBindingsFile = {
  version: string;
  description?: string;
  bindings: LookupFormDropdownBinding[];
};
