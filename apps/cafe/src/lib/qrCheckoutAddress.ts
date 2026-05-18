import type { ShippingAddress } from "./checkoutApi.js";
import { formatQrTableHeadline, type QrOrderSession } from "./qrOrderSession.js";

/** Minimal shipping payload for QR table service (kitchen / receipts). */
export function qrTableShippingAddress(session: QrOrderSession): ShippingAddress {
  const table = formatQrTableHeadline(session);
  return {
    line1: table,
    line2: "QR table service",
    city: "On premises",
    state: "",
    postalCode: "",
    country: "IN",
  };
}
