import { useMemo, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.js";
import { useCart } from "../cart/CartContext.js";
import {
  clearCheckoutDraft,
  formatMinor,
  persistLastOrderEmail,
  placeStorefrontOrder,
  readCheckoutDraft,
  writeCheckoutDraft,
  type CheckoutDraft,
} from "../lib/checkoutApi.js";

export function CheckoutPaymentPage() {
  const { lines, clearCart } = useCart();
  const { getAccessToken } = useAuth();
  const navigate = useNavigate();
  const draft = readCheckoutDraft();
  const [method, setMethod] = useState<CheckoutDraft["paymentMethod"]>(draft?.paymentMethod ?? "mock_upi");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const total = useMemo(() => {
    let minor = 0;
    let currency = "INR";
    for (const ln of lines) {
      if (ln.unitPriceMinor == null) continue;
      minor += ln.unitPriceMinor * ln.quantity;
      if (ln.currency) currency = ln.currency;
    }
    return { minor, currency };
  }, [lines]);

  if (lines.length === 0 || !draft) return <Navigate to="/cart" replace />;

  const onPay = async () => {
    setError(null);
    setBusy(true);
    try {
      const nextDraft = { ...draft, paymentMethod: method };
      writeCheckoutDraft(nextDraft);
      const order = await placeStorefrontOrder({
        draft: nextDraft,
        lines,
        paymentStatus: "captured",
        accessToken: getAccessToken(),
      });
      clearCart();
      clearCheckoutDraft();
      persistLastOrderEmail(nextDraft.shopperEmail);
      navigate(`/checkout/confirmation/${encodeURIComponent(order.id)}`, {
        replace: true,
        state: { orderEmail: nextDraft.shopperEmail },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Payment could not be completed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="checkout-page cart-page">
      <header className="cart-page__header">
        <h1>Payment</h1>
        <p className="cart-page__lede">
          Mock checkout — no real charge. Admin and vendor inboxes receive order emails in dev.
        </p>
      </header>

      <section className="checkout-page__section">
        <p className="cart-page__subtotal">
          <strong>Amount due:</strong> {formatMinor(total.minor, total.currency)}
        </p>
        <p className="checkout-page__mock-note">
          Paying as <strong>{draft.shopperEmail}</strong>
        </p>
      </section>

      <fieldset className="checkout-payment-options">
        <legend className="checkout-page__section-title">Payment method</legend>
        <label className="checkout-payment-option">
          <input
            type="radio"
            name="pay"
            checked={method === "mock_upi"}
            onChange={() => setMethod("mock_upi")}
          />
          <span>UPI (mock)</span>
        </label>
        <label className="checkout-payment-option">
          <input
            type="radio"
            name="pay"
            checked={method === "mock_card"}
            onChange={() => setMethod("mock_card")}
          />
          <span>Card (mock)</span>
        </label>
      </fieldset>

      {method === "mock_card" ? (
        <div className="checkout-form-grid checkout-page__section">
          <label>
            Card number
            <input placeholder="4111 1111 1111 1111" disabled={busy} />
          </label>
          <label>
            Expiry
            <input placeholder="12/28" disabled={busy} />
          </label>
          <label>
            CVV
            <input placeholder="123" disabled={busy} />
          </label>
        </div>
      ) : (
        <div className="checkout-page__section checkout-page__mock-upi">
          <p>Scan or pay with any UPI app — this screen simulates success instantly.</p>
        </div>
      )}

      {error ? (
        <p className="storefront-error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="checkout-page__actions">
        <Link to="/checkout" className="cart-page__cta-secondary">
          Back
        </Link>
        <button type="button" className="cart-page__cta" disabled={busy} onClick={() => void onPay()}>
          {busy ? "Processing…" : "Pay now (mock)"}
        </button>
      </div>
    </div>
  );
}
