import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { OrderDetailCard } from "../components/OrderDetailCard.js";
import { readLastOrderEmail } from "../lib/checkoutApi.js";
import { trackStorefrontOrder, type StorefrontOrderExtended } from "../lib/ordersApi.js";

export function OrderConfirmationPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const location = useLocation();
  const orderEmail =
    (location.state as { orderEmail?: string } | null)?.orderEmail?.trim() || readLastOrderEmail();
  const [order, setOrder] = useState<StorefrontOrderExtended | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId?.trim() || !orderEmail.trim()) return;
    let cancelled = false;
    void trackStorefrontOrder(orderId, orderEmail)
      .then((o) => {
        if (!cancelled) setOrder(o);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load order.");
      });
    return () => {
      cancelled = true;
    };
  }, [orderId, orderEmail]);

  if (error) {
    return (
      <div className="checkout-page cart-page">
        <p className="storefront-error" role="alert">
          {error}
        </p>
        <Link to="/orders/track" className="cart-page__cta">
          Track order
        </Link>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="checkout-page cart-page">
        <p className="storefront-loading">Loading confirmation…</p>
      </div>
    );
  }

  return (
    <div className="checkout-page cart-page checkout-confirmation">
      <header className="cart-page__header">
        <h1>Order placed</h1>
        <p className="cart-page__lede">
          Thank you. Order <strong>{order.id}</strong> is confirmed (mock payment).
        </p>
      </header>

      <p className="checkout-confirmation__email-note">
        Admin and vendor notification emails were queued. In local dev, see{" "}
        <code>services/commerce-api/Commerce.Api/uploads/order-emails/</code>.
      </p>

      <OrderDetailCard order={order} />

      <div className="checkout-page__actions">
        <Link
          to={`/orders/track/${encodeURIComponent(order.id)}?email=${encodeURIComponent(order.shopperEmail)}`}
          className="cart-page__cta"
        >
          Track this order
        </Link>
        <Link to="/orders" className="cart-page__cta-secondary">
          Order history
        </Link>
        <Link to="/" className="cart-page__cta-secondary">
          Continue shopping
        </Link>
      </div>
    </div>
  );
}
