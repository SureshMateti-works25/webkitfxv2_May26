import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.js";
import { getAtPath } from "@webkitfxv2/core-engine";
import { OrderDetailCard } from "../components/OrderDetailCard.js";
import { trackStorefrontOrder, type StorefrontOrderExtended } from "../lib/ordersApi.js";

export function OrderTrackingPage() {
  const { orderId: routeOrderId } = useParams<{ orderId?: string }>();
  const [searchParams] = useSearchParams();
  const { auth, getAccessToken } = useAuth();

  const defaultEmail =
    auth.status === "signedIn"
      ? String(getAtPath(auth.payload, "email") ?? getAtPath(auth.payload, "shopperEmail") ?? "")
      : "";

  const [orderId, setOrderId] = useState(routeOrderId ?? "");
  const [email, setEmail] = useState(searchParams.get("email") ?? defaultEmail);
  const [order, setOrder] = useState<StorefrontOrderExtended | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!routeOrderId?.trim() || !email.trim()) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    void trackStorefrontOrder(routeOrderId, email, getAccessToken())
      .then((o) => {
        if (!cancelled) {
          setOrder(o);
          setOrderId(o.id);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load order.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [routeOrderId, email, getAccessToken]);

  const onLookup = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setOrder(null);
    const id = orderId.trim();
    const em = email.trim();
    if (!id || !em.includes("@")) {
      setError("Enter order ID and checkout email.");
      return;
    }
    setLoading(true);
    void trackStorefrontOrder(id, em, getAccessToken())
      .then(setOrder)
      .catch((err) => setError(err instanceof Error ? err.message : "Lookup failed."))
      .finally(() => setLoading(false));
  };

  return (
    <div className="checkout-page cart-page">
      <header className="cart-page__header">
        <h1>Track order</h1>
        <p className="cart-page__lede">Use the order ID from confirmation and the email used at checkout.</p>
      </header>

      <form className="order-track-lookup checkout-form-grid" onSubmit={onLookup}>
        <label>
          Order ID
          <input value={orderId} onChange={(e) => setOrderId(e.target.value)} placeholder="ord_…" required />
        </label>
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <div className="checkout-form-grid__full">
          <button type="submit" className="cart-page__cta" disabled={loading}>
            {loading ? "Looking up…" : "Track order"}
          </button>
        </div>
      </form>

      {error ? (
        <p className="storefront-error" role="alert">
          {error}
        </p>
      ) : null}

      {order ? <OrderDetailCard order={order} /> : null}

      <p className="checkout-page__actions">
        <Link to="/orders" className="cart-page__cta-secondary">
          Order history
        </Link>
        <Link to="/" className="cart-page__cta-secondary">
          Home
        </Link>
      </p>
    </div>
  );
}
