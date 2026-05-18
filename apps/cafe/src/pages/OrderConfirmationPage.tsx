import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { OrderDetailCard } from "../components/OrderDetailCard.js";
import { getScreenConfig } from "../config/getScreenConfig.js";
import { isPayAtTableChannel } from "../lib/cafeCheckoutFlow.js";
import { readLastOrderEmail } from "../lib/checkoutApi.js";
import { clearQrOrderSession } from "../lib/qrOrderSession.js";
import { buildQrMenuPath } from "../lib/qrOrderUrls.js";
import { trackStorefrontOrder, type StorefrontOrderExtended } from "../lib/ordersApi.js";

export function OrderConfirmationPage() {
  const copy = getScreenConfig("orderConfirmation");
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

  useEffect(() => {
    if (!order) return;
    if (order.orderChannel === "qr") clearQrOrderSession();
  }, [order]);

  if (error) {
    return (
      <div className="checkout-page cart-page">
        <p className="storefront-error" role="alert">
          {error}
        </p>
        <Link to="/orders/track" className="cart-page__cta">
          {String(copy.trackCta ?? "Track order")}
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

  const channel = (order.orderChannel ?? "").trim().toLowerCase();
  const payAtTable = isPayAtTableChannel(channel);
  const isQr = channel === "qr";

  const title = payAtTable
    ? String(copy.dineInTitle ?? copy.title ?? "Order placed")
    : isQr
      ? String(copy.qrTitle ?? copy.title ?? "Order placed")
      : String(copy.title ?? "Order placed");

  const lede = payAtTable
    ? String(copy.dineInLede ?? copy.lede ?? "")
    : isQr
      ? String(copy.qrLede ?? copy.lede ?? "")
      : String(copy.lede ?? "");

  const paymentNote = payAtTable
    ? "No online payment was taken. Settle your bill at the table when you are finished."
    : "Mock payment was recorded for this order.";

  const continuePath =
    isQr && order.tableCode ? buildQrMenuPath(order.tableCode) : payAtTable ? "/" : "/";

  return (
    <div className="checkout-page cart-page checkout-confirmation">
      <header className="cart-page__header">
        <h1>{title}</h1>
        <p className="cart-page__lede">
          {lede} Order <strong>{order.id}</strong>.
        </p>
      </header>

      <p className="checkout-confirmation__email-note">{paymentNote}</p>
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
          {String(copy.trackCta ?? "Track this order")}
        </Link>
        <Link to="/orders" className="cart-page__cta-secondary">
          Order history
        </Link>
        <Link to={continuePath} className="cart-page__cta-secondary">
          {String(copy.homeCta ?? "Continue shopping")}
        </Link>
      </div>
    </div>
  );
}
