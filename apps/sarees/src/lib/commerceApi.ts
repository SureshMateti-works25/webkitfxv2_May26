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
};

export type CatalogProductGalleryImage = {
  storageKey: string;
  role: string;
  sortOrder: number;
};

export type CatalogProductDetail = CatalogProductCard & {
  gallery: CatalogProductGalleryImage[];
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
  };
}

function normalizeGalleryImage(row: Record<string, unknown>): CatalogProductGalleryImage {
  return {
    storageKey: String(row.storageKey ?? row.StorageKey ?? ""),
    role: String(row.role ?? row.Role ?? ""),
    sortOrder: Number(row.sortOrder ?? row.SortOrder ?? 0),
  };
}

export function normalizeCatalogProductDetail(row: Record<string, unknown>): CatalogProductDetail {
  const base = normalizeCatalogProductCard(row);
  const gRaw = row.gallery ?? row.Gallery;
  const gallery: CatalogProductGalleryImage[] = Array.isArray(gRaw)
    ? (gRaw as Record<string, unknown>[]).map((x) => normalizeGalleryImage(x))
    : [];
  return { ...base, gallery };
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
