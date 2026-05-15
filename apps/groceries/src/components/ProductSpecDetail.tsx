import { useMemo } from "react";
import { formatMinorAmount } from "../lib/formatMinor.js";
import {
  formatPackagingVariant,
  mouLabel,
  productSpecHasDisplayContent,
  type PackagingVariant,
  type ProductSpec,
} from "../lib/productSpec.js";
import {
  lineTotalMinor,
  resolveSelectionStorefrontSku,
  resolveVariantStorefrontSku,
  storefrontComparePriceMinor,
  storefrontUnitPriceMinor,
  type StorefrontSku,
} from "../lib/storefrontPackPricing.js";
import type { CatalogProductDetail } from "../lib/commerceApi.js";

type Props = {
  spec: ProductSpec;
  product: CatalogProductDetail;
  storefrontSkus: StorefrontSku[];
  selectedIndex: number;
  onSelectIndex: (index: number) => void;
  quantity: number;
  className?: string;
};

function formatWeightGrams(g: number | null | undefined): string | null {
  if (g == null || !Number.isFinite(g) || g <= 0) return null;
  if (g >= 1000) return `${g / 1000} kg`;
  return `${g} g`;
}

function formatDims(spec: ProductSpec): string | null {
  const { widthCm, heightCm, depthCm } = spec.dimensions;
  const parts: string[] = [];
  if (widthCm != null && widthCm > 0) parts.push(`${widthCm} cm W`);
  if (heightCm != null && heightCm > 0) parts.push(`${heightCm} cm H`);
  if (depthCm != null && depthCm > 0) parts.push(`${depthCm} cm D`);
  return parts.length > 0 ? parts.join(" · ") : null;
}

function originLine(spec: ProductSpec): string | null {
  const o = spec.origin;
  const bits: string[] = [];
  if (o.sourceLabel?.trim()) bits.push(o.sourceLabel.trim());
  if (o.region?.trim()) bits.push(o.region.trim());
  if (o.country?.trim()) bits.push(o.country.trim());
  return bits.length > 0 ? bits.join(", ") : null;
}

function priceHintForVariant(
  variant: PackagingVariant,
  variantIndex: number,
  skus: StorefrontSku[],
  product: CatalogProductDetail,
  currency: string | null
): string | null {
  const sku = resolveVariantStorefrontSku(variant, variantIndex, skus);
  const unit = storefrontUnitPriceMinor(sku, product);
  if (unit == null) return null;
  return formatMinorAmount(unit, currency);
}

export function ProductSpecDetail({
  spec,
  product,
  storefrontSkus,
  selectedIndex,
  onSelectIndex,
  quantity,
  className,
}: Props) {
  const variants = spec.packagingVariants;
  const currency = product.currency;
  const selectedSku = useMemo(
    () => resolveSelectionStorefrontSku(spec, selectedIndex, storefrontSkus),
    [spec, selectedIndex, storefrontSkus]
  );
  const unitMinor = useMemo(
    () => storefrontUnitPriceMinor(selectedSku, product),
    [selectedSku, product]
  );
  const compareMinor = useMemo(
    () => storefrontComparePriceMinor(selectedSku, product),
    [selectedSku, product]
  );
  const totalMinor = useMemo(() => lineTotalMinor(unitMinor, quantity), [unitMinor, quantity]);

  const hasPackChoice = variants.length > 0 || storefrontSkus.length > 1;
  if (!hasPackChoice && !productSpecHasDisplayContent(spec)) return null;

  const weight = formatWeightGrams(spec.dimensions.weightGrams);
  const dims = formatDims(spec);
  const origin = originLine(spec);
  const mou = mouLabel(spec.mou);
  const showPackPills = variants.length > 0;
  const showSkuOnlyPills = !showPackPills && storefrontSkus.length > 1;

  return (
    <section
      className={className ? `product-spec-detail ${className}` : "product-spec-detail"}
      aria-label="Product specifications"
    >
      {showPackPills ? (
        <div className="product-spec-detail__block">
          <h3 className="product-spec-detail__heading">Pack size</h3>
          <div className="product-spec-pills" role="radiogroup" aria-label="Packaging options">
            {variants.map((v, i) => {
              const active = i === selectedIndex;
              const hint = priceHintForVariant(v, i, storefrontSkus, product, currency);
              return (
                <button
                  key={`${v.unitType}-${v.quantity}-${i}`}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  className={`product-spec-pill${active ? " product-spec-pill--active" : ""}`}
                  onClick={() => onSelectIndex(i)}
                >
                  <span className="product-spec-pill__label">{formatPackagingVariant(v)}</span>
                  {hint ? <span className="product-spec-pill__price">{hint}</span> : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {showSkuOnlyPills ? (
        <div className="product-spec-detail__block">
          <h3 className="product-spec-detail__heading">Options</h3>
          <div className="product-spec-pills" role="radiogroup" aria-label="Product options">
            {storefrontSkus.map((s, i) => {
              const active = i === selectedIndex;
              const unit = s.listPriceMinor;
              return (
                <button
                  key={s.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  className={`product-spec-pill${active ? " product-spec-pill--active" : ""}`}
                  onClick={() => onSelectIndex(i)}
                >
                  <span className="product-spec-pill__label">{s.skuCode}</span>
                  {unit != null ? (
                    <span className="product-spec-pill__price">{formatMinorAmount(unit, currency)}</span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {unitMinor != null ? (
        <div className="product-spec-detail__pricing" aria-live="polite">
          <p className="product-spec-detail__unit-price">
            <span className="product-spec-detail__price-label">Unit price</span>
            <strong>{formatMinorAmount(unitMinor, currency)}</strong>
            {compareMinor != null && compareMinor > unitMinor ? (
              <span className="product-spec-detail__mrp">
                <s>{formatMinorAmount(compareMinor, currency)}</s>
              </span>
            ) : null}
          </p>
          {quantity > 1 && totalMinor != null ? (
            <p className="product-spec-detail__line-total">
              <span className="product-spec-detail__price-label">
                Total ({quantity} {quantity === 1 ? "pack" : "packs"})
              </span>
              <strong>{formatMinorAmount(totalMinor, currency)}</strong>
            </p>
          ) : null}
          {selectedSku?.skuCode ? (
            <p className="product-spec-detail__sku-ref">SKU {selectedSku.skuCode}</p>
          ) : null}
        </div>
      ) : null}

      <dl className="product-spec-detail__facts">
        {mou ? (
          <div className="product-spec-detail__row">
            <dt>Sold by</dt>
            <dd>{mou}</dd>
          </div>
        ) : null}
        {spec.brand?.trim() ? (
          <div className="product-spec-detail__row">
            <dt>Brand</dt>
            <dd>{spec.brand.trim()}</dd>
          </div>
        ) : null}
        {spec.productFamily?.trim() ? (
          <div className="product-spec-detail__row">
            <dt>Family</dt>
            <dd>{spec.productFamily.trim()}</dd>
          </div>
        ) : null}
        {spec.model?.trim() ? (
          <div className="product-spec-detail__row">
            <dt>Model</dt>
            <dd>{spec.model.trim()}</dd>
          </div>
        ) : null}
        {spec.unitsPerPack != null && spec.unitsPerPack > 0 ? (
          <div className="product-spec-detail__row">
            <dt>Units per pack</dt>
            <dd>{spec.unitsPerPack}</dd>
          </div>
        ) : null}
        {spec.shelfLifeDays != null && spec.shelfLifeDays > 0 ? (
          <div className="product-spec-detail__row">
            <dt>Shelf life</dt>
            <dd>{spec.shelfLifeDays} days</dd>
          </div>
        ) : null}
        {weight ? (
          <div className="product-spec-detail__row">
            <dt>Weight</dt>
            <dd>{weight}</dd>
          </div>
        ) : null}
        {dims ? (
          <div className="product-spec-detail__row">
            <dt>Dimensions</dt>
            <dd>{dims}</dd>
          </div>
        ) : null}
        {origin ? (
          <div className="product-spec-detail__row">
            <dt>Origin</dt>
            <dd>{origin}</dd>
          </div>
        ) : null}
      </dl>
    </section>
  );
}
