import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { ShellConfig } from "../config/shell.types.js";
import { getShell } from "../config/getShell.js";
import { DEFAULT_COMMERCE_TENANT_ID } from "./commerceApi.js";
import { resolveTenantChrome, type ResolvedTenantChrome } from "./tenantBranding.js";

export type TenantChromeState = {
  tenantId: string;
  displayName: string;
  applicationTypeLabel: string;
  modeBadge?: string;
  shell: ShellConfig;
  loading: boolean;
};

const TenantChromeContext = createContext<TenantChromeState | null>(null);

export function TenantChromeProvider({ children }: { children: ReactNode }) {
  const tenantId = DEFAULT_COMMERCE_TENANT_ID;
  const [state, setState] = useState<TenantChromeState>(() => {
    const shell = getShell();
    return {
      tenantId,
      displayName: shell.app.name,
      applicationTypeLabel: shell.app.applicationTypeLabel ?? "Storefront",
      shell,
      loading: true,
    };
  });

  useEffect(() => {
    let cancelled = false;
    setState((prev) => ({ ...prev, loading: true, tenantId }));

    void resolveTenantChrome(tenantId).then((resolved: ResolvedTenantChrome) => {
      if (cancelled) return;
      setState({
        tenantId: resolved.tenantId,
        displayName: resolved.displayName,
        applicationTypeLabel: resolved.applicationTypeLabel,
        modeBadge: resolved.modeBadge,
        shell: resolved.shell,
        loading: false,
      });
    });

    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  const value = useMemo(() => state, [state]);

  return <TenantChromeContext.Provider value={value}>{children}</TenantChromeContext.Provider>;
}

export function useTenantChrome(): TenantChromeState {
  const ctx = useContext(TenantChromeContext);
  if (!ctx) {
    throw new Error("useTenantChrome must be used within TenantChromeProvider");
  }
  return ctx;
}
