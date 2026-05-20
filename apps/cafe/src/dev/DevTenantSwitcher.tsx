import { useCallback, useEffect, useState } from "react";
import type { StorefrontMode } from "@webkitfxv2/storefront-runtime";
import { getCommerceApiBase } from "../lib/commerceApi.js";
import { clearQrOrderSession } from "../lib/qrOrderSession.js";
import {
  clearDevTenantOverride,
  DEV_TENANT_PRESETS,
  getCommerceTenantId,
  getEffectiveStorefrontRuntime,
  getStorefrontMode,
  readDevTenantOverride,
  writeDevTenantOverride,
} from "./devTenantStore.js";

type TenantRow = {
  id: string;
  name: string;
  slug: string;
  storefrontMode: string;
};

export function DevTenantSwitcher() {
  const [open, setOpen] = useState(false);
  const [tenantId, setTenantId] = useState(() => getCommerceTenantId());
  const [mode, setMode] = useState<StorefrontMode>(() => getStorefrontMode());
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [bootstrapHint, setBootstrapHint] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const envDefault = readDevTenantOverride() == null;
  const active = getEffectiveStorefrontRuntime();

  const loadTenants = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/tenants", { headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const rows = (await res.json()) as TenantRow[];
      if (Array.isArray(rows) && rows.length > 0) {
        setTenants(rows);
        return;
      }
    } catch {
      /* use presets */
    }
    setTenants(
      DEV_TENANT_PRESETS.map((p) => ({
        id: p.id,
        name: p.label.split("—")[1]?.trim() ?? p.id,
        slug: p.id,
        storefrontMode: p.id === "t_foodhall" ? "marketplace" : "isolated_shop",
      }))
    );
  }, []);

  useEffect(() => {
    if (!open) return;
    void loadTenants();
  }, [open, loadTenants]);

  const previewBootstrap = useCallback(async (id: string) => {
    setBootstrapHint(null);
    try {
      const base = getCommerceApiBase();
      const url =
        base.length > 0
          ? `${base.replace(/\/$/, "")}/api/v1/tenants/${encodeURIComponent(id)}/bootstrap`
          : `/api/v1/tenants/${encodeURIComponent(id)}/bootstrap`;
      const res = await fetch(url, { headers: { Accept: "application/json", "X-Tenant-Id": id } });
      const data = (await res.json()) as Record<string, unknown>;
      if (!res.ok) {
        setBootstrapHint(typeof data.error === "string" ? data.error : `HTTP ${res.status}`);
        return;
      }
      const m = String(data.storefrontMode ?? "isolated_shop") as StorefrontMode;
      setMode(m === "marketplace" ? "marketplace" : "isolated_shop");
      const features = Array.isArray(data.features) ? data.features.length : 0;
      setBootstrapHint(`${m}, ${features} feature(s)`);
    } catch (e) {
      setBootstrapHint(e instanceof Error ? e.message : "bootstrap failed");
    }
  }, []);

  useEffect(() => {
    if (!open || !tenantId) return;
    const t = window.setTimeout(() => void previewBootstrap(tenantId), 200);
    return () => window.clearTimeout(t);
  }, [open, tenantId, previewBootstrap]);

  const applyAndReload = () => {
    setBusy(true);
    clearQrOrderSession();
    writeDevTenantOverride({ tenantId, storefrontMode: mode });
    window.location.reload();
  };

  const resetToEnv = () => {
    setBusy(true);
    clearDevTenantOverride();
    window.location.reload();
  };

  if (!import.meta.env.DEV) return null;

  return (
    <div className="dev-tenant-switcher" aria-label="Development tenant switcher">
      <button
        type="button"
        className="dev-tenant-switcher__toggle"
        onClick={() => setOpen((v) => !v)}
        title="Switch Commerce tenant (dev only)"
      >
        Tenant: {active.tenantId}
        {envDefault ? "" : " *"}
      </button>
      {open ? (
        <div className="dev-tenant-switcher__panel">
          <p className="dev-tenant-switcher__title">Dev tenant</p>
          <p className="dev-tenant-switcher__meta">
            Active <code>{active.tenantId}</code> · {active.storefrontMode}
            {envDefault ? " (from .env)" : " (override)"}
          </p>
          <label className="dev-tenant-switcher__field">
            <span>Tenant</span>
            <select value={tenantId} onChange={(e) => setTenantId(e.target.value)} disabled={busy}>
              {(tenants.length > 0
                ? tenants
                : DEV_TENANT_PRESETS.map((p) => ({ id: p.id, name: p.label }))
              ).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.id} — {t.name}
                </option>
              ))}
            </select>
          </label>
          <label className="dev-tenant-switcher__field">
            <span>Storefront mode</span>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as StorefrontMode)}
              disabled={busy}
            >
              <option value="isolated_shop">isolated_shop</option>
              <option value="marketplace">marketplace</option>
            </select>
          </label>
          {bootstrapHint ? <p className="dev-tenant-switcher__hint">Bootstrap: {bootstrapHint}</p> : null}
          <div className="dev-tenant-switcher__actions">
            <button type="button" className="dev-tenant-switcher__apply" onClick={applyAndReload} disabled={busy}>
              Apply & reload
            </button>
            <button type="button" className="dev-tenant-switcher__reset" onClick={resetToEnv} disabled={busy}>
              Reset to .env
            </button>
          </div>
          <p className="dev-tenant-switcher__note">
            Sets <code>X-Tenant-Id</code> for all API calls. Reload clears cart/session for the previous tenant.
          </p>
        </div>
      ) : null}
    </div>
  );
}
