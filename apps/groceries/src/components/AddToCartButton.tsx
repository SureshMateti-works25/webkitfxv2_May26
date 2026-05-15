import { useCallback, useMemo, useState } from "react";
import { useCart } from "../cart/CartContext.js";
import type { CatalogProductDetail } from "../lib/commerceApi.js";
import type { CartPackSnapshot } from "../lib/cartLineMeasure.js";
import {
  buildCartSkuSelectOptions,
  resolveCartSkuFromKey,
  snapshotStorefrontUnitPriceMinor,
} from "../lib/storefrontCartAccess.js";

type Props = {
  product: CatalogProductDetail;
  skuFocus: { skuId: string | null; skuCode: string | null };
  purchaseSku?: { skuId: string; skuCode: string } | null;
  unitPriceMinor?: number | null;
  quantity?: number;
  onQuantityChange?: (qty: number) => void;
  requirePackSelection?: boolean;
  packSnapshot?: CartPackSnapshot | null;
  /** `retail`: In stock + Qty pill + full Add to cart bar (groceries PDP). */
  layout?: "icon" | "retail";
  stockLabel?: string;
  maxQuantity?: number;
};

function resolveSkuKey(
  product: CatalogProductDetail,
  skuFocus: Props["skuFocus"],
  skuOptions: { value: string; label: string }[]
): string {
  if (skuOptions.length === 0) return "";
  if (skuOptions.length === 1) return skuOptions[0]!.value;
  if (skuFocus.skuId && skuOptions.some((o) => o.value === skuFocus.skuId)) return skuFocus.skuId;
  const code = (skuFocus.skuCode ?? "").trim();
  if (code && skuOptions.some((o) => o.value === code)) return code;
  return "";
}

export function AddToCartButton({
  product,
  skuFocus,
  purchaseSku,
  unitPriceMinor,
  quantity = 1,
  onQuantityChange,
  requirePackSelection = false,
  packSnapshot = null,
  layout = "icon",
  stockLabel = "In Stock",
  maxQuantity = 10,
}: Props) {
  const { addOrMergeLine } = useCart();
  const [hint, setHint] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const skuOptions = useMemo(() => buildCartSkuSelectOptions(product), [product]);
  const skuKey = useMemo(() => resolveSkuKey(product, skuFocus, skuOptions), [product, skuFocus, skuOptions]);

  const usesPackSku = purchaseSku != null && purchaseSku.skuCode.trim().length > 0;
  const needsGallerySku = !usesPackSku && skuOptions.length > 1;
  const needsPack = requirePackSelection && !usesPackSku;
  const canAdd = (!needsPack && !needsGallerySku) || (needsGallerySku && skuKey.length > 0);

  const qtyCap = Math.max(1, Math.min(99, maxQuantity));

  const commitQty = useCallback(
    (raw: string) => {
      if (!onQuantityChange) return;
      const parsed = Number.parseInt(raw.trim(), 10);
      if (!Number.isFinite(parsed)) {
        onQuantityChange(1);
        return;
      }
      onQuantityChange(Math.max(1, Math.min(qtyCap, parsed)));
    },
    [onQuantityChange, qtyCap]
  );

  const onAdd = useCallback(() => {
    setErr(null);
    setHint(null);
    if (needsPack) {
      setErr("Choose a pack size first.");
      return;
    }
    if (needsGallerySku && !skuKey) {
      setErr("Choose a colour in the gallery first.");
      return;
    }

    let skuId: string | null = null;
    let skuCode: string | null = null;
    if (usesPackSku && purchaseSku) {
      skuId = purchaseSku.skuId;
      skuCode = purchaseSku.skuCode;
    } else {
      const key = skuKey || (skuOptions.length === 1 ? skuOptions[0]!.value : "");
      const resolved = resolveCartSkuFromKey(product, key);
      skuId = resolved.skuId;
      skuCode = resolved.skuCode;
    }

    const unit =
      unitPriceMinor != null && Number.isFinite(unitPriceMinor)
        ? unitPriceMinor
        : snapshotStorefrontUnitPriceMinor(product);
    const qty = Math.max(1, Math.min(999, Math.floor(quantity) || 1));

    addOrMergeLine({
      productId: product.id,
      slug: product.slug,
      titleDisplay: product.titleDisplay,
      skuId,
      skuCode,
      quantity: qty,
      unitPriceMinor: unit,
      currency: product.currency,
      heroStorageKey: product.heroStorageKey?.trim() || null,
      vendorCode: product.vendorCode?.trim() || null,
      packLabel: packSnapshot?.packLabel ?? null,
      packUnitType: packSnapshot?.packUnitType ?? null,
      packQuantity: packSnapshot?.packQuantity ?? null,
      unitsPerPack: packSnapshot?.unitsPerPack ?? null,
    });
    setHint("Added to cart");
    window.setTimeout(() => setHint(null), 2500);
  }, [
    addOrMergeLine,
    needsPack,
    needsGallerySku,
    product,
    purchaseSku,
    quantity,
    skuKey,
    skuOptions,
    unitPriceMinor,
    usesPackSku,
    packSnapshot,
  ]);

  const disabledTitle = needsPack
    ? "Choose a pack size first"
    : needsGallerySku
      ? "Choose a colour in the gallery first"
      : "Add to cart";

  if (layout === "retail") {
    return (
      <div className="pdp-purchase">
        <div className="pdp-purchase__row">
          <p className="pdp-purchase__stock" role="status">
            {stockLabel}
          </p>
          {onQuantityChange ? (
            <label className="pdp-purchase__qty">
              <span className="pdp-purchase__qty-label">Qty:</span>
              <input
                type="number"
                className="pdp-purchase__qty-input"
                min={1}
                max={qtyCap}
                step={1}
                inputMode="numeric"
                value={quantity}
                onChange={(e) => commitQty(e.target.value)}
                onBlur={(e) => commitQty(e.target.value)}
                aria-label="Quantity"
              />
            </label>
          ) : null}
          <button
            type="button"
            className="pdp-purchase__submit"
            onClick={onAdd}
            disabled={!canAdd}
            aria-disabled={!canAdd}
          >
            Add to cart
          </button>
        </div>
        {hint ? (
          <p className="pdp-purchase__flash" role="status">
            {hint}
          </p>
        ) : null}
        {err ? (
          <p className="pdp-purchase__error" role="alert">
            {err}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="pdp-add-to-cart-outer">
      <button
        type="button"
        className="pdp-add-to-cart__submit pdp-add-to-cart__submit--icon"
        onClick={onAdd}
        disabled={!canAdd}
        aria-disabled={!canAdd}
        aria-label="Add to cart"
        title={canAdd ? "Add to cart" : disabledTitle}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="9" cy="20" r="1" />
          <circle cx="18" cy="20" r="1" />
          <path d="M3 4h2l2.3 11.2a1 1 0 0 0 1 .8H19a1 1 0 0 0 1-.8L22 7H7" />
        </svg>
      </button>
      {hint ? (
        <p className="pdp-add-to-cart__flash pdp-add-to-cart__flash--below" role="status">
          {hint}
        </p>
      ) : null}
      {err ? (
        <p className="pdp-add-to-cart__error pdp-add-to-cart__error--below" role="alert">
          {err}
        </p>
      ) : null}
    </div>
  );
}
