import { commerceTenantHeaders, DEFAULT_COMMERCE_TENANT_ID } from "./commerceApi.js";
import { formatMinor } from "./checkoutApi.js";
import type { ShippingAddress, StorefrontOrder, StorefrontOrderLine } from "./checkoutApi.js";

export type { StorefrontOrder, StorefrontOrderLine, ShippingAddress };
export { formatMinor };

const BASE =
  (import.meta.env.VITE_COMMERCE_API_URL as string | undefined)?.trim().replace(/\/$/, "") ||
  (import.meta.env.VITE_CATALOG_API_URL as string | undefined)?.trim().replace(/\/$/, "") ||
  (import.meta.env.DEV ? "http://localhost:5055" : "http://localhost:5055");

export type TrackingTimelineStep = {
  id: string;
  label: string;
  done: boolean;
  current: boolean;
};

export type StorefrontOrderExtended = StorefrontOrder & {
  fulfillmentStatus: string;
  trackingNote: string | null;
  statusUpdatedAt: string;
  trackingTimeline: TrackingTimelineStep[];
};

function authHeaders(token: string): HeadersInit {
  return {
    ...commerceTenantHeaders(),
    Authorization: `Bearer ${token}`,
    "X-Tenant-Id": DEFAULT_COMMERCE_TENANT_ID,
  };
}

export function normalizeOrderExtended(row: Record<string, unknown>): StorefrontOrderExtended {
  const base = normalizeOrderBase(row);
  const timelineRaw = row.trackingTimeline ?? row.TrackingTimeline;
  const trackingTimeline: TrackingTimelineStep[] = Array.isArray(timelineRaw)
    ? (timelineRaw as Record<string, unknown>[]).map((s) => ({
        id: String(s.id ?? s.Id ?? ""),
        label: String(s.label ?? s.Label ?? ""),
        done: Boolean(s.done ?? s.Done),
        current: Boolean(s.current ?? s.Current),
      }))
    : [];

  return {
    ...base,
    fulfillmentStatus: String(row.fulfillmentStatus ?? row.FulfillmentStatus ?? base.status ?? "placed"),
    trackingNote:
      row.trackingNote == null && row.TrackingNote == null
        ? null
        : String(row.trackingNote ?? row.TrackingNote ?? "").trim() || null,
    statusUpdatedAt: String(row.statusUpdatedAt ?? row.StatusUpdatedAt ?? base.placedAt),
    trackingTimeline,
  };
}

function normalizeOrderBase(row: Record<string, unknown>): StorefrontOrder {
  const linesRaw = row.lines ?? row.Lines;
  const lines: StorefrontOrderLine[] = Array.isArray(linesRaw)
    ? (linesRaw as Record<string, unknown>[]).map((ln) => ({
        id: String(ln.id ?? ln.Id ?? ""),
        productId: String(ln.productId ?? ln.ProductId ?? ""),
        skuId: ln.skuId == null ? null : String(ln.skuId ?? ln.SkuId),
        skuCode: ln.skuCode == null ? null : String(ln.skuCode ?? ln.SkuCode),
        titleDisplay: String(ln.titleDisplay ?? ln.TitleDisplay ?? ""),
        vendorCode: ln.vendorCode == null ? null : String(ln.vendorCode ?? ln.VendorCode),
        quantity: Number(ln.quantity ?? ln.Quantity ?? 0),
        unitPriceMinor: Number(ln.unitPriceMinor ?? ln.UnitPriceMinor ?? 0),
        currency: String(ln.currency ?? ln.Currency ?? "INR"),
        lineTotalMinor: Number(ln.lineTotalMinor ?? ln.LineTotalMinor ?? 0),
      }))
    : [];

  const ship = row.shippingAddress ?? row.ShippingAddress;
  let shippingAddress: ShippingAddress | null = null;
  if (ship != null && typeof ship === "object") {
    const s = ship as Record<string, unknown>;
    shippingAddress = {
      line1: String(s.line1 ?? s.Line1 ?? ""),
      line2: s.line2 == null ? undefined : String(s.line2 ?? s.Line2),
      city: String(s.city ?? s.City ?? ""),
      state: String(s.state ?? s.State ?? ""),
      postalCode: String(s.postalCode ?? s.PostalCode ?? ""),
      country: String(s.country ?? s.Country ?? "IN"),
    };
  }

  return {
    id: String(row.id ?? row.Id ?? ""),
    shopperEmail: String(row.shopperEmail ?? row.ShopperEmail ?? ""),
    shopperName: row.shopperName == null ? null : String(row.shopperName ?? row.ShopperName),
    shopperPhone: row.shopperPhone == null ? null : String(row.shopperPhone ?? row.ShopperPhone),
    shippingAddress,
    productTypeId: String(row.productTypeId ?? row.ProductTypeId ?? ""),
    orderChannel:
      row.orderChannel == null && row.OrderChannel == null
        ? null
        : String(row.orderChannel ?? row.OrderChannel ?? "").trim() || null,
    tableCode:
      row.tableCode == null && row.TableCode == null
        ? null
        : String(row.tableCode ?? row.TableCode ?? "").trim() || null,
    status: String(row.status ?? row.Status ?? ""),
    paymentMethod: String(row.paymentMethod ?? row.PaymentMethod ?? ""),
    paymentStatus: String(row.paymentStatus ?? row.PaymentStatus ?? ""),
    totalMinor: Number(row.totalMinor ?? row.TotalMinor ?? 0),
    currency: String(row.currency ?? row.Currency ?? "INR"),
    placedAt: String(row.placedAt ?? row.PlacedAt ?? ""),
    lines,
  };
}

export async function trackStorefrontOrder(
  orderId: string,
  email: string,
  accessToken?: string | null
): Promise<StorefrontOrderExtended> {
  const qs = new URLSearchParams({ email: email.trim() });
  const headers: HeadersInit = { ...commerceTenantHeaders() };
  if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;

  const res = await fetch(
    `${BASE}/api/v1/storefront/checkout/orders/${encodeURIComponent(orderId)}/track?${qs}`,
    { headers }
  );
  if (res.status === 403) throw new Error("Email does not match this order.");
  if (res.status === 404) {
    const text = await res.text();
    if (text.includes("Orders API") || text.includes("<!DOCTYPE"))
      throw new Error(
        "Tracking API not found. Restart Commerce.Api (npm run api:commerce:exec:fresh)."
      );
    throw new Error("Order not found. Check the order ID and checkout email.");
  }
  if (!res.ok) throw new Error(`Could not load tracking (${res.status})`);
  return normalizeOrderExtended((await res.json()) as Record<string, unknown>);
}

export async function listAdminOrders(token: string): Promise<StorefrontOrderExtended[]> {
  const res = await fetch(`${BASE}/api/v1/admin/orders`, { headers: authHeaders(token) });
  if (res.status === 404)
    throw new Error(
      "Orders API not found. Restart Commerce.Api (npm run api:commerce:exec:fresh) and try again."
    );
  if (!res.ok) throw new Error(`Could not load orders (${res.status})`);
  const raw = (await res.json()) as Record<string, unknown>;
  const items = raw.items ?? raw.Items;
  if (!Array.isArray(items)) return [];
  return items
    .filter((x): x is Record<string, unknown> => x != null && typeof x === "object")
    .map((row) => normalizeOrderExtended(row));
}

export async function patchAdminOrder(
  token: string,
  orderId: string,
  body: { fulfillmentStatus?: string; trackingNote?: string }
): Promise<StorefrontOrderExtended> {
  const res = await fetch(`${BASE}/api/v1/admin/orders/${encodeURIComponent(orderId)}`, {
    method: "PATCH",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Could not update order (${res.status})`);
  return normalizeOrderExtended((await res.json()) as Record<string, unknown>);
}

export async function listVendorOrders(token: string): Promise<StorefrontOrderExtended[]> {
  const res = await fetch(`${BASE}/api/v1/vendor/orders`, { headers: authHeaders(token) });
  if (res.status === 404)
    throw new Error(
      "Orders API not found. Restart Commerce.Api (npm run api:commerce:exec:fresh) and try again."
    );
  if (!res.ok) throw new Error(`Could not load orders (${res.status})`);
  const raw = (await res.json()) as Record<string, unknown>;
  const items = raw.items ?? raw.Items;
  if (!Array.isArray(items)) return [];
  return items
    .filter((x): x is Record<string, unknown> => x != null && typeof x === "object")
    .map((row) => normalizeOrderExtended(row));
}

export async function patchVendorOrder(
  token: string,
  orderId: string,
  body: { fulfillmentStatus?: string; trackingNote?: string }
): Promise<StorefrontOrderExtended> {
  const res = await fetch(`${BASE}/api/v1/vendor/orders/${encodeURIComponent(orderId)}`, {
    method: "PATCH",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    try {
      const parsed = JSON.parse(text) as { error?: string };
      if (typeof parsed.error === "string" && parsed.error.trim()) throw new Error(parsed.error);
    } catch (e) {
      if (e instanceof Error && e.message !== text) throw e;
    }
    throw new Error(text.length < 300 ? text : `Could not update order (${res.status})`);
  }
  return normalizeOrderExtended((await res.json()) as Record<string, unknown>);
}
