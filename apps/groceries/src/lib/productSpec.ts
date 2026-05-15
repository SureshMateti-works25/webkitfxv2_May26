/** Product measure / packaging stored under `commerce.productSpec` in CommerceJson. */

export type ProductMou = "WEIGHT" | "VOLUME" | "COUNT" | "LENGTH";

export type PackagingUnitType =
  | "GRAM"
  | "KILOGRAM"
  | "MILLIGRAM"
  | "MILLILITER"
  | "LITER"
  | "PIECE"
  | "PACK"
  | "DOZEN"
  | "CASE"
  | "CARTON"
  | "METER"
  | "CENTIMETER"
  | "SQUARE_METER";

export type PackagingVariant = {
  unitType: PackagingUnitType;
  quantity: number;
  label?: string;
  /** Links this pack size to a Variants-tab SKU (e.g. okra-500g). */
  skuCode?: string;
  isDefault?: boolean;
};

export type ProductDimensions = {
  weightGrams?: number | null;
  widthCm?: number | null;
  heightCm?: number | null;
  depthCm?: number | null;
};

export type ProductOrigin = {
  country?: string;
  region?: string;
  sourceLabel?: string;
};

export type ProductSpec = {
  mou: ProductMou | "";
  packagingVariants: PackagingVariant[];
  dimensions: ProductDimensions;
  unitsPerPack?: number | null;
  shelfLifeDays?: number | null;
  brand?: string;
  productFamily?: string;
  model?: string;
  origin: ProductOrigin;
};

export const MOU_OPTIONS: { id: ProductMou; label: string; hint: string }[] = [
  { id: "WEIGHT", label: "By weight", hint: "Sold by mass (g, kg)" },
  { id: "VOLUME", label: "By volume", hint: "Liquids and pourables (ml, L)" },
  { id: "COUNT", label: "By count", hint: "Pieces, packs, dozens" },
  { id: "LENGTH", label: "By length", hint: "Fabric, rope, rolls (cm, m)" },
];

export const UNIT_TYPE_LABELS: Record<PackagingUnitType, string> = {
  GRAM: "g",
  KILOGRAM: "kg",
  MILLIGRAM: "mg",
  MILLILITER: "ml",
  LITER: "L",
  PIECE: "pc",
  PACK: "pack",
  DOZEN: "dozen",
  CASE: "case",
  CARTON: "carton",
  METER: "m",
  CENTIMETER: "cm",
  SQUARE_METER: "m²",
};

const WEIGHT_UNITS: PackagingUnitType[] = ["GRAM", "KILOGRAM", "MILLIGRAM"];
const VOLUME_UNITS: PackagingUnitType[] = ["MILLILITER", "LITER"];
const COUNT_UNITS: PackagingUnitType[] = ["PIECE", "PACK", "DOZEN", "CASE", "CARTON"];
const LENGTH_UNITS: PackagingUnitType[] = ["METER", "CENTIMETER", "SQUARE_METER"];

export function unitTypesForMou(mou: ProductMou | ""): PackagingUnitType[] {
  switch (mou) {
    case "WEIGHT":
      return WEIGHT_UNITS;
    case "VOLUME":
      return VOLUME_UNITS;
    case "COUNT":
      return COUNT_UNITS;
    case "LENGTH":
      return LENGTH_UNITS;
    default:
      return [...WEIGHT_UNITS, ...VOLUME_UNITS, "PIECE", "PACK"];
  }
}

export function emptyProductSpec(): ProductSpec {
  return {
    mou: "",
    packagingVariants: [],
    dimensions: {},
    unitsPerPack: null,
    shelfLifeDays: null,
    brand: "",
    productFamily: "",
    model: "",
    origin: {},
  };
}

function parseNum(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function parseUnitType(v: unknown): PackagingUnitType | null {
  const s = String(v ?? "").trim().toUpperCase();
  if (!s) return null;
  if (s in UNIT_TYPE_LABELS) return s as PackagingUnitType;
  return null;
}

function parseMou(v: unknown): ProductMou | "" {
  const s = String(v ?? "").trim().toUpperCase();
  if (s === "WEIGHT" || s === "VOLUME" || s === "COUNT" || s === "LENGTH") return s;
  return "";
}

export function normalizePackagingVariant(raw: unknown): PackagingVariant | null {
  if (raw == null || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const unitType = parseUnitType(o.unitType ?? o.UnitType);
  const quantity = parseNum(o.quantity ?? o.Quantity);
  if (!unitType || quantity == null || quantity <= 0) return null;
  const labelRaw = o.label ?? o.Label;
  const label =
    labelRaw == null || labelRaw === ""
      ? undefined
      : typeof labelRaw === "string"
        ? labelRaw.trim() || undefined
        : String(labelRaw).trim() || undefined;
  const skuRaw = o.skuCode ?? o.SkuCode;
  const skuCode =
    skuRaw == null || skuRaw === ""
      ? undefined
      : typeof skuRaw === "string"
        ? skuRaw.trim() || undefined
        : String(skuRaw).trim() || undefined;
  const isDefault = Boolean(o.isDefault ?? o.IsDefault);
  return { unitType, quantity, label, skuCode, isDefault: isDefault || undefined };
}

export function normalizeProductSpec(raw: unknown): ProductSpec {
  if (raw == null || typeof raw !== "object") return emptyProductSpec();
  const o = raw as Record<string, unknown>;
  const mou = parseMou(o.mou ?? o.Mou);
  const variantsRaw = o.packagingVariants ?? o.PackagingVariants;
  const packagingVariants: PackagingVariant[] = [];
  if (Array.isArray(variantsRaw)) {
    for (const el of variantsRaw) {
      const v = normalizePackagingVariant(el);
      if (v) packagingVariants.push(v);
    }
  }
  const dimRaw = o.dimensions ?? o.Dimensions;
  const dimensions: ProductDimensions = {};
  if (dimRaw != null && typeof dimRaw === "object") {
    const d = dimRaw as Record<string, unknown>;
    dimensions.weightGrams = parseNum(d.weightGrams ?? d.WeightGrams);
    dimensions.widthCm = parseNum(d.widthCm ?? d.WidthCm);
    dimensions.heightCm = parseNum(d.heightCm ?? d.HeightCm);
    dimensions.depthCm = parseNum(d.depthCm ?? d.DepthCm);
  }
  const originRaw = o.origin ?? o.Origin;
  const origin: ProductOrigin = {};
  if (originRaw != null && typeof originRaw === "object") {
    const or = originRaw as Record<string, unknown>;
    origin.country = String(or.country ?? or.Country ?? "").trim() || undefined;
    origin.region = String(or.region ?? or.Region ?? "").trim() || undefined;
    origin.sourceLabel = String(or.sourceLabel ?? or.SourceLabel ?? "").trim() || undefined;
  }
  return {
    mou,
    packagingVariants,
    dimensions,
    unitsPerPack: parseNum(o.unitsPerPack ?? o.UnitsPerPack),
    shelfLifeDays: parseNum(o.shelfLifeDays ?? o.ShelfLifeDays),
    brand: String(o.brand ?? o.Brand ?? "").trim(),
    productFamily: String(o.productFamily ?? o.ProductFamily ?? "").trim(),
    model: String(o.model ?? o.Model ?? "").trim(),
    origin,
  };
}

export function productSpecFromCommerce(commerce: Record<string, unknown> | null | undefined): ProductSpec {
  if (!commerce) return emptyProductSpec();
  return normalizeProductSpec(commerce.productSpec ?? commerce.ProductSpec);
}

export function productSpecToCommercePayload(spec: ProductSpec): Record<string, unknown> {
  const packagingVariants = spec.packagingVariants
    .filter((v) => v.quantity > 0)
    .map((v) => ({
      unitType: v.unitType,
      quantity: v.quantity,
      ...(v.label?.trim() ? { label: v.label.trim() } : {}),
      ...(v.skuCode?.trim() ? { skuCode: v.skuCode.trim() } : {}),
      ...(v.isDefault ? { isDefault: true } : {}),
    }));
  const dimensions: Record<string, number> = {};
  if (spec.dimensions.weightGrams != null) dimensions.weightGrams = spec.dimensions.weightGrams;
  if (spec.dimensions.widthCm != null) dimensions.widthCm = spec.dimensions.widthCm;
  if (spec.dimensions.heightCm != null) dimensions.heightCm = spec.dimensions.heightCm;
  if (spec.dimensions.depthCm != null) dimensions.depthCm = spec.dimensions.depthCm;
  const origin: Record<string, string> = {};
  if (spec.origin.country) origin.country = spec.origin.country;
  if (spec.origin.region) origin.region = spec.origin.region;
  if (spec.origin.sourceLabel) origin.sourceLabel = spec.origin.sourceLabel;
  return {
    mou: spec.mou || "",
    packagingVariants,
    dimensions,
    unitsPerPack: spec.unitsPerPack ?? null,
    shelfLifeDays: spec.shelfLifeDays ?? null,
    brand: spec.brand?.trim() ?? "",
    productFamily: spec.productFamily?.trim() ?? "",
    model: spec.model?.trim() ?? "",
    origin,
  };
}

export function formatPackagingVariant(v: PackagingVariant): string {
  if (v.label?.trim()) return v.label.trim();
  const unit = UNIT_TYPE_LABELS[v.unitType] ?? v.unitType;
  const q = v.quantity;
  if (v.unitType === "LITER" && q === 1) return "1 L";
  if (v.unitType === "KILOGRAM" && q === 1) return "1 kg";
  if (v.unitType === "GRAM" && q >= 1000 && q % 1000 === 0) return `${q / 1000} kg`;
  if (v.unitType === "MILLILITER" && q >= 1000 && q % 1000 === 0) return `${q / 1000} L`;
  return `${q} ${unit}`;
}

export function mouLabel(mou: ProductMou | ""): string {
  return MOU_OPTIONS.find((o) => o.id === mou)?.label ?? "";
}

/** Which editor sections to show for the current MOU / packaging. */
export function productSpecFieldVisibility(spec: ProductSpec): {
  packaging: boolean;
  weight: boolean;
  boxDimensions: boolean;
  unitsPerPack: boolean;
  shelfLife: boolean;
} {
  const mou = spec.mou;
  const variants = spec.packagingVariants;
  const hasBulkPack = variants.some((v) => v.unitType === "CASE" || v.unitType === "CARTON" || v.unitType === "PACK");
  return {
    packaging: mou !== "",
    weight: mou === "WEIGHT" || mou === "VOLUME" || mou === "COUNT" || variants.length > 0,
    boxDimensions: mou === "COUNT" || hasBulkPack || (spec.unitsPerPack != null && spec.unitsPerPack > 1),
    unitsPerPack: mou === "COUNT",
    shelfLife: mou === "WEIGHT" || mou === "VOLUME" || mou === "COUNT",
  };
}

export function productSpecHasDisplayContent(spec: ProductSpec): boolean {
  if (spec.mou) return true;
  if (spec.packagingVariants.length > 0) return true;
  if (spec.brand?.trim()) return true;
  if (spec.productFamily?.trim()) return true;
  if (spec.model?.trim()) return true;
  if (spec.shelfLifeDays != null && spec.shelfLifeDays > 0) return true;
  if (spec.unitsPerPack != null && spec.unitsPerPack > 0) return true;
  const d = spec.dimensions;
  if (d.weightGrams || d.widthCm || d.heightCm || d.depthCm) return true;
  const o = spec.origin;
  if (o.country || o.region || o.sourceLabel) return true;
  return false;
}
