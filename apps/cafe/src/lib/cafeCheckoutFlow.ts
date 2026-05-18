/** Café checkout: QR / pickup pay online; dine-in pays at table after the meal. */

export type CafeOrderChannel = "dine_in" | "qr" | "aggregator" | "pickup";

export function normalizeCafeOrderChannel(channel: string | null | undefined): CafeOrderChannel {
  const c = (channel ?? "").trim().toLowerCase();
  if (c === "qr") return "qr";
  if (c === "aggregator") return "aggregator";
  if (c === "pickup") return "pickup";
  return "dine_in";
}

/** True when shopper must complete the mock payment screen before the order is placed. */
export function requiresOnlinePaymentAtCheckout(channel: string | null | undefined): boolean {
  const c = normalizeCafeOrderChannel(channel);
  return c === "qr" || c === "pickup";
}

export function isPayAtTableChannel(channel: string | null | undefined): boolean {
  return normalizeCafeOrderChannel(channel) === "dine_in";
}
