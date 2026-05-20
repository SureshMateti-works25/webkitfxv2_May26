import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.js";
import { useCart } from "../cart/CartContext.js";
import { getAtPath } from "@webkitfxv2/core-engine";
import { getScreenConfig } from "../config/getScreenConfig.js";
import { QrOrderBanner } from "../components/QrOrderBanner.js";
import {
  listCommerceLookupValues,
  type CommerceLookupValueDto,
} from "../lib/commerceApi.js";
import {
  clearCheckoutDraft,
  formatMinor,
  persistLastOrderEmail,
  placeStorefrontOrder,
  readCheckoutDraft,
  writeCheckoutDraft,
  type CheckoutDraft,
  type ShippingAddress,
} from "../lib/checkoutApi.js";
import { dineInTableShippingAddress } from "../lib/dineInCheckoutAddress.js";
import { qrTableShippingAddress } from "../lib/qrCheckoutAddress.js";
import { formatQrTableHeadline, useQrOrderSession } from "../lib/qrOrderSession.js";

const defaultAddress: ShippingAddress = {
  line1: "",
  line2: "",
  city: "",
  state: "",
  postalCode: "",
  country: "IN",
};

type ServiceMode = "dine_in" | "pickup";

export function CheckoutPage() {
  const checkoutCopy = getScreenConfig("checkout");
  const qrSession = useQrOrderSession();
  const isQrCheckout = qrSession != null;
  const { lines, clearCart } = useCart();
  const { auth, getAccessToken } = useAuth();
  const navigate = useNavigate();
  const existing = readCheckoutDraft();

  const profileEmail =
    auth.status === "signedIn"
      ? String(getAtPath(auth.payload, "email") ?? getAtPath(auth.payload, "shopperEmail") ?? "")
      : "";

  const [shopperEmail, setShopperEmail] = useState(existing?.shopperEmail ?? profileEmail);
  const [shopperName, setShopperName] = useState(
    existing?.shopperName ??
      (auth.status === "signedIn" ? String(getAtPath(auth.payload, "fullName") ?? "") : "")
  );
  const [shopperPhone, setShopperPhone] = useState(existing?.shopperPhone ?? "");
  const [shippingAddress, setShippingAddress] = useState<ShippingAddress>(() => {
    if (existing?.shippingAddress) return existing.shippingAddress;
    if (qrSession) return qrTableShippingAddress(qrSession);
    return defaultAddress;
  });
  const [error, setError] = useState<string | null>(null);
  const [placing, setPlacing] = useState(false);
  const [serviceMode, setServiceMode] = useState<ServiceMode>(
    existing?.orderChannel === "pickup" ? "pickup" : "dine_in"
  );
  const [tableCode, setTableCode] = useState(existing?.tableCode ?? qrSession?.tableCode ?? "");
  const [cafeTables, setCafeTables] = useState<CommerceLookupValueDto[]>([]);

  useEffect(() => {
    let cancelled = false;
    void listCommerceLookupValues("cafe_tables")
      .then((rows) => {
        if (!cancelled) setCafeTables(rows);
      })
      .catch(() => {
        if (!cancelled) setCafeTables([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const subtotal = useMemo(() => {
    let minor = 0;
    let currency = "INR";
    for (const ln of lines) {
      if (ln.unitPriceMinor == null) continue;
      minor += ln.unitPriceMinor * ln.quantity;
      if (ln.currency) currency = ln.currency;
    }
    return { minor, currency };
  }, [lines]);

  if (lines.length === 0) return <Navigate to="/cart" replace />;

  const placeDineInOrder = async (draft: CheckoutDraft) => {
    setPlacing(true);
    try {
      const order = await placeStorefrontOrder({
        draft,
        lines,
        paymentStatus: "pending",
        accessToken: getAccessToken(),
      });
      await clearCart();
      clearCheckoutDraft();
      persistLastOrderEmail(draft.shopperEmail);
      navigate(`/checkout/confirmation/${encodeURIComponent(order.id)}`, {
        replace: true,
        state: { orderEmail: draft.shopperEmail },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not place order.");
    } finally {
      setPlacing(false);
    }
  };

  const onContinue = () => {
    setError(null);
    const email = shopperEmail.trim();
    if (!email.includes("@")) {
      setError("Enter a valid email for order updates.");
      return;
    }

    if (isQrCheckout && qrSession) {
      const draft: CheckoutDraft = {
        shopperEmail: email,
        shopperName: shopperName.trim(),
        shopperPhone: shopperPhone.trim(),
        shippingAddress: qrTableShippingAddress(qrSession),
        orderChannel: "qr",
        tableCode: qrSession.tableCode,
        paymentMethod: existing?.paymentMethod ?? "mock_upi",
      };
      writeCheckoutDraft(draft);
      navigate("/checkout/payment");
      return;
    }

    if (serviceMode === "dine_in") {
      const table = tableCode.trim();
      if (!table) {
        setError("Select or enter your table number for dine-in orders.");
        return;
      }
      const matched = cafeTables.find((t) => t.code.trim().toLowerCase() === table.toLowerCase());
      const draft: CheckoutDraft = {
        shopperEmail: email,
        shopperName: shopperName.trim(),
        shopperPhone: shopperPhone.trim(),
        shippingAddress: dineInTableShippingAddress(table, matched?.label),
        orderChannel: "dine_in",
        tableCode: table,
        paymentMethod: "pay_at_table",
      };
      void placeDineInOrder(draft);
      return;
    }

    if (!shippingAddress.line1.trim() || !shippingAddress.city.trim()) {
      setError("Enter at least street address and city.");
      return;
    }
    const draft: CheckoutDraft = {
      shopperEmail: email,
      shopperName: shopperName.trim(),
      shopperPhone: shopperPhone.trim(),
      shippingAddress: {
        ...shippingAddress,
        line1: shippingAddress.line1.trim(),
        city: shippingAddress.city.trim(),
        state: shippingAddress.state.trim(),
        postalCode: shippingAddress.postalCode.trim(),
        country: shippingAddress.country.trim() || "IN",
      },
      orderChannel: "pickup",
      paymentMethod: existing?.paymentMethod ?? "mock_upi",
    };
    writeCheckoutDraft(draft);
    navigate("/checkout/payment");
  };

  const pageTitle = isQrCheckout
    ? String(checkoutCopy.qrTitle ?? checkoutCopy.title ?? "Checkout")
    : String(checkoutCopy.title ?? "Checkout");
  const pageLede = isQrCheckout
    ? String(checkoutCopy.qrLede ?? "")
    : serviceMode === "dine_in"
      ? String(checkoutCopy.dineInPayNote ?? checkoutCopy.lede ?? "")
      : String(checkoutCopy.lede ?? "");
  const submitLabel = isQrCheckout
    ? String(checkoutCopy.qrSubmitLabel ?? checkoutCopy.submitLabel ?? "Continue to payment")
    : serviceMode === "dine_in"
      ? String(checkoutCopy.dineInSubmitLabel ?? "Send order to kitchen")
      : String(checkoutCopy.submitLabel ?? "Continue to payment");

  const contactFields = (
    <div className="checkout-form-grid">
      <label>
        Email
        <input type="email" autoComplete="email" value={shopperEmail} onChange={(e) => setShopperEmail(e.target.value)} required />
      </label>
      <label>
        Full name
        <input type="text" autoComplete="name" value={shopperName} onChange={(e) => setShopperName(e.target.value)} />
      </label>
      <label>
        Phone
        <input type="tel" autoComplete="tel" value={shopperPhone} onChange={(e) => setShopperPhone(e.target.value)} />
      </label>
    </div>
  );

  return (
    <div className="checkout-page cart-page">
      <QrOrderBanner />
      <header className="cart-page__header">
        <h1>{pageTitle}</h1>
        <p className="cart-page__lede">{pageLede}</p>
      </header>

      {isQrCheckout && qrSession ? (
        <>
          <section className="checkout-page__section" aria-labelledby="checkout-qr-service">
            <h2 id="checkout-qr-service" className="checkout-page__section-title">
              {String(checkoutCopy.qrAtTableSection ?? "Service")}
            </h2>
            <p className="checkout-qr-table-readonly">
              {String(checkoutCopy.qrTableLabel ?? "Your table")}:{" "}
              <strong>{formatQrTableHeadline(qrSession)}</strong>
              <span className="checkout-qr-table-readonly__channel"> · QR</span>
            </p>
          </section>
          <section className="checkout-page__section" aria-labelledby="checkout-contact">
            <h2 id="checkout-contact" className="checkout-page__section-title">
              {String(checkoutCopy.qrContactSection ?? "Contact")}
            </h2>
            {contactFields}
          </section>
        </>
      ) : (
        <>
          <section className="checkout-page__section" aria-labelledby="checkout-service">
            <h2 id="checkout-service" className="checkout-page__section-title">
              Service
            </h2>
            <div className="checkout-service-mode" role="radiogroup" aria-label="Pickup or dine-in">
              <label className="checkout-service-mode__option">
                <input
                  type="radio"
                  name="serviceMode"
                  value="dine_in"
                  checked={serviceMode === "dine_in"}
                  onChange={() => setServiceMode("dine_in")}
                />
                {String(checkoutCopy.dineInLabel ?? "Dine in")}
              </label>
              <label className="checkout-service-mode__option">
                <input
                  type="radio"
                  name="serviceMode"
                  value="pickup"
                  checked={serviceMode === "pickup"}
                  onChange={() => {
                    setServiceMode("pickup");
                    setTableCode("");
                  }}
                />
                {String(checkoutCopy.pickupLabel ?? "Pickup")}
              </label>
            </div>
            {serviceMode === "dine_in" ? (
              <>
                <p className="checkout-pay-at-table-note" role="note">
                  {String(checkoutCopy.dineInPayNote ?? "")}
                </p>
                <label className="checkout-form-grid__full checkout-table-field">
                {String(checkoutCopy.tableNumberLabel ?? "Table number")}
                {cafeTables.length > 0 ? (
                  <select value={tableCode} onChange={(e) => setTableCode(e.target.value)} required>
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
                    inputMode="text"
                    placeholder="e.g. 12"
                    value={tableCode}
                    onChange={(e) => setTableCode(e.target.value)}
                    required
                    autoComplete="off"
                  />
                )}
              </label>
              </>
            ) : null}
          </section>

          <section className="checkout-page__section" aria-labelledby="checkout-contact">
            <h2 id="checkout-contact" className="checkout-page__section-title">
              Contact
            </h2>
            {contactFields}
          </section>

          {serviceMode === "pickup" ? (
          <section className="checkout-page__section" aria-labelledby="checkout-ship">
            <h2 id="checkout-ship" className="checkout-page__section-title">
              Pickup details
            </h2>
            <div className="checkout-form-grid">
              <label className="checkout-form-grid__full">
                Address line 1
                <input value={shippingAddress.line1} onChange={(e) => setShippingAddress((a) => ({ ...a, line1: e.target.value }))} required />
              </label>
              <label className="checkout-form-grid__full">
                Address line 2
                <input value={shippingAddress.line2 ?? ""} onChange={(e) => setShippingAddress((a) => ({ ...a, line2: e.target.value }))} />
              </label>
              <label>
                City
                <input value={shippingAddress.city} onChange={(e) => setShippingAddress((a) => ({ ...a, city: e.target.value }))} required />
              </label>
              <label>
                State
                <input value={shippingAddress.state} onChange={(e) => setShippingAddress((a) => ({ ...a, state: e.target.value }))} />
              </label>
              <label>
                PIN / postal code
                <input value={shippingAddress.postalCode} onChange={(e) => setShippingAddress((a) => ({ ...a, postalCode: e.target.value }))} />
              </label>
              <label>
                Country
                <input value={shippingAddress.country} onChange={(e) => setShippingAddress((a) => ({ ...a, country: e.target.value }))} />
              </label>
            </div>
          </section>
          ) : null}
        </>
      )}

      <section className="checkout-page__section" aria-labelledby="checkout-summary">
        <h2 id="checkout-summary" className="checkout-page__section-title">
          Order summary
        </h2>
        <ul className="cart-page__lines">
          {lines.map((ln) => (
            <li key={ln.lineId} className="cart-line">
              <div className="cart-line__main">
                <span className="cart-line__title">{ln.titleDisplay}</span>
                <p className="cart-line__meta">
                  Qty {ln.quantity}
                  {ln.skuCode ? ` · SKU ${ln.skuCode}` : null}
                </p>
              </div>
            </li>
          ))}
        </ul>
        <p className="cart-page__subtotal">
          <strong>Estimated total:</strong> {formatMinor(subtotal.minor, subtotal.currency)}
        </p>
      </section>

      {error ? (
        <p className="storefront-error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="checkout-page__actions">
        <Link to="/cart" className="cart-page__cta-secondary">
          Back to cart
        </Link>
        <button type="button" className="cart-page__cta" disabled={placing} onClick={onContinue}>
          {placing ? "Sending…" : submitLabel}
        </button>
      </div>
    </div>
  );
}