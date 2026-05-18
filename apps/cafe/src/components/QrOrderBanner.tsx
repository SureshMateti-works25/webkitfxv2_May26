import { Link, useNavigate } from "react-router-dom";
import { getScreenConfig } from "../config/getScreenConfig.js";
import {
  clearQrOrderSession,
  formatQrTableHeadline,
  useQrOrderSession,
  type QrOrderSession,
} from "../lib/qrOrderSession.js";
import { buildQrMenuPath } from "../lib/qrOrderUrls.js";

type QrOrderBannerProps = {
  /** When false, hide the “Menu” link (e.g. on the QR landing page itself). */
  showMenuLink?: boolean;
  /** From `/qr/:tableCode` before session hydrates. */
  tableCode?: string;
  tableLabel?: string;
};

function headlineFrom(session: QrOrderSession | null, tableCode: string, tableLabel?: string): string {
  if (session) return formatQrTableHeadline(session);
  if (tableLabel?.trim()) return tableLabel.trim();
  const code = tableCode.trim();
  return code.match(/^\d+$/) ? `Table ${code}` : code;
}

export function QrOrderBanner({
  showMenuLink = true,
  tableCode: tableCodeProp,
  tableLabel: tableLabelProp,
}: QrOrderBannerProps) {
  const navigate = useNavigate();
  const session = useQrOrderSession();
  const copy = getScreenConfig("qrTable");

  const tableCode = (session?.tableCode ?? tableCodeProp ?? "").trim();
  if (!tableCode) return null;

  const headline = headlineFrom(session, tableCode, session?.tableLabel ?? tableLabelProp);

  const onEndSession = () => {
    clearQrOrderSession();
    navigate("/qr", { replace: true });
  };

  return (
    <div className="qr-order-banner" role="status" aria-live="polite">
      <div className="qr-order-banner__main">
        <span className="qr-order-banner__badge">{String(copy.bannerBadge ?? "QR order")}</span>
        <span className="qr-order-banner__table">{headline}</span>
        <span className="qr-order-banner__hint">
          {String(copy.bannerHint ?? "We will bring your order to this table.")}
        </span>
      </div>
      <div className="qr-order-banner__actions">
        {showMenuLink ? (
          <Link to={buildQrMenuPath(tableCode)} className="qr-order-banner__link">
            {String(copy.bannerMenuLink ?? "Menu")}
          </Link>
        ) : null}
        <button type="button" className="qr-order-banner__end" onClick={onEndSession}>
          {String(copy.bannerEndSession ?? "Not at this table?")}
        </button>
      </div>
    </div>
  );
}
