import type { CommerceLookupValueDto } from "./commerceApi.js";
import { resolveCafeTableFromQr } from "./resolveCafeTableFromQr.js";
import { writeQrOrderSession } from "./qrOrderSession.js";

/** Apply table from QR URL to session (lookup-aware when tables are loaded). */
export function bindQrTableFromScan(
  scanned: string,
  tables: CommerceLookupValueDto[] = []
): { tableCode: string; inFloorPlan: boolean } {
  const code = scanned.trim();
  if (!code) {
    return { tableCode: "", inFloorPlan: false };
  }

  if (tables.length === 0) {
    writeQrOrderSession({ tableCode: code });
    return { tableCode: code, inFloorPlan: false };
  }

  const resolved = resolveCafeTableFromQr(tables, code);
  const tableCode = resolved?.tableCode ?? code;
  writeQrOrderSession({
    tableCode,
    tableLabel: resolved?.tableLabel,
  });
  return {
    tableCode,
    inFloorPlan: resolved?.inFloorPlan ?? false,
  };
}
