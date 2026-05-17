import { useCallback, useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.js";
import { formatCommerceApiError } from "../lib/commerceApi.js";
import { OrderDetailCard } from "../components/OrderDetailCard.js";
import {
  formatMinor,
  listAdminOrders,
  type StorefrontOrderExtended,
} from "../lib/ordersApi.js";

export function AdminOrdersPage() {
  const { auth, getAccessToken } = useAuth();
  const [orders, setOrders] = useState<StorefrontOrderExtended[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const selected = orders.find((o) => o.id === selectedId) ?? null;

  const load = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const list = await listAdminOrders(token);
      setOrders(list);
      if (list.length > 0 && !list.some((o) => o.id === selectedId)) setSelectedId(list[0]!.id);
    } catch (e) {
      setError(formatCommerceApiError(e));
    } finally {
      setLoading(false);
    }
  }, [getAccessToken, selectedId]);

  useEffect(() => {
    if (auth.status === "signedIn" && auth.role === "admin") void load();
  }, [auth.status, auth.role, load]);

  if (auth.status !== "signedIn" || auth.role !== "admin") {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="portal-orders-page">
      <header className="cart-page__header">
        <h1>Monitor orders</h1>
        <p className="cart-page__lede">
          Read-only view of storefront orders. Vendors pack and ship; use this to review fulfillment, vendors, and
          amounts for policy or commission checks.
        </p>
      </header>

      {error ? (
        <p className="storefront-error" role="alert">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="storefront-loading">Loading orders…</p>
      ) : (
        <div className="portal-orders-layout">
          <aside className="portal-orders-list" aria-label="Order list">
            {orders.length === 0 ? (
              <p>No orders yet.</p>
            ) : (
              <ul>
                {orders.map((o) => (
                  <li key={o.id}>
                    <button
                      type="button"
                      className={[
                        "portal-orders-list__btn",
                        o.id === selectedId ? "portal-orders-list__btn--active" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      onClick={() => setSelectedId(o.id)}
                    >
                      <strong>{o.id}</strong>
                      <span>
                        {o.fulfillmentStatus} · {formatMinor(o.totalMinor, o.currency)}
                      </span>
                      <span>{new Date(o.placedAt).toLocaleDateString()}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </aside>

          <div className="portal-orders-detail">
            {selected ? (
              <>
                <OrderDetailCard order={selected} />
                <Link
                  to={`/orders/track/${encodeURIComponent(selected.id)}?email=${encodeURIComponent(selected.shopperEmail)}`}
                  className="cart-page__cta-secondary"
                >
                  View as shopper tracking
                </Link>
              </>
            ) : (
              <p>Select an order.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
