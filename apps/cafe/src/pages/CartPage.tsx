import { Link } from "react-router-dom";
import { useMemo } from "react";
import { getScreenConfig } from "../config/getScreenConfig.js";
import { useCart } from "../cart/CartContext.js";

function formatMinor(minor: number | null, currency: string | null): string {
  if (minor == null) return "—";
  const unit = (currency ?? "INR").toUpperCase();
  const major = minor / 100;
  return `${unit} ${major.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function CartPage() {
  const copy = getScreenConfig("cart");
  const { lines, totalQuantity, setLineQuantity, removeLine, clearCart } = useCart();

  const subtotalHint = useMemo(() => {
    if (lines.length === 0) return null;
    const byCurrency = new Map<string, number>();
    for (const ln of lines) {
      const c = (ln.currency ?? "INR").toUpperCase();
      const u = ln.unitPriceMinor;
      if (u == null || !Number.isFinite(u)) continue;
      byCurrency.set(c, (byCurrency.get(c) ?? 0) + u * ln.quantity);
    }
    if (byCurrency.size === 0) return null;
    return [...byCurrency.entries()]
      .map(([cur, minor]) => formatMinor(Math.round(minor), cur))
      .join(" · ");
  }, [lines]);

  return (
    <div className="cart-page">
      <header className="cart-page__header">
        <h1>{String(copy.title ?? "")}</h1>
        <p className="cart-page__lede">{String(copy.body ?? "")}</p>
      </header>

      {lines.length === 0 ? (
        <div className="cart-page__empty">
          <p>{copy.emptyHint ?? "Your cart is empty."}</p>
          <Link to="/search" className="cart-page__cta">
            {copy.continueShoppingLabel ?? "Continue shopping"}
          </Link>
        </div>
      ) : (
        <>
          <div className="cart-page__toolbar">
            <button type="button" className="cart-page__linkish" onClick={() => clearCart()}>
              {copy.clearCartLabel ?? "Clear cart"}
            </button>
            <Link to="/search" className="cart-page__cta-secondary">
              {copy.continueShoppingLabel ?? "Continue shopping"}
            </Link>
          </div>
          {subtotalHint ? (
            <p className="cart-page__subtotal">
              <strong>{copy.subtotalLabel ?? "Estimated subtotal"}:</strong> {subtotalHint}
            </p>
          ) : null}
          <p className="cart-page__units" aria-live="polite">
            {totalQuantity} {totalQuantity === 1 ? "unit" : "units"} in cart
          </p>
          <div className="cart-page__checkout-row">
            <Link to="/checkout" className="cart-page__cta">
              Proceed to checkout
            </Link>
          </div>
          <ul className="cart-page__lines">
            {lines.map((ln) => (
              <li key={ln.lineId} className="cart-line">
                <div className="cart-line__main">
                  <Link to={`/p/${encodeURIComponent(ln.slug)}`} className="cart-line__title">
                    {ln.titleDisplay || ln.slug}
                  </Link>
                  <p className="cart-line__meta">
                    {ln.vendorCode ? <span>{ln.vendorCode}</span> : null}
                    {ln.skuCode ? <span>SKU {ln.skuCode}</span> : null}
                  </p>
                  <p className="cart-line__price">{formatMinor(ln.unitPriceMinor, ln.currency)} each</p>
                </div>
                <label className="cart-line__qty">
                  <span className="cart-line__qty-label">{copy.lineQtyLabel ?? "Qty"}</span>
                  <input
                    type="number"
                    min={1}
                    max={999}
                    value={ln.quantity}
                    onChange={(e) => setLineQuantity(ln.lineId, Number(e.target.value))}
                    aria-label={`Quantity for ${ln.titleDisplay}`}
                  />
                </label>
                <button type="button" className="cart-line__remove" onClick={() => removeLine(ln.lineId)}>
                  {copy.removeLineLabel ?? "Remove"}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
