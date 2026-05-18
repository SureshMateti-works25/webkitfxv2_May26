import type { StorefrontOrderExtended } from "./ordersApi.js";

/** Resolve table number for KDS from order field or legacy tracking note. */
export function resolveOrderTableCode(order: {
  tableCode?: string | null;
  trackingNote?: string | null;
}): string | null {
  const direct = (order.tableCode ?? "").trim();
  if (direct) return direct;

  const note = (order.trackingNote ?? "").trim();
  if (!note) return null;

  const tagged = note.match(/(?:^|\s)table\s*[#:]?\s*([A-Za-z0-9-]+)/i);
  if (tagged?.[1]) return tagged[1].trim();

  const tPrefix = note.match(/^T(\d+[A-Za-z]?)\b/i);
  if (tPrefix?.[1]) return tPrefix[1].trim();

  return null;
}

export function formatOrderTableLabel(
  order: Parameters<typeof resolveOrderTableCode>[0],
  fallback = "—"
): string {
  const code = resolveOrderTableCode(order);
  if (!code) return fallback;
  return code.match(/^\d+$/) ? `Table ${code}` : code;
}

export function formatPaymentStatusLabel(status: string | null | undefined): string {
  const s = (status ?? "").trim().toLowerCase();
  if (s === "pending" || s === "pay_at_table") return "Pay at table";
  if (s === "captured") return "Paid";
  if (s === "failed") return "Payment failed";
  return s || "—";
}

export function orderChannelLabel(channel: string | null | undefined): string {
  const c = (channel ?? "").trim().toLowerCase();
  if (c === "qr") return "QR";
  if (c === "aggregator") return "Aggregator";
  if (c === "dine_in") return "Dine-in";
  return c || "—";
}

export type KdsOrderMeta = StorefrontOrderExtended & {
  displayTableCode: string | null;
  displayTableLabel: string;
  displayChannelLabel: string;
};

export function enrichOrderForKds(order: StorefrontOrderExtended): KdsOrderMeta {
  const displayTableCode = resolveOrderTableCode(order);
  return {
    ...order,
    displayTableCode,
    displayTableLabel: displayTableCode
      ? displayTableCode.match(/^\d+$/)
        ? `Table ${displayTableCode}`
        : displayTableCode
      : "No table",
    displayChannelLabel: orderChannelLabel(order.orderChannel),
  };
}
