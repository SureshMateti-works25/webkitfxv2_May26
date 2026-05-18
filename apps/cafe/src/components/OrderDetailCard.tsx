import { formatOrderTableLabel, formatPaymentStatusLabel, orderChannelLabel } from "../lib/orderTableDisplay.js";
import { formatMinor, type StorefrontOrderExtended } from "../lib/ordersApi.js";
import { OrderTrackingTimeline } from "./OrderTrackingTimeline.js";

export function OrderDetailCard({ order }: { order: StorefrontOrderExtended }) {
  const addr = order.shippingAddress;
  const addressLine = addr
    ? [addr.line1, addr.line2, addr.city, addr.state, addr.postalCode, addr.country]
        .filter(Boolean)
        .join(", ")
    : "—";

  return (
    <article className="order-detail-card">
      <header className="order-detail-card__head">
        <h2 className="order-detail-card__id">{order.id}</h2>
        <p className="order-detail-card__meta">
          Placed {new Date(order.placedAt).toLocaleString()} · {formatMinor(order.totalMinor, order.currency)}
        </p>
        <p className="order-detail-card__meta">
          {order.shopperName ? `${order.shopperName} · ` : ""}
          {order.shopperEmail}
          {order.shopperPhone ? ` · ${order.shopperPhone}` : ""}
        </p>
        <p className="order-detail-card__meta">Ship to: {addressLine}</p>
        <p className="order-detail-card__meta">
          Table: <strong>{formatOrderTableLabel(order)}</strong>
        </p>
        <p className="order-detail-card__meta">
          Channel: {orderChannelLabel(order.orderChannel)} · Payment:{" "}
          <strong>{formatPaymentStatusLabel(order.paymentStatus)}</strong>
        </p>
        <p className="order-detail-card__status">
          Fulfillment: <strong>{order.fulfillmentStatus}</strong>
          {order.trackingNote ? ` · ${order.trackingNote}` : null}
        </p>
      </header>

      <OrderTrackingTimeline steps={order.trackingTimeline} />

      <ul className="cart-page__lines">
        {order.lines.map((ln) => (
          <li key={ln.id} className="cart-line">
            <div className="cart-line__main">
              <span className="cart-line__title">{ln.titleDisplay}</span>
              <p className="cart-line__meta">
                Qty {ln.quantity}
                {ln.skuCode ? ` · SKU ${ln.skuCode}` : null}
                {ln.vendorCode ? ` · ${ln.vendorCode}` : null}
              </p>
              <p className="cart-line__price">{formatMinor(ln.lineTotalMinor, ln.currency)}</p>
            </div>
          </li>
        ))}
      </ul>
    </article>
  );
}
