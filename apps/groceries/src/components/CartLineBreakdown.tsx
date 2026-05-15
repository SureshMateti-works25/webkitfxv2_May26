import type { CartLine } from "../cart/CartContext.js";
import {
  cartLineHasPackPricing,
  cartPackSnapshotFromFields,
  formatCartLineTotalMeasure,
} from "../lib/cartLineMeasure.js";
import { formatMinorAmount } from "../lib/formatMinor.js";

type Props = {
  line: CartLine;
  formatMinor?: (minor: number | null, currency: string | null) => string;
};

function defaultFormatMinor(minor: number | null, currency: string | null): string {
  return formatMinorAmount(minor, currency);
}

export function CartLineBreakdown({ line, formatMinor = defaultFormatMinor }: Props) {
  const pack = cartPackSnapshotFromFields(line);
  const hasPack = cartLineHasPackPricing(line);
  const packCount = line.quantity;
  const unitMinor = line.unitPriceMinor;
  const lineTotalMinor =
    unitMinor != null && Number.isFinite(unitMinor) ? Math.round(unitMinor * packCount) : null;
  const totalMeasure = formatCartLineTotalMeasure(pack, packCount);

  if (hasPack) {
    return (
      <dl className="cart-line__breakdown">
        {pack?.packLabel ? (
          <div className="cart-line__breakdown-row">
            <dt>Pack size</dt>
            <dd>{pack.packLabel}</dd>
          </div>
        ) : null}
        <div className="cart-line__breakdown-row">
          <dt>Unit price</dt>
          <dd>{unitMinor != null ? `${formatMinor(unitMinor, line.currency)} / pack` : "—"}</dd>
        </div>
        <div className="cart-line__breakdown-row">
          <dt>Packs</dt>
          <dd>{packCount}</dd>
        </div>
        {totalMeasure ? (
          <div className="cart-line__breakdown-row">
            <dt>Total amount</dt>
            <dd>{totalMeasure}</dd>
          </div>
        ) : null}
        <div className="cart-line__breakdown-row cart-line__breakdown-row--total">
          <dt>Line total</dt>
          <dd>
            <strong>{lineTotalMinor != null ? formatMinor(lineTotalMinor, line.currency) : "—"}</strong>
          </dd>
        </div>
      </dl>
    );
  }

  return (
    <dl className="cart-line__breakdown">
      <div className="cart-line__breakdown-row">
        <dt>Unit price</dt>
        <dd>{unitMinor != null ? formatMinor(unitMinor, line.currency) : "—"}</dd>
      </div>
      <div className="cart-line__breakdown-row">
        <dt>Quantity</dt>
        <dd>{packCount}</dd>
      </div>
      <div className="cart-line__breakdown-row cart-line__breakdown-row--total">
        <dt>Line total</dt>
        <dd>
          <strong>{lineTotalMinor != null ? formatMinor(lineTotalMinor, line.currency) : "—"}</strong>
        </dd>
      </div>
    </dl>
  );
}
