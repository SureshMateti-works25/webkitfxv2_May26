import { getAtPath } from "@webkitfxv2/core-engine";
import { JsonForm } from "@webkitfxv2/react-renderer";
import { useEffect, useMemo, useState } from "react";
import { buildVendorOrderManageForm } from "../lib/buildOrderManageForm.js";
import { formatCommerceApiError } from "../lib/commerceApi.js";
import type { StorefrontOrderExtended } from "../lib/ordersApi.js";

type Props = {
  order: StorefrontOrderExtended;
  saving: boolean;
  onSave: (patch: { fulfillmentStatus: string; trackingNote: string }) => void | Promise<void>;
};

export function OrderManageForm({ order, saving, onSave }: Props) {
  const [form, setForm] = useState<Awaited<ReturnType<typeof buildVendorOrderManageForm>> | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadError(null);
      try {
        const built = await buildVendorOrderManageForm();
        if (!cancelled) setForm(built);
      } catch (e) {
        if (!cancelled) setLoadError(formatCommerceApiError(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const seedValues = useMemo(
    () => ({
      fulfillmentStatus: order.fulfillmentStatus,
      trackingNote: order.trackingNote ?? "",
    }),
    [order.fulfillmentStatus, order.trackingNote, order.id]
  );

  if (loadError) {
    return (
      <p className="storefront-error" role="alert">
        {loadError}
      </p>
    );
  }

  if (!form) {
    return <p className="storefront-loading">Loading fulfillment lookups…</p>;
  }

  return (
    <JsonForm
      form={form}
      seedValues={seedValues}
      resetKey={`${order.id}:${order.fulfillmentStatus}:${order.statusUpdatedAt}`}
      onSubmit={async (values) => {
        const statusBinding = form.fields.fulfillmentStatus?.binding ?? "fulfillmentStatus";
        const noteBinding = form.fields.trackingNote?.binding ?? "trackingNote";
        const fulfillmentStatus = String(getAtPath(values, statusBinding) ?? "").trim();
        const trackingNote = String(getAtPath(values, noteBinding) ?? "").trim();
        if (!fulfillmentStatus) return;
        await onSave({ fulfillmentStatus, trackingNote });
      }}
    >
      <div className="order-manage-form__actions webkitfx-form-actions">
        <button type="submit" className="cart-page__cta" disabled={saving}>
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </JsonForm>
  );
}
