import type { CommerceLookupValueDto } from "./commerceApi.js";

export type ResolvedCafeTable = {
  /** Canonical code stored on orders (lookup code when matched). */
  tableCode: string;
  tableLabel?: string;
  /** True when a floor-plan lookup row was found. */
  inFloorPlan: boolean;
};

/** Build candidate strings from a QR URL segment (e.g. t1, T1, 1, P1, tbl_t1). */
export function qrTableCodeCandidates(scanned: string): string[] {
  const raw = scanned.trim();
  if (!raw) return [];

  const lower = raw.toLowerCase();
  const out = new Set<string>([raw, lower]);

  try {
    const decoded = decodeURIComponent(raw).trim();
    if (decoded) {
      out.add(decoded);
      out.add(decoded.toLowerCase());
    }
  } catch {
    /* ignore bad escape sequences */
  }

  // Sticker shorthand: T1 → table code 1, P2 → P2
  if (/^t\d+[a-z]?$/i.test(raw)) {
    out.add(raw.slice(1));
    out.add(raw.slice(1).toLowerCase());
  }
  if (/^p\d+$/i.test(raw)) {
    out.add(raw.toUpperCase());
    out.add(raw.toLowerCase());
  }

  return [...out].filter((c) => c.length > 0);
}

export function resolveCafeTableFromQr(
  tables: CommerceLookupValueDto[],
  scanned: string
): ResolvedCafeTable | null {
  const candidates = qrTableCodeCandidates(scanned);
  if (candidates.length === 0) return null;

  for (const candidate of candidates) {
    const cLower = candidate.toLowerCase();
    const byCode = tables.find((t) => t.code.trim().toLowerCase() === cLower);
    if (byCode) {
      return {
        tableCode: byCode.code.trim(),
        tableLabel: byCode.label.trim() || undefined,
        inFloorPlan: true,
      };
    }
  }

  for (const candidate of candidates) {
    const cLower = candidate.toLowerCase();
    const byId = tables.find(
      (t) =>
        t.id.toLowerCase() === cLower ||
        t.id.toLowerCase().endsWith(`_${cLower}`) ||
        t.id.toLowerCase() === `tbl_${cLower}`
    );
    if (byId) {
      return {
        tableCode: byId.code.trim(),
        tableLabel: byId.label.trim() || undefined,
        inFloorPlan: true,
      };
    }
  }

  const fallback = candidates[0]!;
  return {
    tableCode: fallback,
    tableLabel: undefined,
    inFloorPlan: false,
  };
}
