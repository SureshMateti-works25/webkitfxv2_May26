import { useCallback, useMemo, useState } from "react";
import { useCart } from "../cart/CartContext.js";
import type { CatalogProductDetail } from "../lib/commerceApi.js";
import {
  buildCartSkuSelectOptions,
  resolveCartSkuFromKey,
  snapshotStorefrontUnitPriceMinor,
} from "../lib/storefrontCartAccess.js";

type Props = {
  product: CatalogProductDetail;
  skuFocus: { skuId: string | null; skuCode: string | null };
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

export function AddToCartButton({ product, skuFocus }: Props) {
  const { addOrMergeLine } = useCart();
  const [hint, setHint] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const skuOptions = useMemo(() => buildCartSkuSelectOptions(product), [product]);
  const skuKey = useMemo(() => resolveSkuKey(product, skuFocus, skuOptions), [product, skuFocus, skuOptions]);

  const needsSkuChoice = skuOptions.length > 1;
  const canAdd = !needsSkuChoice || skuKey.length > 0;

  const onAdd = useCallback(() => {
    setErr(null);
    setHint(null);
    if (needsSkuChoice && !skuKey) {
      setErr("Choose a colour in the gallery first.");
      return;
    }
    const key = skuKey || (skuOptions.length === 1 ? skuOptions[0]!.value : "");
    const { skuId, skuCode } = resolveCartSkuFromKey(product, key);
    addOrMergeLine({
      productId: product.id,
      slug: product.slug,
      titleDisplay: product.titleDisplay,
      skuId,
      skuCode,
      quantity: 1,
      unitPriceMinor: snapshotStorefrontUnitPriceMinor(product),
      currency: product.currency,
      heroStorageKey: product.heroStorageKey?.trim() || null,
      vendorCode: product.vendorCode?.trim() || null,
    });
    setHint("Added to cart");
    window.setTimeout(() => setHint(null), 2500);
  }, [addOrMergeLine, needsSkuChoice, product, skuKey, skuOptions]);

  return (
    <div className="pdp-add-to-cart-outer">
      <button
        type="button"
        className="pdp-add-to-cart__submit pdp-add-to-cart__submit--icon"
        onClick={onAdd}
        disabled={!canAdd}
        aria-disabled={!canAdd}
        aria-label="Add to cart"
        title={canAdd ? "Add to cart" : "Choose a colour in the gallery first"}
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
