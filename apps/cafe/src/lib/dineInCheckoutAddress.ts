import type { ShippingAddress } from "./checkoutApi.js";

export function dineInTableShippingAddress(tableCode: string, tableLabel?: string): ShippingAddress {
  const code = tableCode.trim();
  const label = (tableLabel ?? "").trim();
  const line1 = label || (code.match(/^\d+$/) ? `Table ${code}` : code);
  return {
    line1,
    line2: "Dine-in · pay at table after your meal",
    city: "On premises",
    state: "",
    postalCode: "",
    country: "IN",
  };
}
