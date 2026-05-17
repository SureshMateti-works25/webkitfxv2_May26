import { useMemo, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.js";
import { useCart } from "../cart/CartContext.js";
import { getAtPath } from "@webkitfxv2/core-engine";
import {
  formatMinor,
  readCheckoutDraft,
  writeCheckoutDraft,
  type CheckoutDraft,
  type ShippingAddress,
} from "../lib/checkoutApi.js";

const defaultAddress: ShippingAddress = {
  line1: "",
  line2: "",
  city: "",
  state: "",
  postalCode: "",
  country: "IN",
};

export function CheckoutPage() {
  const { lines } = useCart();
  const { auth } = useAuth();
  const navigate = useNavigate();
  const existing = readCheckoutDraft();

  const profileEmail =
    auth.status === "signedIn"
      ? String(getAtPath(auth.payload, "email") ?? getAtPath(auth.payload, "shopperEmail") ?? "")
      : "";

  const [shopperEmail, setShopperEmail] = useState(existing?.shopperEmail ?? profileEmail);
  const [shopperName, setShopperName] = useState(
    existing?.shopperName ??
      (auth.status === "signedIn" ? String(getAtPath(auth.payload, "fullName") ?? "") : "")
  );
  const [shopperPhone, setShopperPhone] = useState(existing?.shopperPhone ?? "");
  const [shippingAddress, setShippingAddress] = useState<ShippingAddress>(
    existing?.shippingAddress ?? defaultAddress
  );
  const [error, setError] = useState<string | null>(null);

  const subtotal = useMemo(() => {
    let minor = 0;
    let currency = "INR";
    for (const ln of lines) {
      if (ln.unitPriceMinor == null) continue;
      minor += ln.unitPriceMinor * ln.quantity;
      if (ln.currency) currency = ln.currency;
    }
    return { minor, currency };
  }, [lines]);

  if (lines.length === 0) return <Navigate to="/cart" replace />;

  const onContinue = () => {
    setError(null);
    const email = shopperEmail.trim();
    if (!email.includes("@")) {
      setError("Enter a valid email for order updates.");
      return;
    }
    if (!shippingAddress.line1.trim() || !shippingAddress.city.trim()) {
      setError("Enter at least street address and city.");
      return;
    }
    const draft: CheckoutDraft = {
      shopperEmail: email,
      shopperName: shopperName.trim(),
      shopperPhone: shopperPhone.trim(),
      shippingAddress: {
        ...shippingAddress,
        line1: shippingAddress.line1.trim(),
        city: shippingAddress.city.trim(),
        state: shippingAddress.state.trim(),
        postalCode: shippingAddress.postalCode.trim(),
        country: shippingAddress.country.trim() || "IN",
      },
      paymentMethod: existing?.paymentMethod ?? "mock_upi",
    };
    writeCheckoutDraft(draft);
    navigate("/checkout/payment");
  };

  return (
    <div className="checkout-page cart-page">
      <header className="cart-page__header">
        <h1>Checkout</h1>
        <p className="cart-page__lede">Review your details before mock payment.</p>
      </header>

      <section className="checkout-page__section" aria-labelledby="checkout-contact">
        <h2 id="checkout-contact" className="checkout-page__section-title">
          Contact
        </h2>
        <div className="checkout-form-grid">
          <label>
            Email
            <input type="email" autoComplete="email" value={shopperEmail} onChange={(e) => setShopperEmail(e.target.value)} required />
          </label>
          <label>
            Full name
            <input type="text" autoComplete="name" value={shopperName} onChange={(e) => setShopperName(e.target.value)} />
          </label>
          <label>
            Phone
            <input type="tel" autoComplete="tel" value={shopperPhone} onChange={(e) => setShopperPhone(e.target.value)} />
          </label>
        </div>
      </section>

      <section className="checkout-page__section" aria-labelledby="checkout-ship">
        <h2 id="checkout-ship" className="checkout-page__section-title">
          Delivery address
        </h2>
        <div className="checkout-form-grid">
          <label className="checkout-form-grid__full">
            Address line 1
            <input value={shippingAddress.line1} onChange={(e) => setShippingAddress((a) => ({ ...a, line1: e.target.value }))} required />
          </label>
          <label className="checkout-form-grid__full">
            Address line 2
            <input value={shippingAddress.line2 ?? ""} onChange={(e) => setShippingAddress((a) => ({ ...a, line2: e.target.value }))} />
          </label>
          <label>
            City
            <input value={shippingAddress.city} onChange={(e) => setShippingAddress((a) => ({ ...a, city: e.target.value }))} required />
          </label>
          <label>
            State
            <input value={shippingAddress.state} onChange={(e) => setShippingAddress((a) => ({ ...a, state: e.target.value }))} />
          </label>
          <label>
            PIN / postal code
            <input value={shippingAddress.postalCode} onChange={(e) => setShippingAddress((a) => ({ ...a, postalCode: e.target.value }))} />
          </label>
          <label>
            Country
            <input value={shippingAddress.country} onChange={(e) => setShippingAddress((a) => ({ ...a, country: e.target.value }))} />
          </label>
        </div>
      </section>

      <section className="checkout-page__section" aria-labelledby="checkout-summary">
        <h2 id="checkout-summary" className="checkout-page__section-title">
          Order summary
        </h2>
        <ul className="cart-page__lines">
          {lines.map((ln) => (
            <li key={ln.lineId} className="cart-line">
              <div className="cart-line__main">
                <span className="cart-line__title">{ln.titleDisplay}</span>
                <p className="cart-line__meta">
                  Qty {ln.quantity}
                  {ln.skuCode ? ` · SKU ${ln.skuCode}` : null}
                </p>
              </div>
            </li>
          ))}
        </ul>
        <p className="cart-page__subtotal">
          <strong>Estimated total:</strong> {formatMinor(subtotal.minor, subtotal.currency)}
        </p>
      </section>

      {error ? (
        <p className="storefront-error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="checkout-page__actions">
        <Link to="/cart" className="cart-page__cta-secondary">
          Back to cart
        </Link>
        <button type="button" className="cart-page__cta" onClick={onContinue}>
          Continue to payment
        </button>
      </div>
    </div>
  );
}
