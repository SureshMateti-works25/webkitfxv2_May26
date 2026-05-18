/** Path customers open from a table QR sticker (local or deployed origin). */
export function buildQrMenuPath(tableCode: string): string {
  const code = tableCode.trim();
  if (!code) return "/qr";
  return `/qr/${encodeURIComponent(code)}`;
}

export function buildQrMenuUrl(tableCode: string, origin = window.location.origin): string {
  return `${origin.replace(/\/$/, "")}${buildQrMenuPath(tableCode)}`;
}

/** Read table code from `/qr/:tableCode` or `/qr?table=…`. */
export function parseQrTableFromLocation(params: {
  routeTableCode?: string;
  searchTable?: string | null;
}): string {
  const fromRoute = (params.routeTableCode ?? "").trim();
  if (fromRoute) return decodeURIComponent(fromRoute);
  return (params.searchTable ?? "").trim();
}
