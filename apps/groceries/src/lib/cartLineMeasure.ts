import type { PackagingUnitType } from "./productSpec.js";
import { UNIT_TYPE_LABELS } from "./productSpec.js";

/** Pack-size snapshot stored on a cart line (from PDP packaging selection). */
export type CartPackSnapshot = {
  packLabel: string | null;
  packUnitType: PackagingUnitType | string | null;
  packQuantity: number | null;
  /** Items inside one sellable pack (count MOU). */
  unitsPerPack: number | null;
};

export function cartPackSnapshotFromFields(raw: {
  packLabel?: string | null;
  packUnitType?: string | null;
  packQuantity?: number | null;
  unitsPerPack?: number | null;
}): CartPackSnapshot | null {
  const packLabel = raw.packLabel?.trim() || null;
  const packUnitType = raw.packUnitType?.trim() || null;
  const packQuantity =
    raw.packQuantity != null && Number.isFinite(Number(raw.packQuantity)) ? Number(raw.packQuantity) : null;
  const unitsPerPack =
    raw.unitsPerPack != null && Number.isFinite(Number(raw.unitsPerPack)) ? Number(raw.unitsPerPack) : null;
  if (!packLabel && !packUnitType && packQuantity == null && unitsPerPack == null) return null;
  return { packLabel, packUnitType, packQuantity, unitsPerPack };
}

/** Human-readable total weight/volume/count for `packCount` sellable packs. */
export function formatCartLineTotalMeasure(snapshot: CartPackSnapshot | null, packCount: number): string | null {
  if (!snapshot || packCount < 1) return null;
  const ut = String(snapshot.packUnitType ?? "").toUpperCase();
  const q = snapshot.packQuantity;
  if (!ut || q == null || !Number.isFinite(q) || q <= 0) {
    return snapshot.packLabel ? `${packCount} × ${snapshot.packLabel}` : null;
  }

  const unitsInPack = snapshot.unitsPerPack;
  if ((ut === "PIECE" || ut === "PACK") && unitsInPack != null && unitsInPack > 0) {
    const totalPieces = packCount * unitsInPack * q;
    return `${totalPieces} ${totalPieces === 1 ? "unit" : "units"}`;
  }

  if (ut === "KILOGRAM") {
    const totalKg = q * packCount;
    if (totalKg >= 1) {
      const rounded = Math.round(totalKg * 1000) / 1000;
      return rounded % 1 === 0 ? `${rounded} kg` : `${rounded} kg`;
    }
    return `${Math.round(totalKg * 1000)} g`;
  }

  if (ut === "GRAM") {
    const totalG = q * packCount;
    if (totalG >= 1000) {
      const kg = Math.round((totalG / 1000) * 1000) / 1000;
      return kg % 1 === 0 ? `${kg} kg` : `${kg} kg`;
    }
    return `${Math.round(totalG)} g`;
  }

  if (ut === "LITER") {
    const totalL = q * packCount;
    if (totalL >= 1) return totalL % 1 === 0 ? `${totalL} L` : `${totalL} L`;
    return `${Math.round(totalL * 1000)} ml`;
  }

  if (ut === "MILLILITER") {
    const totalMl = q * packCount;
    if (totalMl >= 1000) {
      const l = Math.round((totalMl / 1000) * 100) / 100;
      return `${l} L`;
    }
    return `${Math.round(totalMl)} ml`;
  }

  if (ut === "PIECE" || ut === "PACK" || ut === "DOZEN") {
    const mult = ut === "DOZEN" ? 12 : 1;
    const total = q * packCount * mult;
    const unit = UNIT_TYPE_LABELS[ut as PackagingUnitType] ?? ut.toLowerCase();
    return `${total} ${unit}`;
  }

  const unit = UNIT_TYPE_LABELS[ut as PackagingUnitType] ?? ut;
  const total = q * packCount;
  return `${total} ${unit}`;
}

export function cartLineHasPackPricing(line: {
  packLabel?: string | null;
  packUnitType?: string | null;
  packQuantity?: number | null;
}): boolean {
  return Boolean(line.packLabel?.trim() || line.packUnitType?.trim() || line.packQuantity != null);
}
