import type { CatalogProductCard } from "../lib/commerceApi.js";
import { mediaAssetUrl } from "../lib/commerceApi.js";
import { formatMinorAmount } from "../lib/formatMinor.js";

export function ProductCard({ product }: { product: CatalogProductCard }) {
  const img = product.heroStorageKey ? (
    <img
      src={mediaAssetUrl(product.heroStorageKey)}
      alt={product.titleDisplay}
      className="grocery-card__img"
      loading="lazy"
      decoding="async"
    />
  ) : (
    <div className="grocery-card__img grocery-card__img--placeholder" aria-hidden />
  );

  const price = formatMinorAmount(product.minPriceMinor, product.currency);

  return (
    <article className="grocery-card">
      <div className="grocery-card__media">{img}</div>
      <div className="grocery-card__body">
        <h3 className="grocery-card__title">{product.titleDisplay}</h3>
        <p className="grocery-card__price">{price}</p>
      </div>
    </article>
  );
}
