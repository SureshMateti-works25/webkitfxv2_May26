import type { StorefrontMode, StorefrontRuntimeConfig, TenantBootstrapResponse } from "./types.js";

function envString(key: string): string | undefined {
  const meta = import.meta as ImportMeta & { env?: Record<string, string | undefined> };
  const v = meta.env?.[key];
  return typeof v === "string" ? v.trim() : undefined;
}

function parseStorefrontMode(raw: string | undefined): StorefrontMode {
  const mode = (raw ?? "isolated_shop").toLowerCase();
  return mode === "marketplace" ? "marketplace" : "isolated_shop";
}

/** Build-time / env defaults for a storefront app deployment. */
export function readStorefrontRuntimeFromEnv(): StorefrontRuntimeConfig {
  return {
    tenantId: envString("VITE_COMMERCE_TENANT_ID") || "t1",
    storefrontMode: parseStorefrontMode(envString("VITE_STOREFRONT_MODE")),
    vertical: envString("VITE_STOREFRONT_VERTICAL"),
  };
}

export function commerceTenantHeaders(
  runtime: StorefrontRuntimeConfig = readStorefrontRuntimeFromEnv()
): Record<string, string> {
  return { "X-Tenant-Id": runtime.tenantId };
}

export async function fetchTenantBootstrap(
  apiBase: string,
  slugOrId: string
): Promise<TenantBootstrapResponse> {
  const base = apiBase.replace(/\/$/, "");
  const res = await fetch(`${base}/api/v1/tenants/${encodeURIComponent(slugOrId)}/bootstrap`, {
    headers: { Accept: "application/json" },
  });
  const data = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    const msg = typeof data.error === "string" ? data.error : `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return {
    tenantId: String(data.tenantId ?? ""),
    name: String(data.name ?? ""),
    slug: String(data.slug ?? ""),
    storefrontMode: parseStorefrontMode(String(data.storefrontMode ?? "")),
    vertical: data.vertical == null ? null : String(data.vertical),
    isActive: Boolean(data.isActive ?? true),
    features: Array.isArray(data.features) ? data.features.map(String) : [],
    rbacVersion: Number(data.rbacVersion ?? 1),
  };
}
