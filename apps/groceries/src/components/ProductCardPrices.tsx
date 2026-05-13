function formatMinor(minor: number | null, currency: string | null): string {
  if (minor == null) return "—";
  const unit = (currency ?? "INR").toUpperCase();
  const major = minor / 100;
  return `${unit} ${major.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function offerTypeLabel(offerType: string | null | undefined): string | null {
  if (!offerType || offerType === "none") return null;
  const t = offerType.toLowerCase();
  if (t === "flat") return "Flat off";
  if (t === "percent") return "% off";
  if (t === "bogo") return "Buy 2 get 1";
  return offerType;
}

export type ProductCardPricesProps = {
  /** Catalogue / product “from” price (minor units). */
  minPriceMinor: number | null;
  currency: string | null;
  /** MRP in commerce.pricing (optional). */
  listPriceMinor?: number | null;
  /** Explicit offer selling price in commerce.pricing (optional). */
  offerPriceMinor?: number | null;
  offerType?: string | null;
  offerCardText?: string | null;
  variant?: "card" | "detail";
  className?: string;
};

/**
 * Cards + PDP: offer pill when an offer is configured; sale price bold; MRP / original struck when higher than sale.
 */
export function ProductCardPrices({
  minPriceMinor,
  currency,
  listPriceMinor,
  offerPriceMinor,
  offerType,
  offerCardText,
  variant = "card",
  className = "",
}: ProductCardPricesProps) {
  const typeLbl = offerTypeLabel(offerType ?? null);
  const offerOn = Boolean(offerType && offerType.toLowerCase() !== "none");
  const showOfferRow = offerOn && Boolean(typeLbl || (offerCardText && offerCardText.trim()));

  const pm = minPriceMinor != null && Number.isFinite(minPriceMinor) ? minPriceMinor : null;
  const list = listPriceMinor != null && Number.isFinite(listPriceMinor) ? listPriceMinor : null;
  const offP = offerPriceMinor != null && Number.isFinite(offerPriceMinor) ? offerPriceMinor : null;

  let sale: number | null = null;
  let strike: number | null = null;

  if (offerOn && offP != null) {
    sale = offP;
    if (list != null && list > offP) strike = list;
    else if (pm != null && pm > offP) strike = pm;
  } else {
    sale = pm;
    if (list != null && sale != null && list > sale) strike = list;
  }

  const showStrike = strike != null && sale != null && strike > sale;

  const rootClass =
    (variant === "detail" ? "product-card-prices product-card-prices--detail" : "product-card-prices") +
    (className ? ` ${className}` : "");

  return (
    <div className={rootClass.trim()}>
      {showOfferRow && variant === "detail" ? (
        <div className="product-card-prices__offer">
          <span className="product-card-prices__pill" title={offerCardText?.trim() || undefined}>
            {typeLbl ? <span className="product-card-prices__pill-type">{typeLbl}</span> : null}
            {typeLbl && offerCardText?.trim() ? (
              <span className="product-card-prices__pill-sep" aria-hidden="true">
                {" "}
                ·{" "}
              </span>
            ) : null}
            {offerCardText?.trim() ? (
              <span className="product-card-prices__pill-text">{offerCardText.trim()}</span>
            ) : null}
          </span>
        </div>
      ) : null}
      <div className="product-card-prices__row">
        <span className="product-card-prices__sale">{formatMinor(sale, currency)}</span>
        {showStrike ? (
          <span className="product-card-prices__mrp">
            <s>{formatMinor(strike, currency)}</s>
          </span>
        ) : null}
      </div>
    </div>
  );
}
