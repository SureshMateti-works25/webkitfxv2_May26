import { useCallback, useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.js";
import { formatCommerceApiError } from "../lib/commerceApi.js";
import { KdsOrderHeader } from "../components/KdsOrderHeader.js";
import { KitchenWorkflowPanel } from "../components/KitchenWorkflowPanel.js";
import { OrderDetailCard } from "../components/OrderDetailCard.js";
import { OrderManageForm } from "../components/OrderManageForm.js";
import { getScreenConfig } from "../config/getScreenConfig.js";
import { enrichOrderForKds, formatOrderTableLabel } from "../lib/orderTableDisplay.js";
import {
  formatMinor,
  listVendorOrders,
  patchVendorOrder,
  type StorefrontOrderExtended,
} from "../lib/ordersApi.js";

export function VendorOrdersPage() {
  const copy = getScreenConfig("vendorOrders");
  const { auth, getAccessToken } = useAuth();
  const [orders, setOrders] = useState<StorefrontOrderExtended[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const selected = orders.find((o) => o.id === selectedId) ?? null;
  const selectedKds = selected ? enrichOrderForKds(selected) : null;

  const load = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;
    setLoading(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const list = await listVendorOrders(token);
      setOrders(list);
      if (list.length > 0 && !list.some((o) => o.id === selectedId)) setSelectedId(list[0]!.id);
    } catch (e) {
      setError(formatCommerceApiError(e));
    } finally {
      setLoading(false);
    }
  }, [getAccessToken, selectedId]);

  useEffect(() => {
    if (auth.status === "signedIn" && auth.role === "vendor") void load();
  }, [auth.status, auth.role, load]);

  if (auth.status !== "signedIn" || auth.role !== "vendor") {
    return <Navigate to="/login" replace />;
  }

  const onSave = async (patch: { fulfillmentStatus: string; trackingNote: string }) => {
    const token = getAccessToken();
    if (!token || !selected) return;
    setSaving(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const updated = await patchVendorOrder(token, selected.id, patch);
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
      const statusLabel =
        patch.fulfillmentStatus.charAt(0).toUpperCase() + patch.fulfillmentStatus.slice(1);
      setSuccessMessage(
        `Order ${updated.id} saved — status is now “${statusLabel}”.` +
          (updated.trackingNote ? ` Tracking: ${updated.trackingNote}.` : "")
      );
    } catch (e) {
      setError(formatCommerceApiError(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="portal-orders-page">
      <header className="cart-page__header">
        <h1>{String(copy.title ?? "Kitchen queue")}</h1>
        <p className="cart-page__lede">{String(copy.lede ?? "")}</p>
        <p className="cart-page__lede cart-page__lede--muted">
          {String(copy.workflowHint ?? "")}
        </p>
        <Link to="/vendor/tables" className="cart-page__cta-secondary">
          Table management
        </Link>
        <Link to="/vendor/products" className="cart-page__cta-secondary">
          My products
        </Link>
      </header>

      {error ? (
        <p className="storefront-error" role="alert">
          {error}
        </p>
      ) : null}
      {successMessage ? (
        <p className="vendor-workspace-msg" role="status" aria-live="polite">
          {successMessage}
        </p>
      ) : null}

      {loading ? (
        <p className="storefront-loading">Loading orders…</p>
      ) : (
        <div className="portal-orders-layout">
          <aside className="portal-orders-list" aria-label="Order list">
            {orders.length === 0 ? (
              <p>No orders with your products yet.</p>
            ) : (
              <ul>
                {orders.map((o) => {
                  const kds = enrichOrderForKds(o);
                  return (
                  <li key={o.id}>
                    <button
                      type="button"
                      className={[
                        "portal-orders-list__btn",
                        o.id === selectedId ? "portal-orders-list__btn--active" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      onClick={() => {
                        setSelectedId(o.id);
                        setSuccessMessage(null);
                        setError(null);
                      }}
                    >
                      <span className="portal-orders-list__table">
                        {kds.displayTableCode ?? "—"}
                      </span>
                      <span className="portal-orders-list__summary">
                        <strong>{o.id}</strong>
                        <span>
                          {kds.displayChannelLabel} · {o.fulfillmentStatus} ·{" "}
                          {formatMinor(o.totalMinor, o.currency)}
                        </span>
                      </span>
                    </button>
                  </li>
                  );
                })}
              </ul>
            )}
          </aside>

          <div className="portal-orders-detail">
            {selectedKds ? (
              <>
                <KdsOrderHeader order={selectedKds} />
                <KitchenWorkflowPanel
                  orderChannel={selectedKds.orderChannel}
                  fulfillmentStatus={selectedKds.fulfillmentStatus}
                  tableCode={selectedKds.displayTableCode}
                />
                <OrderManageForm order={selectedKds} saving={saving} onSave={onSave} />
                <OrderDetailCard order={selectedKds} />
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
