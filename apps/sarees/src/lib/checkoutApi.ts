import {
  CATALOG_PRODUCT_TYPE_ID,
  commerceTenantHeaders,
  DEFAULT_COMMERCE_TENANT_ID,
} from "./commerceApi.js";
import type { CartLine } from "../cart/CartContext.js";

const BASE =
  (import.meta.env.VITE_COMMERCE_API_URL as string | undefined)?.trim().replace(/\/$/, "") ||
  (import.meta.env.VITE_CATALOG_API_URL as string | undefined)?.trim().replace(/\/$/, "") ||
  (import.meta.env.DEV ? "http://localhost:5055" : "http://localhost:5055");

export type ShippingAddress = {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
};

export type StorefrontOrderLine = {
  id: string;
  productId: string;
  skuId: string | null;
  skuCode: string | null;
  titleDisplay: string;
  vendorCode: string | null;
  quantity: number;
  unitPriceMinor: number;
  currency: string;
  lineTotalMinor: number;
};

export type StorefrontOrder = {
  id: string;
  shopperEmail: string;
  shopperName: string | null;
  shopperPhone: string | null;
  shippingAddress: ShippingAddress | null;
  productTypeId: string;
  status: string;
  paymentMethod: string;
  paymentStatus: string;
  totalMinor: number;
  currency: string;
  placedAt: string;
  lines: StorefrontOrderLine[];
};

export type CheckoutDraft = {
  shopperEmail: string;
  shopperName: string;
  shopperPhone: string;
  shippingAddress: ShippingAddress;
  paymentMethod: "mock_upi" | "mock_card";
};

const DRAFT_KEY = "sarees.checkout.draft.v1";
const LAST_ORDER_EMAIL_KEY = "sarees.checkout.lastOrderEmail";

export function persistLastOrderEmail(email: string): void {
  try {
    sessionStorage.setItem(LAST_ORDER_EMAIL_KEY, email.trim());
  } catch {
    /* private mode */
  }
}

export function readLastOrderEmail(): string {
  try {
    return sessionStorage.getItem(LAST_ORDER_EMAIL_KEY)?.trim() ?? "";
  } catch {
    return "";
  }
}

export function readCheckoutDraft(): CheckoutDraft | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CheckoutDraft;
  } catch {
    return null;
  }
}

export function writeCheckoutDraft(draft: CheckoutDraft): void {
  sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
}

export function clearCheckoutDraft(): void {
  sessionStorage.removeItem(DRAFT_KEY);
}

export async function placeStorefrontOrder(params: {
  draft: CheckoutDraft;
  lines: CartLine[];
  paymentStatus: "captured" | "failed";
  accessToken?: string | null;
}): Promise<StorefrontOrder> {
  const headers: HeadersInit = {
    ...commerceTenantHeaders(),
    "Content-Type": "application/json",
    Accept: "application/json",
    "X-Tenant-Id": DEFAULT_COMMERCE_TENANT_ID,
  };
  if (params.accessToken) headers["Authorization"] = `Bearer ${params.accessToken}`;

  const body = {
    shopperEmail: params.draft.shopperEmail.trim(),
    shopperName: params.draft.shopperName.trim() || undefined,
    shopperPhone: params.draft.shopperPhone.trim() || undefined,
    shippingAddress: params.draft.shippingAddress,
    productTypeId: CATALOG_PRODUCT_TYPE_ID,
    paymentMethod: params.draft.paymentMethod,
    paymentStatus: params.paymentStatus,
    lines: params.lines.map((ln) => ({
      productId: ln.productId,
      skuId: ln.skuId,
      skuCode: ln.skuCode,
      titleDisplay: ln.titleDisplay,
      quantity: ln.quantity,
      unitPriceMinor: ln.unitPriceMinor,
      currency: ln.currency,
    })),
  };

  const res = await fetch(`${BASE}/api/v1/storefront/checkout/place-order`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text.length < 400 ? text : `Checkout failed (${res.status})`);
  }
  return normalizeOrder((await res.json()) as Record<string, unknown>);
}

export async function getStorefrontOrder(orderId: string): Promise<StorefrontOrder | null> {
  const res = await fetch(
    `${BASE}/api/v1/storefront/checkout/orders/${encodeURIComponent(orderId)}`,
    { headers: commerceTenantHeaders() }
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Could not load order (${res.status})`);
  return normalizeOrder((await res.json()) as Record<string, unknown>);
}

export async function listShopperOrders(accessToken: string): Promise<StorefrontOrder[]> {
  const res = await fetch(`${BASE}/api/v1/storefront/checkout/orders`, {
    headers: {
      ...commerceTenantHeaders(),
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!res.ok) throw new Error(`Could not load orders (${res.status})`);
  const raw = (await res.json()) as Record<string, unknown>;
  const items = raw.items ?? raw.Items;
  if (!Array.isArray(items)) return [];
  return items
    .filter((x): x is Record<string, unknown> => x != null && typeof x === "object")
    .map((row) => normalizeOrder(row));
}

function normalizeOrder(row: Record<string, unknown>): StorefrontOrder {
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
    status: String(row.status ?? row.Status ?? ""),
    paymentMethod: String(row.paymentMethod ?? row.PaymentMethod ?? ""),
    paymentStatus: String(row.paymentStatus ?? row.PaymentStatus ?? ""),
    totalMinor: Number(row.totalMinor ?? row.TotalMinor ?? 0),
    currency: String(row.currency ?? row.Currency ?? "INR"),
    placedAt: String(row.placedAt ?? row.PlacedAt ?? ""),
    lines,
    ...(row.fulfillmentStatus != null || row.FulfillmentStatus != null
      ? {
          fulfillmentStatus: String(row.fulfillmentStatus ?? row.FulfillmentStatus ?? ""),
          trackingNote:
            row.trackingNote == null && row.TrackingNote == null
              ? null
              : String(row.trackingNote ?? row.TrackingNote ?? "").trim() || null,
          statusUpdatedAt: String(row.statusUpdatedAt ?? row.StatusUpdatedAt ?? ""),
          trackingTimeline: row.trackingTimeline ?? row.TrackingTimeline,
        }
      : {}),
  } as StorefrontOrder;
}

export function formatMinor(minor: number, currency: string): string {
  const unit = currency.toUpperCase();
  return `${unit} ${(minor / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
