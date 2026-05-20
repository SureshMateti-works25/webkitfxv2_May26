import { useCallback, useState, type MouseEvent } from "react";
import { Link } from "react-router-dom";
import { useCart } from "../cart/CartContext.js";
import type { CatalogProductCard } from "../lib/commerceApi.js";
import { snapshotCardUnitPriceMinor } from "../lib/storefrontCartAccess.js";
import { CatalogProductVisual } from "./CatalogProductVisual.js";
import { ProductCardPrices } from "./ProductCardPrices.js";

function isDealProduct(p: CatalogProductCard): boolean {
  const offerOn = Boolean(p.offerType && p.offerType.toLowerCase() !== "none");
  if (offerOn && p.offerPriceMinor != null && Number.isFinite(p.offerPriceMinor)) return true;
  const list = p.listPriceMinor;
  const min = p.minPriceMinor;
  if (list != null && min != null && Number.isFinite(list) && Number.isFinite(min) && list > min) return true;
  return false;
}

export type CatalogGridProductCardProps = {
  product: CatalogProductCard;
  /** Narrow carousel tiles: shorter button label ("Add"). */
  compactAddLabel?: boolean;
  /**
   * `grocery` — shared grid chrome (same as groceries app).
   * `storefront` — Nistta saree card chrome (`.storefront-product-card--with-actions`).
   */
  skin?: "grocery" | "storefront";
};

export function CatalogGridProductCard({ product, compactAddLabel, skin = "grocery" }: CatalogGridProductCardProps) {
  const { addOrMergeLine } = useCart();
  const [addedFlash, setAddedFlash] = useState(false);
  const deal = isDealProduct(product);

  const onAdd = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();
      const codes = (product.skuCodes ?? []).map((c) => c.trim()).filter(Boolean);
      const skuCode = codes.length > 0 ? codes[0]! : null;
      void (async () => {
        try {
          await addOrMergeLine({
            productId: product.id,
            slug: product.slug,
            titleDisplay: product.titleDisplay,
            skuId: null,
            skuCode,
            quantity: 1,
            unitPriceMinor: snapshotCardUnitPriceMinor(product),
            currency: product.currency,
            heroStorageKey: product.heroStorageKey?.trim() || null,
            vendorCode: product.vendorCode?.trim() || null,
          });
          setAddedFlash(true);
          window.setTimeout(() => setAddedFlash(false), 1400);
        } catch {
          /* sign-in required or API error */
        }
      })();
    },
    [addOrMergeLine, product]
  );

  const addLabel = compactAddLabel ? "Add" : "Add to cart";

  if (skin === "storefront") {
    return (
      <div
        className={`storefront-product-card storefront-product-card--with-actions${
          deal ? " storefront-product-card--deal" : ""
        }`}
      >
        {deal ? (
          <span className="storefront-product-card__deal-badge" aria-label="Deal">
            Deal
          </span>
        ) : null}
        <Link to={`/p/${encodeURIComponent(product.slug)}`} className="storefront-product-card__main">
          <div className="storefront-product-card__media">
            <CatalogProductVisual
              storageKey={product.heroStorageKey}
              alt={product.titleDisplay}
              imageIndicators={product.imageIndicators}
              vendorCode={product.vendorCode}
              skuCodes={product.skuCodes}
            />
          </div>
          <div className="storefront-product-card__body">
            <h3 className="storefront-product-card__title">{product.titleDisplay}</h3>
            <ProductCardPrices
              minPriceMinor={product.minPriceMinor}
              currency={product.currency}
              listPriceMinor={product.listPriceMinor}
              offerPriceMinor={product.offerPriceMinor}
              offerType={product.offerType}
              offerCardText={product.offerCardText}
            />
          </div>
        </Link>
        <button
          type="button"
          className="storefront-product-card__add"
          onClick={onAdd}
          aria-label={`Add ${product.titleDisplay} to cart`}
        >
          {addedFlash ? "Added" : addLabel}
        </button>
      </div>
    );
  }

  return (
    <div className={`grocery-landing-product-card${deal ? " grocery-landing-product-card--deal" : ""}`}>
      {deal ? (
        <span className="grocery-landing-product-card__deal-badge" aria-label="Deal">
          Deal
        </span>
      ) : null}
      <Link to={`/p/${encodeURIComponent(product.slug)}`} className="grocery-landing-product-card__link">
        <div className="grocery-landing-product-card__media">
          <CatalogProductVisual
            storageKey={product.heroStorageKey}
            alt={product.titleDisplay}
            imageIndicators={product.imageIndicators}
            vendorCode={product.vendorCode}
            skuCodes={product.skuCodes}
          />
        </div>
        <ProductCardPrices
          className="grocery-landing-product-card__prices"
          minPriceMinor={product.minPriceMinor}
          currency={product.currency}
          listPriceMinor={product.listPriceMinor}
          offerPriceMinor={product.offerPriceMinor}
          offerType={product.offerType}
          offerCardText={product.offerCardText}
        />
        <p className="grocery-landing-product-card__title">{product.titleDisplay}</p>
      </Link>
      <button
        type="button"
        className="grocery-landing-product-card__add"
        onClick={onAdd}
        aria-label={`Add ${product.titleDisplay} to cart`}
      >
        {addedFlash ? "Added" : addLabel}
      </button>
    </div>
  );
}
