import {
  readStorefrontRuntimeFromEnv,
  type StorefrontMode,
  type StorefrontRuntimeConfig,
} from "@webkitfxv2/storefront-runtime";

const STORAGE_KEY = "webkitfx.cafe.devTenant";

export type DevTenantOverride = {
  tenantId: string;
  storefrontMode?: StorefrontMode;
};

function envDefaults(): StorefrontRuntimeConfig {
  return readStorefrontRuntimeFromEnv();
}

export function readDevTenantOverride(): DevTenantOverride | null {
  if (!import.meta.env.DEV) return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DevTenantOverride;
    if (!parsed?.tenantId?.trim()) return null;
    return {
      tenantId: parsed.tenantId.trim(),
      storefrontMode: parsed.storefrontMode,
    };
  } catch {
    return null;
  }
}

export function writeDevTenantOverride(override: DevTenantOverride): void {
  if (!import.meta.env.DEV) return;
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      tenantId: override.tenantId.trim(),
      storefrontMode: override.storefrontMode,
    })
  );
}

export function clearDevTenantOverride(): void {
  if (!import.meta.env.DEV) return;
  localStorage.removeItem(STORAGE_KEY);
}

/** Effective tenant + mode: dev override in localStorage, else Vite env. */
export function getEffectiveStorefrontRuntime(): StorefrontRuntimeConfig {
  const env = envDefaults();
  const override = readDevTenantOverride();
  if (!override) return env;
  return {
    ...env,
    tenantId: override.tenantId,
    storefrontMode: override.storefrontMode ?? env.storefrontMode,
  };
}

export function getCommerceTenantId(): string {
  return getEffectiveStorefrontRuntime().tenantId;
}

export function getStorefrontMode(): StorefrontMode {
  return getEffectiveStorefrontRuntime().storefrontMode;
}

export const DEV_TENANT_PRESETS: { id: string; label: string }[] = [
  { id: "t1", label: "t1 — Acme (seeded catalog)" },
  { id: "t_cornercup", label: "t_cornercup — Corner Cup (isolated)" },
  { id: "t_brewlab", label: "t_brewlab — Brew Lab (isolated)" },
  { id: "t_foodhall", label: "t_foodhall — Food Hall (marketplace)" },
];
