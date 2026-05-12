/**
 * Base URL for Commerce.Api (auth, catalog, …).
 * - If `VITE_COMMERCE_API_URL` / `VITE_CATALOG_API_URL` is set → use it (direct calls; CORS must allow this Vite origin).
 * - In **dev** with no env → `""` so requests go to `/api/...` and **Vite proxies** to http://127.0.0.1:5055.
 * - Production build without env → `http://localhost:5055` (set `VITE_COMMERCE_API_URL` in real deploys).
 */
const fromEnv =
  (import.meta.env.VITE_COMMERCE_API_URL as string | undefined) ??
  (import.meta.env.VITE_CATALOG_API_URL as string | undefined);
const trimmed = fromEnv?.trim().replace(/\/$/, "");
const BASE =
  trimmed && trimmed.length > 0
    ? trimmed
    : import.meta.env.DEV
      ? ""
      : "http://localhost:5055";

export type AuthSuccess = {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  userId: string;
  email: string;
  role: string;
};

async function parseAuthResponse(res: Response): Promise<AuthSuccess> {
  const data = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    const msg = typeof data.error === "string" ? data.error : `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return {
    accessToken: String(data.accessToken ?? ""),
    tokenType: String(data.tokenType ?? "Bearer"),
    expiresIn: Number(data.expiresIn ?? 0),
    userId: String(data.userId ?? ""),
    email: String(data.email ?? ""),
    role: String(data.role ?? "shopper"),
  };
}

export async function loginWithPassword(email: string, password: string): Promise<AuthSuccess> {
  const res = await fetch(`${BASE}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return parseAuthResponse(res);
}

export type RegisterParams = {
  email: string;
  password: string;
  role: "shopper" | "vendor";
  profile?: Record<string, unknown>;
};

export async function registerAccount(params: RegisterParams): Promise<AuthSuccess> {
  const res = await fetch(`${BASE}/api/v1/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      email: params.email,
      password: params.password,
      role: params.role,
      profile: params.profile ?? undefined,
    }),
  });
  return parseAuthResponse(res);
}

export function getCommerceApiBase(): string {
  return BASE;
}

/** Public URL for a stored media blob (works with Vite `/media` proxy when BASE is empty). */
export function mediaAssetUrl(storageKey: string): string {
  const trimmed = storageKey.trim().replace(/^\/+/, "");
  if (!trimmed) return "/media";
  const path = `/media/${trimmed
    .split("/")
    .filter((s) => s.length > 0)
    .map((p) => encodeURIComponent(p))
    .join("/")}`;
  if (!BASE) return path;
  return `${BASE.replace(/\/$/, "")}${path}`;
}

/** Default tenant for Commerce.Api (header `X-Tenant-Id`). */
export const DEFAULT_COMMERCE_TENANT_ID =
  (import.meta.env.VITE_COMMERCE_TENANT_ID as string | undefined)?.trim() || "t1";

export function commerceAuthorizedHeaders(accessToken: string): HeadersInit {
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    "X-Tenant-Id": DEFAULT_COMMERCE_TENANT_ID,
    Authorization: `Bearer ${accessToken}`,
  };
}

export function commerceTenantHeaders(): HeadersInit {
  return {
    Accept: "application/json",
    "X-Tenant-Id": DEFAULT_COMMERCE_TENANT_ID,
  };
}

async function readCommerceErrorMessage(res: Response): Promise<string> {
  try {
    const text = await res.text();
    if (text) {
      try {
        const data = JSON.parse(text) as {
          error?: string;
          title?: string;
          detail?: string;
          message?: string;
        };
        if (typeof data.error === "string" && data.error.length > 0) return data.error;
        if (typeof data.detail === "string" && data.detail.length > 0) return data.detail;
        if (typeof data.title === "string" && data.title.length > 0) return data.title;
        if (typeof data.message === "string" && data.message.length > 0) return data.message;
      } catch {
        if (text.length > 0 && text.length < 400) return text;
      }
    }
  } catch {
    /* ignore */
  }
  if (res.status === 401)
    return "Not signed in or session expired. Sign in again and retry.";
  if (res.status === 403)
    return "Access denied (403). For product images you must use a vendor account and own that product.";
  return `Request failed (${res.status})`;
}

export type CatalogCategoryRow = {
  id: string;
  parentId: string | null;
  slug: string;
  sortOrder: number;
};

export async function listCatalogCategories(): Promise<CatalogCategoryRow[]> {
  const res = await fetch(`${BASE}/api/v1/catalog/categories`, {
    headers: commerceTenantHeaders(),
  });
  if (!res.ok) throw new Error(await readCommerceErrorMessage(res));
  return (await res.json()) as CatalogCategoryRow[];
}

/** Configurable lookup type (Commerce.Api `lookup_types`). */
export type CommerceLookupTypeDto = {
  id: string;
  title: string;
  description: string | null;
  parentLookupTypeId: string | null;
  parentFieldLabel: string | null;
  entryIdPrefix: string;
};

/** One row in `lookup_values` (parent row lives in the type named by `parentLookupTypeId` on the owning type). */
export type CommerceLookupValueDto = {
  id: string;
  lookupTypeId: string;
  code: string;
  label: string;
  sortOrder: number;
  parentValueId: string | null;
};

export type CommerceLookupBundleDto = {
  version: string;
  types: CommerceLookupTypeDto[];
  valuesByLookupTypeId: Record<string, CommerceLookupValueDto[]>;
};

export async function listCommerceLookupTypes(): Promise<CommerceLookupTypeDto[]> {
  const res = await fetch(`${BASE}/api/v1/lookups/types`, {
    headers: commerceTenantHeaders(),
  });
  if (!res.ok) throw new Error(await readCommerceErrorMessage(res));
  return (await res.json()) as CommerceLookupTypeDto[];
}

export async function listCommerceLookupValues(lookupTypeId: string): Promise<CommerceLookupValueDto[]> {
  const res = await fetch(
    `${BASE}/api/v1/lookups/types/${encodeURIComponent(lookupTypeId.trim())}/values`,
    { headers: commerceTenantHeaders() }
  );
  if (!res.ok) throw new Error(await readCommerceErrorMessage(res));
  return (await res.json()) as CommerceLookupValueDto[];
}

export async function getCommerceLookupBundle(): Promise<CommerceLookupBundleDto> {
  const res = await fetch(`${BASE}/api/v1/lookups/bundle`, {
    headers: commerceTenantHeaders(),
  });
  if (!res.ok) throw new Error(await readCommerceErrorMessage(res));
  return (await res.json()) as CommerceLookupBundleDto;
}

export type UpsertCommerceLookupTypeBody = {
  title: string;
  description?: string | null;
  parentLookupTypeId?: string | null;
  parentFieldLabel?: string | null;
  entryIdPrefix: string;
};

export async function upsertCommerceLookupType(
  accessToken: string,
  lookupTypeId: string,
  body: UpsertCommerceLookupTypeBody
): Promise<CommerceLookupTypeDto> {
  const res = await fetch(
    `${BASE}/api/v1/lookups/types/${encodeURIComponent(lookupTypeId.trim())}`,
    {
      method: "PUT",
      headers: commerceAuthorizedHeaders(accessToken),
      body: JSON.stringify(body),
    }
  );
  if (!res.ok) throw new Error(await readCommerceErrorMessage(res));
  return (await res.json()) as CommerceLookupTypeDto;
}

export async function deleteCommerceLookupType(accessToken: string, lookupTypeId: string): Promise<void> {
  const res = await fetch(
    `${BASE}/api/v1/lookups/types/${encodeURIComponent(lookupTypeId.trim())}`,
    { method: "DELETE", headers: commerceAuthorizedHeaders(accessToken) }
  );
  if (!res.ok) throw new Error(await readCommerceErrorMessage(res));
}

export type CreateCommerceLookupValueBody = {
  code: string;
  label: string;
  sortOrder: number;
  parentValueId?: string | null;
};

export async function createCommerceLookupValue(
  accessToken: string,
  lookupTypeId: string,
  body: CreateCommerceLookupValueBody
): Promise<CommerceLookupValueDto> {
  const res = await fetch(
    `${BASE}/api/v1/lookups/types/${encodeURIComponent(lookupTypeId.trim())}/values`,
    {
      method: "POST",
      headers: commerceAuthorizedHeaders(accessToken),
      body: JSON.stringify(body),
    }
  );
  if (!res.ok) throw new Error(await readCommerceErrorMessage(res));
  return (await res.json()) as CommerceLookupValueDto;
}

export async function deleteCommerceLookupValue(accessToken: string, valueId: string): Promise<void> {
  const res = await fetch(`${BASE}/api/v1/lookups/values/${encodeURIComponent(valueId.trim())}`, {
    method: "DELETE",
    headers: commerceAuthorizedHeaders(accessToken),
  });
  if (!res.ok) throw new Error(await readCommerceErrorMessage(res));
}

/** Merchandising badges on product images (from API / `commerce.merchandising.imageIndicators`). */
export type ProductImageIndicator = {
  kind: string;
  label: string | null;
  placement: string;
};

export type CatalogProductCard = {
  id: string;
  slug: string;
  titleDisplay: string;
  heroStorageKey: string | null;
  minPriceMinor: number | null;
  currency: string | null;
  publishedAt: string | null;
  /** MRP / list price for strike-through when greater than sale (`minPriceMinor`). */
  listPriceMinor: number | null;
  /** When set with an active offer type, shown as the main price; original/MRP struck. */
  offerPriceMinor: number | null;
  offerType: string | null;
  /** Copy shown on cards with the offer pill (e.g. “Pongal 10% off”). */
  offerCardText: string | null;
  /** Corner / edge badges on card imagery. */
  imageIndicators: ProductImageIndicator[];
  /** Storefront vendor code (from commerce JSON or portal id fallback). */
  vendorCode: string | null;
  /** Active SKU codes for this product. */
  skuCodes: string[];
};

export type CatalogProductGalleryImage = {
  storageKey: string;
  role: string;
  sortOrder: number;
  /** When set, media is attached to this SKU (colour variant); storefront can filter angles by selected SKU. */
  skuId?: string | null;
};

export type SkuGalleryFacet = {
  skuId: string;
  skuCode: string;
  swatchStorageKey: string | null;
};

export type CatalogProductDetail = CatalogProductCard & {
  gallery: CatalogProductGalleryImage[];
  /** Angled / variant / hero / gallery roles (excludes colour swatch rail). */
  angleImages: CatalogProductGalleryImage[];
  /** Colour / swatch rail (product-level media with role color|colour|swatch). */
  colorImages: CatalogProductGalleryImage[];
  /** From commerce JSON or portal vendor id fallback. */
  vendorCode: string | null;
  /** From commerce JSON `vendor.displayName` / `businessName` when present. */
  vendorDisplayName: string | null;
  /** Primary (or first) category slug for PDP line copy. */
  primaryCategorySlug: string | null;
  /** Active SKU codes for this product (storefront). */
  skuCodes: string[];
  /** SKUs that have gallery media; when present with skuId on gallery rows, PDP uses colour → angle matrix. */
  skuGalleryFacets: SkuGalleryFacet[];
};

export type ProductEngagementComment = {
  id: string;
  authorName: string | null;
  commentText: string;
  createdAt: string;
};

export type ProductEngagement = {
  viewsCount: number;
  likesCount: number;
  dislikesCount: number;
  ratingsCount: number;
  averageRating: number;
  commentsCount: number;
  recentComments: ProductEngagementComment[];
};

export type CatalogProductsPage = {
  view: string;
  page: number;
  pageSize: number;
  totalCount: number;
  items: CatalogProductCard[];
};

export type ListCatalogProductsParams = {
  page?: number;
  pageSize?: number;
  /** published_desc (default), trending, price_desc, … */
  sort?: string;
  categoryId?: string;
  includeSubtree?: boolean;
  /** Exact product slug (PDP fetch). */
  slug?: string;
  q?: string;
};

function optionalMinorField(row: Record<string, unknown>, camel: string, pascal: string): number | null {
  const v = row[camel] ?? row[pascal];
  if (v == null || v === "") return null;
  if (typeof v === "bigint") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function optionalStringField(row: Record<string, unknown>, camel: string, pascal: string): string | null {
  const v = row[camel] ?? row[pascal];
  if (v == null || v === "") return null;
  return typeof v === "string" ? v : String(v);
}

function normalizeImageIndicators(raw: unknown): ProductImageIndicator[] {
  if (!Array.isArray(raw)) return [];
  const out: ProductImageIndicator[] = [];
  for (const el of raw) {
    if (el == null || typeof el !== "object") continue;
    const o = el as Record<string, unknown>;
    const kind = String(o.kind ?? o.Kind ?? "tag").trim() || "tag";
    const labelRaw = o.label ?? o.Label;
    const label =
      labelRaw == null || labelRaw === ""
        ? null
        : typeof labelRaw === "string"
          ? labelRaw.trim() || null
          : String(labelRaw).trim() || null;
    const placement = String(o.placement ?? o.Placement ?? "top-start").trim() || "top-start";
    out.push({ kind, label, placement });
  }
  return out;
}

export function normalizeCatalogProductCard(row: Record<string, unknown>): CatalogProductCard {
  const hero = row.heroStorageKey ?? row.HeroStorageKey;
  const heroStr =
    hero == null || hero === ""
      ? null
      : typeof hero === "string"
        ? hero
        : String(hero);
  return {
    id: String(row.id ?? row.Id ?? ""),
    slug: String(row.slug ?? row.Slug ?? ""),
    titleDisplay: String(row.titleDisplay ?? row.TitleDisplay ?? ""),
    heroStorageKey: heroStr,
    minPriceMinor:
      row.minPriceMinor != null || row.MinPriceMinor != null
        ? Number(row.minPriceMinor ?? row.MinPriceMinor)
        : null,
    currency: (row.currency ?? row.Currency) == null ? null : String(row.currency ?? row.Currency),
    publishedAt: (row.publishedAt ?? row.PublishedAt) == null ? null : String(row.publishedAt ?? row.PublishedAt),
    listPriceMinor: optionalMinorField(row, "listPriceMinor", "ListPriceMinor"),
    offerPriceMinor: optionalMinorField(row, "offerPriceMinor", "OfferPriceMinor"),
    offerType: optionalStringField(row, "offerType", "OfferType"),
    offerCardText: optionalStringField(row, "offerCardText", "OfferCardText"),
    imageIndicators: normalizeImageIndicators(row.imageIndicators ?? row.ImageIndicators),
    vendorCode: optionalStringField(row, "vendorCode", "VendorCode"),
    skuCodes: normalizeSkuCodes(row.skuCodes ?? row.SkuCodes),
  };
}

function normalizeGalleryImage(row: Record<string, unknown>): CatalogProductGalleryImage {
  const skuRaw = row.skuId ?? row.SkuId;
  const skuId =
    skuRaw == null || skuRaw === ""
      ? null
      : typeof skuRaw === "string"
        ? skuRaw.trim() || null
        : String(skuRaw).trim() || null;
  return {
    storageKey: String(row.storageKey ?? row.StorageKey ?? ""),
    role: String(row.role ?? row.Role ?? ""),
    sortOrder: Number(row.sortOrder ?? row.SortOrder ?? 0),
    skuId,
  };
}

function isColorGalleryRole(role: string): boolean {
  const r = role.trim().toLowerCase();
  return r === "color" || r === "colour" || r === "swatch";
}

/** Client-side split when API omits angleImages/colorImages (older builds or PLP fallback). */
export function splitAngleColorFromGallery(gallery: CatalogProductGalleryImage[]): {
  angleImages: CatalogProductGalleryImage[];
  colorImages: CatalogProductGalleryImage[];
} {
  const colors = gallery.filter((g) => isColorGalleryRole(g.role));
  const angles = gallery.filter((g) => !isColorGalleryRole(g.role));
  if (angles.length === 0 && colors.length > 0)
    return { angleImages: colors, colorImages: [] };
  return { angleImages: angles, colorImages: colors };
}

function normalizeGalleryArray(raw: unknown): CatalogProductGalleryImage[] {
  if (!Array.isArray(raw)) return [];
  return (raw as Record<string, unknown>[]).map((x) => normalizeGalleryImage(x));
}

function normalizeSkuGalleryFacets(raw: unknown): SkuGalleryFacet[] {
  if (!Array.isArray(raw)) return [];
  const out: SkuGalleryFacet[] = [];
  for (const el of raw) {
    if (el == null || typeof el !== "object") continue;
    const o = el as Record<string, unknown>;
    const skuId = String(o.skuId ?? o.SkuId ?? "").trim();
    if (!skuId) continue;
    const skuCode = String(o.skuCode ?? o.SkuCode ?? "").trim() || skuId;
    const sw = o.swatchStorageKey ?? o.SwatchStorageKey;
    const swatchStorageKey =
      sw == null || sw === "" ? null : typeof sw === "string" ? sw.trim() || null : String(sw).trim() || null;
    out.push({ skuId, skuCode, swatchStorageKey });
  }
  return out;
}

function normalizeSkuCodes(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const el of raw) {
    if (typeof el === "string") {
      const t = el.trim();
      if (t) out.push(t);
      continue;
    }
    if (el != null && typeof el === "object") {
      const o = el as Record<string, unknown>;
      const code = o.skuCode ?? o.SkuCode;
      if (code != null && String(code).trim()) out.push(String(code).trim());
    }
  }
  return out;
}

export function normalizeCatalogProductDetail(row: Record<string, unknown>): CatalogProductDetail {
  const base = normalizeCatalogProductCard(row);
  const gallery = normalizeGalleryArray(row.gallery ?? row.Gallery);
  let angleImages = normalizeGalleryArray(row.angleImages ?? row.AngleImages);
  let colorImages = normalizeGalleryArray(row.colorImages ?? row.ColorImages);

  if (gallery.length > 0 && angleImages.length === 0 && colorImages.length === 0) {
    const split = splitAngleColorFromGallery(gallery);
    angleImages = split.angleImages;
    colorImages = split.colorImages;
  }

  return {
    ...base,
    gallery,
    angleImages,
    colorImages,
    vendorCode: optionalStringField(row, "vendorCode", "VendorCode"),
    vendorDisplayName: optionalStringField(row, "vendorDisplayName", "VendorDisplayName"),
    primaryCategorySlug: optionalStringField(row, "primaryCategorySlug", "PrimaryCategorySlug"),
    skuCodes: normalizeSkuCodes(row.skuCodes ?? row.SkuCodes),
    skuGalleryFacets: normalizeSkuGalleryFacets(row.skuGalleryFacets ?? row.SkuGalleryFacets),
  };
}

export async function getCatalogProductDetail(params: {
  slug?: string;
  id?: string;
}): Promise<CatalogProductDetail | null> {
  const slug = params.slug?.trim();
  const id = params.id?.trim();
  if (!slug && !id) throw new Error("getCatalogProductDetail: slug or id required");
  const qs = new URLSearchParams();
  if (id) qs.set("id", id);
  else if (slug) qs.set("slug", slug);
  const res = await fetch(`${BASE}/api/v1/catalog/product-detail?${qs}`, {
    headers: commerceTenantHeaders(),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(await readCommerceErrorMessage(res));
  const raw = (await res.json()) as Record<string, unknown>;
  return normalizeCatalogProductDetail(raw);
}

export type CommerceSponsoredProductPublic = {
  id: string;
  productId: string;
  slug: string;
  titleDisplay: string;
  heroStorageKey: string | null;
  minPriceMinor: number | null;
  currency: string | null;
  label: string | null;
  sortOrder: number;
};

export type CommerceSponsoredProductAdmin = {
  id: string;
  productId: string;
  slug: string;
  titleDisplay: string;
  status: string;
  label: string | null;
  sortOrder: number;
  isActive: boolean;
};

function normalizeSponsoredPublic(o: Record<string, unknown>): CommerceSponsoredProductPublic {
  return {
    id: String(o.id ?? o.Id ?? ""),
    productId: String(o.productId ?? o.ProductId ?? ""),
    slug: String(o.slug ?? o.Slug ?? ""),
    titleDisplay: String(o.titleDisplay ?? o.TitleDisplay ?? ""),
    heroStorageKey: (o.heroStorageKey ?? o.HeroStorageKey) == null ? null : String(o.heroStorageKey ?? o.HeroStorageKey),
    minPriceMinor:
      o.minPriceMinor == null && o.MinPriceMinor == null
        ? null
        : Number(o.minPriceMinor ?? o.MinPriceMinor),
    currency: (o.currency ?? o.Currency) == null ? null : String(o.currency ?? o.Currency),
    label: (o.label ?? o.Label) == null ? null : String(o.label ?? o.Label),
    sortOrder: Number(o.sortOrder ?? o.SortOrder ?? 0),
  };
}

function normalizeSponsoredAdmin(o: Record<string, unknown>): CommerceSponsoredProductAdmin {
  return {
    id: String(o.id ?? o.Id ?? ""),
    productId: String(o.productId ?? o.ProductId ?? ""),
    slug: String(o.slug ?? o.Slug ?? ""),
    titleDisplay: String(o.titleDisplay ?? o.TitleDisplay ?? ""),
    status: String(o.status ?? o.Status ?? ""),
    label: (o.label ?? o.Label) == null ? null : String(o.label ?? o.Label),
    sortOrder: Number(o.sortOrder ?? o.SortOrder ?? 0),
    isActive: Boolean(o.isActive ?? o.IsActive ?? false),
  };
}

/** Storefront sponsored placements (active products only). */
export async function listCommerceSponsoredStorefront(): Promise<CommerceSponsoredProductPublic[]> {
  const res = await fetch(`${BASE}/api/v1/catalog/sponsored-products`, {
    headers: commerceTenantHeaders(),
  });
  if (!res.ok) throw new Error(await readCommerceErrorMessage(res));
  const arr = (await res.json()) as unknown[];
  if (!Array.isArray(arr)) return [];
  return arr.map((x) => normalizeSponsoredPublic(x as Record<string, unknown>));
}

export async function listCommerceSponsoredAdmin(accessToken: string): Promise<CommerceSponsoredProductAdmin[]> {
  const res = await fetch(`${BASE}/api/v1/admin/storefront-sponsored-products`, {
    headers: commerceAuthorizedHeaders(accessToken),
  });
  if (!res.ok) throw new Error(await readCommerceErrorMessage(res));
  const arr = (await res.json()) as unknown[];
  if (!Array.isArray(arr)) return [];
  return arr.map((x) => normalizeSponsoredAdmin(x as Record<string, unknown>));
}

export async function createCommerceSponsoredAdmin(
  accessToken: string,
  body: { productId: string; label?: string; sortOrder?: number; isActive?: boolean }
): Promise<CommerceSponsoredProductAdmin> {
  const res = await fetch(`${BASE}/api/v1/admin/storefront-sponsored-products`, {
    method: "POST",
    headers: commerceAuthorizedHeaders(accessToken),
    body: JSON.stringify({
      productId: body.productId.trim(),
      label: body.label?.trim() || undefined,
      sortOrder: body.sortOrder ?? 0,
      isActive: body.isActive,
    }),
  });
  if (!res.ok) throw new Error(await readCommerceErrorMessage(res));
  return normalizeSponsoredAdmin((await res.json()) as Record<string, unknown>);
}

export async function updateCommerceSponsoredAdmin(
  accessToken: string,
  sponsoredId: string,
  body: { label?: string | null; sortOrder?: number; isActive?: boolean }
): Promise<CommerceSponsoredProductAdmin> {
  const res = await fetch(
    `${BASE}/api/v1/admin/storefront-sponsored-products/${encodeURIComponent(sponsoredId.trim())}`,
    {
      method: "PUT",
      headers: commerceAuthorizedHeaders(accessToken),
      body: JSON.stringify(body),
    }
  );
  if (!res.ok) throw new Error(await readCommerceErrorMessage(res));
  return normalizeSponsoredAdmin((await res.json()) as Record<string, unknown>);
}

export async function deleteCommerceSponsoredAdmin(accessToken: string, sponsoredId: string): Promise<void> {
  const res = await fetch(
    `${BASE}/api/v1/admin/storefront-sponsored-products/${encodeURIComponent(sponsoredId.trim())}`,
    { method: "DELETE", headers: commerceAuthorizedHeaders(accessToken) }
  );
  if (!res.ok) throw new Error(await readCommerceErrorMessage(res));
}

/**
 * PDP loader: prefers `GET /catalog/product-detail`, then falls back to `GET /catalog/products?slug=…`
 * so the storefront still opens PDP when an older Commerce.Api build omits the detail route or returns 404.
 */
export async function resolveCatalogProductDetail(lookupKey: string): Promise<CatalogProductDetail | null> {
  const key = lookupKey.trim();
  if (!key) return null;

  const direct = (await getCatalogProductDetail({ slug: key })) ?? (await getCatalogProductDetail({ id: key }));
  if (direct) return direct;

  const page = await listCatalogProducts({ slug: key, pageSize: 1, page: 1 });
  const card = page.items[0];
  if (!card) return null;

  const gallery: CatalogProductGalleryImage[] =
    card.heroStorageKey != null && card.heroStorageKey.length > 0
      ? [{ storageKey: card.heroStorageKey, role: "hero", sortOrder: 0, skuId: null }]
      : [];
  const split = splitAngleColorFromGallery(gallery);

  return {
    ...card,
    gallery,
    angleImages: split.angleImages,
    colorImages: split.colorImages,
    vendorCode: card.vendorCode,
    vendorDisplayName: null,
    primaryCategorySlug: null,
    skuCodes: card.skuCodes?.length ? [...card.skuCodes] : [],
    skuGalleryFacets: [],
  };
}

export async function getProductEngagement(productId: string): Promise<ProductEngagement> {
  const res = await fetch(`${BASE}/api/v1/catalog/products/${encodeURIComponent(productId.trim())}/engagement`, {
    headers: commerceTenantHeaders(),
  });
  if (!res.ok) throw new Error(await readCommerceErrorMessage(res));
  const raw = (await res.json()) as Record<string, unknown>;
  return {
    viewsCount: Number(raw.viewsCount ?? raw.ViewsCount ?? 0),
    likesCount: Number(raw.likesCount ?? raw.LikesCount ?? 0),
    dislikesCount: Number(raw.dislikesCount ?? raw.DislikesCount ?? 0),
    ratingsCount: Number(raw.ratingsCount ?? raw.RatingsCount ?? 0),
    averageRating: Number(raw.averageRating ?? raw.AverageRating ?? 0),
    commentsCount: Number(raw.commentsCount ?? raw.CommentsCount ?? 0),
    recentComments: Array.isArray(raw.recentComments ?? raw.RecentComments)
      ? (raw.recentComments ?? raw.RecentComments).map((c: unknown) => {
          const o = c as Record<string, unknown>;
          return {
            id: String(o.id ?? o.Id ?? ""),
            authorName: (o.authorName ?? o.AuthorName) == null ? null : String(o.authorName ?? o.AuthorName),
            commentText: String(o.commentText ?? o.CommentText ?? ""),
            createdAt: String(o.createdAt ?? o.CreatedAt ?? ""),
          };
        })
      : [],
  };
}

export async function trackProductView(productId: string): Promise<void> {
  const res = await fetch(`${BASE}/api/v1/catalog/products/${encodeURIComponent(productId.trim())}/view`, {
    method: "POST",
    headers: commerceTenantHeaders(),
  });
  if (!res.ok) throw new Error(await readCommerceErrorMessage(res));
}

export async function incrementProductLike(productId: string): Promise<void> {
  const res = await fetch(`${BASE}/api/v1/catalog/products/${encodeURIComponent(productId.trim())}/like`, {
    method: "POST",
    headers: commerceTenantHeaders(),
  });
  if (!res.ok) throw new Error(await readCommerceErrorMessage(res));
}

export async function incrementProductDislike(productId: string): Promise<void> {
  const res = await fetch(`${BASE}/api/v1/catalog/products/${encodeURIComponent(productId.trim())}/dislike`, {
    method: "POST",
    headers: commerceTenantHeaders(),
  });
  if (!res.ok) throw new Error(await readCommerceErrorMessage(res));
}

export async function addProductRating(params: {
  productId: string;
  score: number;
  authorName?: string;
  commentText?: string;
}): Promise<void> {
  const res = await fetch(
    `${BASE}/api/v1/catalog/products/${encodeURIComponent(params.productId.trim())}/ratings`,
    {
      method: "POST",
      headers: { ...commerceTenantHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({
        score: params.score,
        authorName: params.authorName?.trim() || undefined,
        commentText: params.commentText?.trim() || undefined,
      }),
    }
  );
  if (!res.ok) throw new Error(await readCommerceErrorMessage(res));
}

export async function addProductComment(params: {
  productId: string;
  commentText: string;
  authorName?: string;
}): Promise<void> {
  const res = await fetch(
    `${BASE}/api/v1/catalog/products/${encodeURIComponent(params.productId.trim())}/comments`,
    {
      method: "POST",
      headers: { ...commerceTenantHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({
        commentText: params.commentText.trim(),
        authorName: params.authorName?.trim() || undefined,
      }),
    }
  );
  if (!res.ok) throw new Error(await readCommerceErrorMessage(res));
}

export async function listCatalogProducts(params?: ListCatalogProductsParams): Promise<CatalogProductsPage> {
  const qs = new URLSearchParams();
  qs.set("view", "card");
  if (params?.page != null) qs.set("page", String(params.page));
  if (params?.pageSize != null) qs.set("pageSize", String(params.pageSize));
  if (params?.sort?.trim()) qs.set("sort", params.sort.trim());
  if (params?.categoryId?.trim()) qs.set("categoryId", params.categoryId.trim());
  if (params?.includeSubtree) qs.set("includeSubtree", "true");
  if (params?.slug?.trim()) qs.set("slug", params.slug.trim());
  if (params?.q?.trim()) qs.set("q", params.q.trim());
  const res = await fetch(`${BASE}/api/v1/catalog/products?${qs}`, {
    headers: commerceTenantHeaders(),
  });
  if (!res.ok) throw new Error(await readCommerceErrorMessage(res));
  const raw = (await res.json()) as Record<string, unknown>;
  const itemsRaw = raw.items ?? raw.Items;
  const items: CatalogProductCard[] = Array.isArray(itemsRaw)
    ? (itemsRaw as Record<string, unknown>[]).map(normalizeCatalogProductCard)
    : [];
  return {
    view: String(raw.view ?? raw.View ?? "card"),
    page: Number(raw.page ?? raw.Page ?? 1),
    pageSize: Number(raw.pageSize ?? raw.PageSize ?? 0),
    totalCount: Number(raw.totalCount ?? raw.TotalCount ?? 0),
    items,
  };
}

export type VendorProductListItem = {
  id: string;
  slug: string;
  titleDisplay: string;
  status: string;
  heroStorageKey: string | null;
  minPriceMinor: number | null;
  currency: string | null;
  publishedAt: string | null;
  listPriceMinor: number | null;
  offerPriceMinor: number | null;
  offerType: string | null;
  offerCardText: string | null;
  imageIndicators: ProductImageIndicator[];
  vendorCode: string | null;
  skuCodes: string[];
};

export type VendorProductsPage = {
  page: number;
  pageSize: number;
  totalCount: number;
  items: VendorProductListItem[];
};

function normalizeVendorListItem(row: Record<string, unknown>): VendorProductListItem {
  const hero = row.heroStorageKey ?? row.HeroStorageKey;
  const heroStr =
    hero == null || hero === "" ? null : typeof hero === "string" ? hero : String(hero);
  return {
    id: String(row.id ?? row.Id ?? ""),
    slug: String(row.slug ?? row.Slug ?? ""),
    titleDisplay: String(row.titleDisplay ?? row.TitleDisplay ?? ""),
    status: String(row.status ?? row.Status ?? ""),
    heroStorageKey: heroStr,
    minPriceMinor:
      row.minPriceMinor != null || row.MinPriceMinor != null
        ? Number(row.minPriceMinor ?? row.MinPriceMinor)
        : null,
    currency: (row.currency ?? row.Currency) == null ? null : String(row.currency ?? row.Currency),
    publishedAt: (row.publishedAt ?? row.PublishedAt) == null ? null : String(row.publishedAt ?? row.PublishedAt),
    listPriceMinor: optionalMinorField(row, "listPriceMinor", "ListPriceMinor"),
    offerPriceMinor: optionalMinorField(row, "offerPriceMinor", "OfferPriceMinor"),
    offerType: optionalStringField(row, "offerType", "OfferType"),
    offerCardText: optionalStringField(row, "offerCardText", "OfferCardText"),
    imageIndicators: normalizeImageIndicators(row.imageIndicators ?? row.ImageIndicators),
    vendorCode: optionalStringField(row, "vendorCode", "VendorCode"),
    skuCodes: normalizeSkuCodes(row.skuCodes ?? row.SkuCodes),
  };
}

export async function listVendorProducts(
  accessToken: string,
  page = 1,
  pageSize = 48
): Promise<VendorProductsPage> {
  const q = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });
  const res = await fetch(`${BASE}/api/v1/vendor/products?${q}`, {
    headers: commerceAuthorizedHeaders(accessToken),
  });
  if (!res.ok) throw new Error(await readCommerceErrorMessage(res));
  const raw = (await res.json()) as Record<string, unknown>;
  const itemsRaw = raw.items ?? raw.Items;
  const items: VendorProductListItem[] = Array.isArray(itemsRaw)
    ? (itemsRaw as Record<string, unknown>[]).map(normalizeVendorListItem)
    : [];
  return {
    page: Number(raw.page ?? raw.Page ?? 1),
    pageSize: Number(raw.pageSize ?? raw.PageSize ?? 0),
    totalCount: Number(raw.totalCount ?? raw.TotalCount ?? 0),
    items,
  };
}

export type VendorProductDetail = {
  id: string;
  slug: string;
  titleDisplay: string;
  status: string;
  publishedAt: string | null;
  heroStorageKey: string | null;
  minPriceMinor: number | null;
  currency: string | null;
  primaryCategoryId: string | null;
};

export async function getVendorProduct(
  accessToken: string,
  productId: string
): Promise<VendorProductDetail> {
  const res = await fetch(`${BASE}/api/v1/vendor/products/${encodeURIComponent(productId)}`, {
    headers: commerceAuthorizedHeaders(accessToken),
  });
  if (!res.ok) throw new Error(await readCommerceErrorMessage(res));
  return (await res.json()) as VendorProductDetail;
}

/** Same payload as public catalog product-detail, including angle/colour gallery split (drafts allowed for owner). */
export async function getVendorProductStorefrontDetail(
  accessToken: string,
  productId: string
): Promise<CatalogProductDetail | null> {
  const res = await fetch(
    `${BASE}/api/v1/vendor/products/${encodeURIComponent(productId)}/storefront`,
    {
      headers: commerceAuthorizedHeaders(accessToken),
    }
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(await readCommerceErrorMessage(res));
  const raw = (await res.json()) as Record<string, unknown>;
  return normalizeCatalogProductDetail(raw);
}

export type VendorProductWrite = {
  title: string;
  slug?: string;
  status: "draft" | "active";
  categoryId?: string;
  productTypeId?: string;
  minPriceMinor?: number | null;
  currency?: string;
};

export async function createVendorProduct(
  accessToken: string,
  body: VendorProductWrite
): Promise<{ id: string }> {
  const res = await fetch(`${BASE}/api/v1/vendor/products`, {
    method: "POST",
    headers: commerceAuthorizedHeaders(accessToken),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await readCommerceErrorMessage(res));
  const data = (await res.json()) as { id?: string };
  if (!data.id) throw new Error("Create succeeded but no product id returned.");
  return { id: data.id };
}

export async function updateVendorProduct(
  accessToken: string,
  productId: string,
  body: Partial<VendorProductWrite> & { categoryId?: string }
): Promise<void> {
  const res = await fetch(`${BASE}/api/v1/vendor/products/${encodeURIComponent(productId)}`, {
    method: "PUT",
    headers: commerceAuthorizedHeaders(accessToken),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await readCommerceErrorMessage(res));
}

export async function deleteVendorProduct(accessToken: string, productId: string): Promise<void> {
  const res = await fetch(`${BASE}/api/v1/vendor/products/${encodeURIComponent(productId)}`, {
    method: "DELETE",
    headers: commerceAuthorizedHeaders(accessToken),
  });
  if (!res.ok) throw new Error(await readCommerceErrorMessage(res));
}

export type VendorWorkspaceSku = {
  id: string;
  skuCode: string;
  barcode: string | null;
  status: string;
  listPriceMinor: number | null;
  compareAtPriceMinor: number | null;
};

export type VendorWorkspaceMedia = {
  id: string;
  mediaAssetId: string;
  /** When set, image applies to this SKU only; when null/undefined, product-level. */
  skuId?: string | null;
  role: string;
  sortOrder: number;
  storageKey: string;
  mimeType: string;
};

export type VendorWorkspaceInventory = {
  id: string;
  skuId: string;
  locationId: string;
  code: string;
  name: string;
  onHand: number;
  reserved: number;
};

export type VendorWorkspaceLocation = {
  id: string;
  code: string;
  name: string;
  type: string;
};

export type VendorProductWorkspace = {
  core: Record<string, unknown>;
  collections: { idsCsv?: string };
  attributes: Record<string, string>;
  commerce: Record<string, unknown>;
  skus: VendorWorkspaceSku[];
  media: VendorWorkspaceMedia[];
  inventory: VendorWorkspaceInventory[];
  locations: VendorWorkspaceLocation[];
};

function normalizeVendorWorkspacePayload(data: Record<string, unknown>): VendorProductWorkspace {
  const mediaRaw = data.media;
  const media: VendorWorkspaceMedia[] = Array.isArray(mediaRaw)
    ? mediaRaw.map((row: unknown) => {
        const r = row as Record<string, unknown>;
        const skuVal = r.skuId ?? r.SkuId;
        return {
          id: String(r.id ?? r.Id ?? ""),
          mediaAssetId: String(r.mediaAssetId ?? r.MediaAssetId ?? ""),
          skuId: skuVal == null || skuVal === "" ? null : String(skuVal),
          role: String(r.role ?? r.Role ?? ""),
          sortOrder: Number(r.sortOrder ?? r.SortOrder ?? 0),
          storageKey: String(r.storageKey ?? r.StorageKey ?? ""),
          mimeType: String(r.mimeType ?? r.MimeType ?? ""),
        };
      })
    : [];

  return { ...(data as Omit<VendorProductWorkspace, "media">), media };
}

export async function getVendorProductWorkspace(
  accessToken: string,
  productId: string
): Promise<VendorProductWorkspace> {
  const res = await fetch(
    `${BASE}/api/v1/vendor/products/${encodeURIComponent(productId)}/workspace`,
    { headers: commerceAuthorizedHeaders(accessToken) }
  );
  if (!res.ok) throw new Error(await readCommerceErrorMessage(res));
  const raw = (await res.json()) as Record<string, unknown>;
  return normalizeVendorWorkspacePayload(raw);
}

export type VendorWorkspacePut = {
  core?: Record<string, unknown>;
  commercePatch?: Record<string, unknown>;
  collectionIds?: string[];
  attributes?: Record<string, string>;
  skus?: Array<{
    id?: string;
    skuCode?: string;
    barcode?: string;
    status?: string;
    listPriceMinor?: number | null;
    compareAtPriceMinor?: number | null;
  }>;
  inventory?: Array<{
    skuId?: string;
    locationId?: string;
    onHand: number;
    reserved?: number;
  }>;
};

export async function putVendorProductWorkspace(
  accessToken: string,
  productId: string,
  body: VendorWorkspacePut
): Promise<void> {
  const res = await fetch(
    `${BASE}/api/v1/vendor/products/${encodeURIComponent(productId)}/workspace`,
    {
      method: "PUT",
      headers: commerceAuthorizedHeaders(accessToken),
      body: JSON.stringify(body),
    }
  );
  if (!res.ok) throw new Error(await readCommerceErrorMessage(res));
}

export type UploadProductMediaResult = {
  id: string;
  storageKey: string;
  publicUrl: string;
};

/** Multipart upload; links to product (and optional SKU). Requires vendor JWT and product ownership. */
export async function uploadVendorProductMedia(
  accessToken: string,
  productId: string,
  file: File,
  options?: { role?: string; skuId?: string | null }
): Promise<UploadProductMediaResult> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("productId", productId);
  const role = options?.role?.trim();
  if (role) fd.append("role", role);
  const sid = options?.skuId?.trim();
  if (sid) fd.append("skuId", sid);

  const headers: HeadersInit = {
    Accept: "application/json",
    "X-Tenant-Id": DEFAULT_COMMERCE_TENANT_ID,
    Authorization: `Bearer ${accessToken}`,
  };

  const res = await fetch(`${BASE}/api/v1/media/assets`, {
    method: "POST",
    headers,
    body: fd,
  });
  if (!res.ok) throw new Error(await readCommerceErrorMessage(res));
  const data = (await res.json()) as {
    id?: string;
    storageKey?: string;
    PublicUrl?: string;
    publicUrl?: string;
  };
  const id = data.id ?? "";
  const storageKey = data.storageKey ?? "";
  const publicUrl = data.publicUrl ?? data.PublicUrl ?? `/media/${storageKey}`;
  if (!id || !storageKey) throw new Error("Upload succeeded but response was incomplete.");
  return { id, storageKey, publicUrl };
}

/** Backend URL for messages (when using dev proxy, API is still on 5055). */
const apiTargetLabel = BASE || "http://127.0.0.1:5055 (via Vite /api proxy)";

/** User-visible message for fetch / JSON failures against Commerce.Api */
export function formatCommerceApiError(error: unknown): string {
  if (error instanceof TypeError && /fetch|network|failed/i.test(String(error.message))) {
    return [
      `Cannot reach Commerce.Api (${apiTargetLabel}).`,
      "1) Start **Docker Desktop**.",
      "2) From repo root: `docker compose -f services/commerce-api/docker-compose.yml up -d`",
      "3) Start API: `npm run api:commerce:exec` (or `npm run api:commerce` if that works on your machine).",
      "4) Refresh this app. Optional: set `VITE_COMMERCE_API_URL` in `.env` to skip the proxy."
    ].join(" ");
  }
  if (error instanceof Error) return error.message;
  return "Something went wrong. Please try again.";
}
