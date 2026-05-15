import { useCallback, useId, useMemo, useState } from "react";
import {
  MOU_OPTIONS,
  UNIT_TYPE_LABELS,
  productSpecFieldVisibility,
  unitTypesForMou,
  type PackagingUnitType,
  type PackagingVariant,
  type ProductMou,
  type ProductSpec,
} from "../lib/productSpec.js";

type Props = {
  value: ProductSpec;
  onChange: (next: ProductSpec) => void;
  disabled?: boolean;
};

function numInput(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "";
  return String(v);
}

function parseNumInput(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

type PillOption = { value: string; label: string; hint?: string };

function ProductSpecPills({
  name,
  options,
  value,
  onChange,
  disabled,
}: {
  name: string;
  options: PillOption[];
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  if (options.length === 0) return null;
  return (
    <div role="radiogroup" aria-label={name} className="product-spec-pills">
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            className={`product-spec-pill${active ? " product-spec-pill--active" : ""}`}
            title={o.hint}
            disabled={disabled}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function ProductSpecEditor({ value, onChange, disabled }: Props) {
  const baseId = useId();
  const vis = useMemo(() => productSpecFieldVisibility(value), [value]);
  const unitOptions = useMemo(() => unitTypesForMou(value.mou), [value.mou]);
  const [variantDraft, setVariantDraft] = useState<{ unitType: PackagingUnitType; quantity: string }>(() => ({
    unitType: unitTypesForMou(value.mou)[0] ?? "PIECE",
    quantity: "1",
  }));

  const setMou = useCallback(
    (mou: ProductMou) => {
      const allowed = unitTypesForMou(mou);
      const filtered = value.packagingVariants.filter((v) => allowed.includes(v.unitType));
      onChange({ ...value, mou, packagingVariants: filtered });
      setVariantDraft({ unitType: allowed[0] ?? "PIECE", quantity: "1" });
    },
    [onChange, value]
  );

  const addVariant = useCallback(() => {
    const q = parseNumInput(variantDraft.quantity);
    if (q == null || q <= 0) return;
    const next: PackagingVariant = {
      unitType: variantDraft.unitType,
      quantity: q,
      isDefault: value.packagingVariants.length === 0,
    };
    onChange({ ...value, packagingVariants: [...value.packagingVariants, next] });
    setVariantDraft((d) => ({ ...d, quantity: "1" }));
  }, [onChange, value, variantDraft]);

  const removeVariant = useCallback(
    (index: number) => {
      const list = value.packagingVariants.filter((_, i) => i !== index);
      if (list.length > 0 && !list.some((v) => v.isDefault)) {
        const first = list[0];
        if (first) list[0] = { ...first, isDefault: true };
      }
      onChange({ ...value, packagingVariants: list });
    },
    [onChange, value]
  );

  const setDefaultVariant = useCallback(
    (index: number) => {
      onChange({
        ...value,
        packagingVariants: value.packagingVariants.map((v, i) => ({ ...v, isDefault: i === index })),
      });
    },
    [onChange, value]
  );

  return (
    <section className="product-spec-editor" aria-labelledby={`${baseId}-title`}>
      <h3 id={`${baseId}-title`} className="product-spec-editor__title">
        Measure, packaging &amp; identity
      </h3>
      <p className="product-spec-editor__intro">
        Choose how this item is sold. Multiple packaging variants appear as selectable options on the product page.
      </p>

      <fieldset className="product-spec-editor__block" disabled={disabled}>
        <legend>Measure of unit (MOU)</legend>
        <ProductSpecPills
          name={`${baseId}-mou`}
          options={MOU_OPTIONS.map((o) => ({ value: o.id, label: o.label, hint: o.hint }))}
          value={value.mou}
          onChange={(id) => setMou(id as ProductMou)}
          disabled={disabled}
        />
      </fieldset>

      {vis.packaging ? (
        <fieldset className="product-spec-editor__block" disabled={disabled}>
          <legend>Packaging variants</legend>
          {value.packagingVariants.length > 0 ? (
            <ul className="product-spec-editor__variants">
              {value.packagingVariants.map((v, i) => (
                <li key={`${v.unitType}-${v.quantity}-${i}`} className="product-spec-editor__variant-row">
                  <span className="product-spec-editor__variant-label">
                    {v.label?.trim() || `${v.quantity} ${UNIT_TYPE_LABELS[v.unitType]}`}
                  </span>
                  <span className="product-spec-editor__variant-meta">{v.unitType}</span>
                  <label className="vendor-field vendor-field--compact product-spec-editor__sku-link">
                    <span>SKU code</span>
                    <input
                      value={v.skuCode ?? ""}
                      placeholder="okra-500g"
                      onChange={(e) => {
                        const next = value.packagingVariants.map((row, j) =>
                          j === i ? { ...row, skuCode: e.target.value } : row
                        );
                        onChange({ ...value, packagingVariants: next });
                      }}
                      disabled={disabled}
                    />
                  </label>
                  <button
                    type="button"
                    className={`product-spec-pill product-spec-pill--sm${v.isDefault ? " product-spec-pill--active" : ""}`}
                    onClick={() => setDefaultVariant(i)}
                    disabled={disabled}
                  >
                    {v.isDefault ? "Default" : "Set default"}
                  </button>
                  <button
                    type="button"
                    className="shell-btn shell-btn--outline shell-btn--sm"
                    onClick={() => removeVariant(i)}
                    disabled={disabled}
                    aria-label={`Remove variant ${i + 1}`}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="product-spec-editor__empty">No variants yet — add a size or pack below.</p>
          )}
          <p className="product-spec-editor__sub">Unit type</p>
          <ProductSpecPills
            name={`${baseId}-unit`}
            options={unitOptions.map((u) => ({ value: u, label: UNIT_TYPE_LABELS[u] ?? u }))}
            value={variantDraft.unitType}
            onChange={(u) => setVariantDraft((d) => ({ ...d, unitType: u as PackagingUnitType }))}
            disabled={disabled}
          />
          <div className="product-spec-editor__add-row">
            <label className="vendor-field vendor-field--compact">
              <span>Quantity</span>
              <input
                value={variantDraft.quantity}
                onChange={(e) => setVariantDraft((d) => ({ ...d, quantity: e.target.value }))}
                inputMode="decimal"
                disabled={disabled}
              />
            </label>
            <button type="button" className="shell-btn shell-btn--outline" onClick={addVariant} disabled={disabled}>
              Add variant
            </button>
          </div>
        </fieldset>
      ) : null}

      <fieldset className="product-spec-editor__block" disabled={disabled}>
        <legend>Brand &amp; lineage</legend>
        <div className="product-spec-editor__grid">
          <label className="vendor-field">
            <span>Brand</span>
            <input
              value={value.brand ?? ""}
              onChange={(e) => onChange({ ...value, brand: e.target.value })}
              autoComplete="off"
              disabled={disabled}
            />
          </label>
          <label className="vendor-field">
            <span>Product family</span>
            <input
              value={value.productFamily ?? ""}
              onChange={(e) => onChange({ ...value, productFamily: e.target.value })}
              autoComplete="off"
              disabled={disabled}
            />
          </label>
          <label className="vendor-field">
            <span>Model</span>
            <input
              value={value.model ?? ""}
              onChange={(e) => onChange({ ...value, model: e.target.value })}
              autoComplete="off"
              disabled={disabled}
            />
          </label>
        </div>
      </fieldset>

      {vis.shelfLife || vis.unitsPerPack ? (
        <fieldset className="product-spec-editor__block" disabled={disabled}>
          <legend>Freshness &amp; pack count</legend>
          <div className="product-spec-editor__grid">
            {vis.shelfLife ? (
              <label className="vendor-field">
                <span>Shelf life (days)</span>
                <input
                  value={numInput(value.shelfLifeDays)}
                  onChange={(e) => onChange({ ...value, shelfLifeDays: parseNumInput(e.target.value) })}
                  inputMode="numeric"
                  disabled={disabled}
                />
              </label>
            ) : null}
            {vis.unitsPerPack ? (
              <label className="vendor-field">
                <span>Units per pack</span>
                <input
                  value={numInput(value.unitsPerPack)}
                  onChange={(e) => onChange({ ...value, unitsPerPack: parseNumInput(e.target.value) })}
                  inputMode="numeric"
                  disabled={disabled}
                />
              </label>
            ) : null}
          </div>
        </fieldset>
      ) : null}

      {vis.weight || vis.boxDimensions ? (
        <fieldset className="product-spec-editor__block" disabled={disabled}>
          <legend>Dimensions</legend>
          <div className="product-spec-editor__grid product-spec-editor__grid--4">
            {vis.weight ? (
              <label className="vendor-field">
                <span>Weight (g)</span>
                <input
                  value={numInput(value.dimensions.weightGrams)}
                  onChange={(e) =>
                    onChange({
                      ...value,
                      dimensions: { ...value.dimensions, weightGrams: parseNumInput(e.target.value) },
                    })
                  }
                  inputMode="decimal"
                  disabled={disabled}
                />
              </label>
            ) : null}
            {vis.boxDimensions ? (
              <>
                <label className="vendor-field">
                  <span>Width (cm)</span>
                  <input
                    value={numInput(value.dimensions.widthCm)}
                    onChange={(e) =>
                      onChange({
                        ...value,
                        dimensions: { ...value.dimensions, widthCm: parseNumInput(e.target.value) },
                      })
                    }
                    inputMode="decimal"
                    disabled={disabled}
                  />
                </label>
                <label className="vendor-field">
                  <span>Height (cm)</span>
                  <input
                    value={numInput(value.dimensions.heightCm)}
                    onChange={(e) =>
                      onChange({
                        ...value,
                        dimensions: { ...value.dimensions, heightCm: parseNumInput(e.target.value) },
                      })
                    }
                    inputMode="decimal"
                    disabled={disabled}
                  />
                </label>
                <label className="vendor-field">
                  <span>Depth (cm)</span>
                  <input
                    value={numInput(value.dimensions.depthCm)}
                    onChange={(e) =>
                      onChange({
                        ...value,
                        dimensions: { ...value.dimensions, depthCm: parseNumInput(e.target.value) },
                      })
                    }
                    inputMode="decimal"
                    disabled={disabled}
                  />
                </label>
              </>
            ) : null}
          </div>
        </fieldset>
      ) : null}

      <fieldset className="product-spec-editor__block" disabled={disabled}>
        <legend>Source / origin</legend>
        <div className="product-spec-editor__grid">
          <label className="vendor-field">
            <span>Country</span>
            <input
              value={value.origin.country ?? ""}
              onChange={(e) => onChange({ ...value, origin: { ...value.origin, country: e.target.value } })}
              maxLength={8}
              placeholder="IN"
              disabled={disabled}
            />
          </label>
          <label className="vendor-field">
            <span>Region</span>
            <input
              value={value.origin.region ?? ""}
              onChange={(e) => onChange({ ...value, origin: { ...value.origin, region: e.target.value } })}
              disabled={disabled}
            />
          </label>
          <label className="vendor-field product-spec-editor__span-2">
            <span>Source</span>
            <input
              value={value.origin.sourceLabel ?? ""}
              onChange={(e) => onChange({ ...value, origin: { ...value.origin, sourceLabel: e.target.value } })}
              placeholder="Farm direct, imported…"
              disabled={disabled}
            />
          </label>
        </div>
      </fieldset>
    </section>
  );
}
