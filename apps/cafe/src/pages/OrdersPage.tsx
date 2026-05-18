import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.js";
import { getAtPath } from "@webkitfxv2/core-engine";
import { formatMinor, listShopperOrders } from "../lib/checkoutApi.js";
import { normalizeOrderExtended, type StorefrontOrderExtended } from "../lib/ordersApi.js";

export function OrdersPage() {
  const { auth, getAccessToken } = useAuth();
  const [orders, setOrders] = useState<StorefrontOrderExtended[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const profileEmail =
    auth.status === "signedIn"
      ? String(getAtPath(auth.payload, "email") ?? getAtPath(auth.payload, "shopperEmail") ?? "")
      : "";

  useEffect(() => {
    const token = getAccessToken();
    if (auth.status !== "signedIn" || auth.role !== "shopper" || !token) {
      setOrders([]);
      return;
    }
    let cancelled = false;
    void listShopperOrders(token)
      .then((items) => {
        if (!cancelled)
          setOrders(
            items.map((o) =>
              normalizeOrderExtended(o as unknown as Record<string, unknown>)
            )
          );
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load orders.");
      });
    return () => {
      cancelled = true;
    };
  }, [auth.status, auth.role, getAccessToken]);

  return (
    <div className="checkout-page cart-page">
      <header className="cart-page__header">
        <h1>Your orders</h1>
        <p className="cart-page__lede">
          Signed-in order history. Guests can{" "}
          <Link to="/orders/track">track an order</Link> with ID and email.
        </p>
      </header>

      <p className="checkout-page__actions">
        <Link to="/orders/track" className="cart-page__cta">
          Track order
        </Link>
      </p>

      {auth.status !== "signedIn" || auth.role !== "shopper" ? (
        <p>
          <Link to="/login">Sign in as a shopper</Link> to see orders linked to your account.
        </p>
      ) : null}

      {error ? (
        <p className="storefront-error" role="alert">
          {error}
        </p>
      ) : null}

      {auth.status === "signedIn" && auth.role === "shopper" && orders === null ? (
        <p className="storefront-loading">Loading orders…</p>
      ) : null}

      {orders && orders.length === 0 && auth.status === "signedIn" ? <p>No orders yet.</p> : null}

      {orders && orders.length > 0 ? (
        <ul className="orders-list">
          {orders.map((o) => (
            <li key={o.id} className="orders-list__item">
              <Link
                to={`/orders/track/${encodeURIComponent(o.id)}?email=${encodeURIComponent(profileEmail || o.shopperEmail)}`}
              >
                <strong>{o.id}</strong>
              </Link>
              <span>
                {o.fulfillmentStatus} · {new Date(o.placedAt).toLocaleString()} ·{" "}
                {formatMinor(o.totalMinor, o.currency)}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
