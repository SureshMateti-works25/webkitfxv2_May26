import { formatPaymentStatusLabel, type KdsOrderMeta } from "../lib/orderTableDisplay.js";

type Props = {
  order: KdsOrderMeta;
};

export function KdsOrderHeader({ order }: Props) {
  const hasTable = Boolean(order.displayTableCode);

  return (
    <header className="kds-order-header" aria-label="Order summary for kitchen">
      <div className="kds-order-header__table-wrap">
        <span className="kds-order-header__table-label">Table</span>
        <span
          className={[
            "kds-order-header__table-value",
            hasTable ? "" : "kds-order-header__table-value--empty",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {order.displayTableCode ?? "—"}
        </span>
      </div>
      <div className="kds-order-header__meta">
        <span className="kds-order-header__id">{order.id}</span>
        <span className="kds-order-header__channel">{order.displayChannelLabel}</span>
        <span className="kds-order-header__payment">{formatPaymentStatusLabel(order.paymentStatus)}</span>
        <span className="kds-order-header__status">{order.fulfillmentStatus}</span>
      </div>
    </header>
  );
}
