import {
  CATALOG_PRODUCT_TYPE_ID,
  commerceLookupTypeIdForTypePath,
  getCommerceLookupBundle,
  listCommerceLookupValues,
  parseCommerceLookupValueFromApi,
  type CatalogCategoryRow,
  type CommerceLookupBundleDto,
  type CommerceLookupValueDto,
} from "./commerceApi.js";
import {
  applicationLookupValueIdFromProductTypeId,
  resolveApplicationTypeLookupTypeIds,
} from "./applicationTypeLookup.js";
import { sortedCommerceLookupValues } from "./lookupFormBindings.js";

const PRODUCT_DEPARTMENTS_LOOKUP_TYPE_ID = "product_departments";

export type DepartmentHeader = {
  id: string;
  label: string;
  slug: string;
  imageStorageKey: string | null;
};

export type DepartmentBrowseGroup = {
  department: DepartmentHeader;
  categories: CatalogCategoryRow[];
};

function catalogRowToDepartmentHeader(row: CatalogCategoryRow): DepartmentHeader {
  return {
    id: row.id,
    label: row.label.trim() || row.slug,
    slug: row.slug.trim() || row.id,
    imageStorageKey: row.imageStorageKey?.trim() ? row.imageStorageKey.trim() : null,
  };
}

export function rootCategories(cats: CatalogCategoryRow[]): CatalogCategoryRow[] {
  return cats
    .filter((c) => c.parentId == null || c.parentId === "")
    .sort((a, b) => a.sortOrder - b.sortOrder || a.slug.localeCompare(b.slug));
}

function directChildren(cats: CatalogCategoryRow[], parentId: string): CatalogCategoryRow[] {
  return cats
    .filter((c) => c.parentId === parentId)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.slug.localeCompare(b.slug));
}

export function departmentBrowseGroupsMerchandising(cats: CatalogCategoryRow[]): DepartmentBrowseGroup[] {
  return rootCategories(cats).map((department) => {
    const children = directChildren(cats, department.id);
    return {
      department: catalogRowToDepartmentHeader(department),
      categories: children.length > 0 ? children : [department],
    };
  });
}

export function departmentBrowseGroupsByDepartments(
  cats: CatalogCategoryRow[],
  deptValues: CommerceLookupValueDto[]
): DepartmentBrowseGroup[] {
  const sorted = [...deptValues].sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code));
  const out: DepartmentBrowseGroup[] = [];
  for (const d of sorted) {
    const id = d.id.trim();
    const categories = cats
      .filter((c) => c.parentValueId?.trim() === id)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.slug.localeCompare(b.slug));
    if (categories.length === 0) continue;
    const code = (d.code ?? "").trim();
    out.push({
      department: {
        id,
        label: (d.label ?? "").trim() || code || id,
        slug: code || id,
        imageStorageKey: d.imageStorageKey?.trim() ? d.imageStorageKey.trim() : null,
      },
      categories,
    });
  }
  return out;
}

function isDepartmentLookupTypeInBundle(lookupTypeId: string, bundle: CommerceLookupBundleDto): boolean {
  const t = bundle.types?.find((x) => x.id === lookupTypeId);
  if (!t) return false;
  const known = new Set(
    [PRODUCT_DEPARTMENTS_LOOKUP_TYPE_ID, "product_departments", "product_department"]
      .map((k) => k.trim())
      .filter((k) => k.length > 0)
  );
  if (known.has(t.id.trim())) return true;
  const prefix = (t.entryIdPrefix ?? "").trim().toLowerCase();
  if (prefix === "dept_" || prefix === "pd_") return true;
  const title = (t.title ?? "").trim().toLowerCase();
  return title.includes("department");
}

function inferDepartmentRowsFromCategoryParents(
  cats: CatalogCategoryRow[],
  bundle: CommerceLookupBundleDto | null
): CommerceLookupValueDto[] {
  if (!bundle?.valuesByLookupTypeId) return [];
  const parentIds = new Set<string>();
  for (const c of cats) {
    const p = c.parentValueId?.trim();
    if (p) parentIds.add(p);
  }
  if (parentIds.size === 0) return [];
  const byId = new Map<string, CommerceLookupValueDto>();
  for (const [lookupTypeId, slice] of Object.entries(bundle.valuesByLookupTypeId)) {
    if (!isDepartmentLookupTypeInBundle(lookupTypeId, bundle)) continue;
    for (const v of slice ?? []) {
      const row = v as CommerceLookupValueDto;
      const id = row?.id?.trim();
      if (id && parentIds.has(id)) byId.set(id, row);
    }
  }
  return sortedCommerceLookupValues([...byId.values()]);
}

export async function loadApplicationTypeRowsForStorefront(): Promise<CommerceLookupValueDto[]> {
  for (const typeId of resolveApplicationTypeLookupTypeIds()) {
    try {
      const rows = await listCommerceLookupValues(typeId);
      if (rows.length > 0) return sortedCommerceLookupValues(rows);
    } catch {
      /* try next */
    }
  }
  return [];
}

/** Only departments parented on this storefront's application_type row (e.g. saree). */
export function filterDepartmentsForStorefrontApplication(
  deptRows: CommerceLookupValueDto[],
  applicationTypeRows: CommerceLookupValueDto[]
): CommerceLookupValueDto[] {
  const appId = applicationLookupValueIdFromProductTypeId(CATALOG_PRODUCT_TYPE_ID, applicationTypeRows);
  if (!appId) return deptRows;
  return deptRows.filter((d) => (d.parentValueId ?? "").trim() === appId);
}

export async function loadDepartmentRowsForStorefront(): Promise<CommerceLookupValueDto[]> {
  const keys = [
    ...new Set(
      [PRODUCT_DEPARTMENTS_LOOKUP_TYPE_ID, "product_departments", "product_department"]
        .map((k) => commerceLookupTypeIdForTypePath(k))
        .filter((k) => k.length > 0)
    ),
  ];

  for (const lookupTypeId of keys) {
    try {
      const rows = await listCommerceLookupValues(lookupTypeId);
      if (rows.length > 0) return sortedCommerceLookupValues(rows);
    } catch {
      /* try next */
    }
  }

  try {
    const bundle = await getCommerceLookupBundle();
    for (const lookupTypeId of keys) {
      const slice = bundle.valuesByLookupTypeId[lookupTypeId];
      if (slice && slice.length > 0) return sortedCommerceLookupValues(slice as CommerceLookupValueDto[]);
    }
    for (const t of bundle.types ?? []) {
      if (!isDepartmentLookupTypeInBundle(t.id, bundle)) continue;
      const slice = bundle.valuesByLookupTypeId[t.id];
      if (slice && slice.length > 0) return sortedCommerceLookupValues(slice as CommerceLookupValueDto[]);
    }
  } catch {
    /* ignore */
  }

  return [];
}

function mergeDepartmentLookupRowsById(
  primary: CommerceLookupValueDto[],
  secondary: CommerceLookupValueDto[]
): CommerceLookupValueDto[] {
  const map = new Map<string, CommerceLookupValueDto>();
  for (const r of secondary) {
    const id = (r.id ?? "").trim();
    if (id) map.set(id, r);
  }
  for (const r of primary) {
    const id = (r.id ?? "").trim();
    if (id) map.set(id, r);
  }
  return sortedCommerceLookupValues([...map.values()]);
}

function findCommerceLookupValueByIdInBundle(
  bundle: CommerceLookupBundleDto,
  valueId: string
): CommerceLookupValueDto | null {
  const id = valueId.trim();
  if (!id || !bundle.valuesByLookupTypeId) return null;
  for (const [lookupTypeId, slice] of Object.entries(bundle.valuesByLookupTypeId)) {
    for (const raw of slice ?? []) {
      const v = raw as CommerceLookupValueDto;
      if ((v.id ?? "").trim() !== id) continue;
      return parseCommerceLookupValueFromApi({
        ...v,
        id: v.id.trim(),
        lookupTypeId: (v.lookupTypeId ?? lookupTypeId).trim(),
      } as Partial<CommerceLookupValueDto> & { id: string; lookupTypeId: string });
    }
  }
  return null;
}

export function resolveDepartmentRowsForStorefront(
  cats: CatalogCategoryRow[],
  bundle: CommerceLookupBundleDto,
  deptApiRows: CommerceLookupValueDto[]
): CommerceLookupValueDto[] {
  const inferred = inferDepartmentRowsFromCategoryParents(cats, bundle);
  const merged = mergeDepartmentLookupRowsById(deptApiRows, inferred);
  const byId = new Map<string, CommerceLookupValueDto>(merged.map((r) => [(r.id ?? "").trim(), r]));
  for (const c of cats) {
    const pv = c.parentValueId?.trim();
    if (!pv || byId.has(pv)) continue;
    const found = findCommerceLookupValueByIdInBundle(bundle, pv);
    if (found) {
      byId.set(pv, found);
      continue;
    }
    byId.set(pv, {
      id: pv,
      lookupTypeId: PRODUCT_DEPARTMENTS_LOOKUP_TYPE_ID,
      code: pv,
      label: pv,
      sortOrder: 999999,
      parentValueId: null,
      merchandisingParentId: null,
      imageStorageKey: null,
    });
  }
  return sortedCommerceLookupValues([...byId.values()]);
}

export function categoriesForProductRailsMerchandising(
  cats: CatalogCategoryRow[],
  max: number
): CatalogCategoryRow[] {
  const roots = rootCategories(cats);
  const out: CatalogCategoryRow[] = [];
  const seen = new Set<string>();
  for (const r of roots) {
    const ch = directChildren(cats, r.id);
    const targets = ch.length > 0 ? ch : [r];
    for (const c of targets) {
      if (seen.has(c.id)) continue;
      seen.add(c.id);
      out.push(c);
      if (out.length >= max) return out;
    }
  }
  return out;
}

export function categoriesForProductRailsByDepartmentParent(
  cats: CatalogCategoryRow[],
  deptValues: CommerceLookupValueDto[],
  max: number
): CatalogCategoryRow[] {
  const deptOrderedIds = [...deptValues]
    .sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code))
    .map((d) => d.id.trim());
  const out: CatalogCategoryRow[] = [];
  const seen = new Set<string>();
  for (const deptId of deptOrderedIds) {
    for (const c of cats) {
      if (c.parentValueId?.trim() !== deptId) continue;
      if (seen.has(c.id)) continue;
      seen.add(c.id);
      out.push(c);
      if (out.length >= max) return out;
    }
  }
  return out;
}

export function resolveStorefrontDepartmentGroups(
  cats: CatalogCategoryRow[],
  bundle: CommerceLookupBundleDto,
  deptApiRows: CommerceLookupValueDto[],
  applicationTypeRows: CommerceLookupValueDto[]
): { groups: DepartmentBrowseGroup[]; groupedByDepartment: boolean; departmentRows: CommerceLookupValueDto[] } {
  const scopedDepts = filterDepartmentsForStorefrontApplication(deptApiRows, applicationTypeRows);
  const resolvedDeptRows = resolveDepartmentRowsForStorefront(cats, bundle, scopedDepts);
  const deptGroups = departmentBrowseGroupsByDepartments(cats, resolvedDeptRows);
  const merchGroups = departmentBrowseGroupsMerchandising(cats);
  const deptTileCount = deptGroups.reduce((n, g) => n + g.categories.length, 0);
  const merchTileCount = merchGroups.reduce((n, g) => n + g.categories.length, 0);
  const useDeptGrouping =
    deptGroups.length > 0 && deptTileCount >= Math.max(merchTileCount, Math.min(1, cats.length));
  return {
    groups: useDeptGrouping ? deptGroups : merchGroups,
    groupedByDepartment: useDeptGrouping,
    departmentRows: resolvedDeptRows,
  };
}
