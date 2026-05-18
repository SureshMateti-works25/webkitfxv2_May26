import { useEffect, useLayoutEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { QrOrderBanner } from "../components/QrOrderBanner.js";
import { getScreenConfig } from "../config/getScreenConfig.js";
import { bindQrTableFromScan } from "../lib/bindQrTableFromScan.js";
import {
  formatCommerceApiError,
  listCommerceLookupValues,
  type CommerceLookupValueDto,
} from "../lib/commerceApi.js";
import { parseQrTableFromLocation, buildQrMenuPath } from "../lib/qrOrderUrls.js";
import { formatQrTableHeadline, useQrOrderSession } from "../lib/qrOrderSession.js";
import { HomeCatalogRails } from "./HomeCatalogRails.js";

export function QrTableMenuPage() {
  const copy = getScreenConfig("qrTable");
  const { tableCode: routeTableCode } = useParams<{ tableCode?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const session = useQrOrderSession();

  const scannedCode = parseQrTableFromLocation({
    routeTableCode,
    searchTable: searchParams.get("table"),
  });

  const [cafeTables, setCafeTables] = useState<CommerceLookupValueDto[]>([]);
  const [pickerCode, setPickerCode] = useState(scannedCode);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [unknownTable, setUnknownTable] = useState(false);
  const [tablesLoaded, setTablesLoaded] = useState(false);

  // Bind table from QR immediately so cart/checkout work before lookups return.
  useLayoutEffect(() => {
    const code = scannedCode.trim();
    if (!code) return;
    bindQrTableFromScan(code, []);
  }, [scannedCode]);

  useEffect(() => {
    let cancelled = false;
    setLookupError(null);
    void listCommerceLookupValues("cafe_tables")
      .then((rows) => {
        if (cancelled) return;
        setCafeTables(rows);
        setTablesLoaded(true);
      })
      .catch((e) => {
        if (cancelled) return;
        setCafeTables([]);
        setTablesLoaded(true);
        setLookupError(formatCommerceApiError(e));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const code = scannedCode.trim();
    if (!code) return;
    const { inFloorPlan } = bindQrTableFromScan(code, cafeTables);
    setUnknownTable(tablesLoaded && cafeTables.length > 0 && !inFloorPlan);
  }, [scannedCode, cafeTables, tablesLoaded]);

  const onPickTable = (e: React.FormEvent) => {
    e.preventDefault();
    const code = pickerCode.trim();
    if (!code) return;
    navigate(buildQrMenuPath(code), { replace: true });
  };

  if (!scannedCode.trim()) {
    return (
      <div className="landing-page--fullbleed qr-table-page">
        <div className="qr-table-page__intro cart-page">
          <header className="cart-page__header">
            <h1>{String(copy.pickerTitle ?? "Order from your table")}</h1>
            <p className="cart-page__lede">
              {String(
                copy.pickerLede ??
                  "Scan the QR on your table — the link includes your table number so you do not need to enter it again."
              )}
            </p>
          </header>
          <form className="qr-table-page__picker checkout-form-grid" onSubmit={onPickTable}>
            <label className="checkout-form-grid__full">
              {String(copy.pickerTableLabel ?? "Table number")}
              {cafeTables.length > 0 ? (
                <select value={pickerCode} onChange={(e) => setPickerCode(e.target.value)} required>
                  <option value="">— Select table —</option>
                  {cafeTables.map((t) => (
                    <option key={t.id} value={t.code}>
                      {t.label} ({t.code})
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={pickerCode}
                  onChange={(e) => setPickerCode(e.target.value)}
                  placeholder="e.g. t1 or 12"
                  required
                  autoComplete="off"
                />
              )}
            </label>
            <div className="checkout-form-grid__full">
              <button type="submit" className="cart-page__cta">
                {String(copy.pickerSubmitLabel ?? "Open menu")}
              </button>
            </div>
          </form>
          <p className="qr-table-page__home-link">
            <Link to="/">{String(copy.pickerHomeLink ?? "Browse without a table")}</Link>
          </p>
        </div>
      </div>
    );
  }

  const displayCode = session?.tableCode ?? scannedCode.trim();
  const headline = session
    ? formatQrTableHeadline(session)
    : displayCode.match(/^\d+$/)
      ? `Table ${displayCode}`
      : displayCode;

  return (
    <div className="landing-page--fullbleed qr-table-page">
      <QrOrderBanner
        showMenuLink={false}
        tableCode={displayCode}
        tableLabel={session?.tableLabel}
      />
      <div className="qr-table-page__hero" aria-live="polite">
        <p className="qr-table-page__hero-kicker">{String(copy.bannerBadge ?? "QR order")}</p>
        <h1 className="qr-table-page__hero-title">{headline}</h1>
        <p className="qr-table-page__hero-lede">
          {String(
            copy.menuReadyNote ??
              "Menu for your table — add items to cart and checkout. Your table is already set from the QR link."
          )}
        </p>
      </div>
      {lookupError ? (
        <p className="qr-table-page__warn storefront-error" role="status">
          {lookupError} — you can still order; table <strong>{displayCode}</strong> is saved from the QR link.
        </p>
      ) : null}
      {unknownTable ? (
        <p className="qr-table-page__warn" role="status">
          {String(
            copy.unknownTableWarning ??
              "This table code is not in your floor plan yet — ordering still works using the code from the QR."
          )}
        </p>
      ) : null}
      <HomeCatalogRails />
    </div>
  );
}
